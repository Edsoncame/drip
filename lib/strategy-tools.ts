/**
 * Strategy Tools — las herramientas que los agentes usan para interactuar con
 * el motor de estrategia. Cada tool expone un CRUD de lib/strategy-db.ts al
 * tool loop de Claude.
 *
 * Asignación de tools por agente:
 * - orquestador (Growth): TODAS (puede crear estrategia, objetivos, tasks, reports)
 * - todos los especialistas: schedule_task, update_kpi, write_report, get_strategy_context
 * - específicos por rol reciben tools adicionales (content_calendar para community,
 *   sem_plan para sem-manager, experiment para growth hackers, etc)
 */

import { tool } from "ai";
import { z } from "zod";
import type { AgentId } from "./agents";
import {
  createStrategy,
  getActiveStrategy,
  listObjectives,
  listKpis,
  listExperiments,
  listReports,
  listAttachments,
  createObjective,
  createKpi,
  updateKpi,
  createTask,
  createExperiment,
  createContentItem,
  createSemPlan,
  createBudgetLine,
  createReport,
  createCompetitor,
  createMediaMatrixLine,
  updateStrategyStatus,
  updateStrategyDocument,
  getUpcomingTasks,
  updateTaskStatus,
  totalBudgetUsd,
  type FunnelStage,
  type TaskPriority,
} from "./strategy-db";

// ═══════════════════════════════════════════════════════════════════════════
// Tool builders — cada uno recibe el agentId del caller para el audit trail
// ═══════════════════════════════════════════════════════════════════════════

// Reconocemos el enum de funnel stages para validación Zod
const FunnelEnum = z.enum([
  "awareness",
  "consideracion",
  "acquisition",
  "activation",
  "retention",
  "revenue",
  "referral",
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Context tool — lo tiene TODO agente (lectura)
// ═══════════════════════════════════════════════════════════════════════════

export function getStrategyContextTool() {
  return tool({
    description:
      "Devuelve el contexto completo de la estrategia activa: datos básicos, objetivos por funnel, KPIs actuales, tasks próximas, experimentos en curso, reportes recientes y attachments relevantes. Siempre llamalo PRIMERO para saber en qué contexto estás trabajando.",
    inputSchema: z.object({}),
    execute: async () => {
      const active = await getActiveStrategy();
      if (!active) {
        return {
          hasActiveStrategy: false,
          message:
            "No hay estrategia activa. Si sos el Head of Growth podés crear una con `create_strategy`. Si sos otro agente, esperá a que el Growth cree la estrategia antes de ejecutar.",
        };
      }
      const [objectives, kpis, upcomingTasks, experiments, reports, attachments] =
        await Promise.all([
          listObjectives(active.id),
          listKpis(active.id),
          getUpcomingTasks(active.id, 14),
          listExperiments(active.id),
          listReports(active.id, 5),
          listAttachments(active.id),
        ]);

      return {
        hasActiveStrategy: true,
        strategy: {
          id: active.id,
          name: active.name,
          slug: active.slug,
          status: active.status,
          start_date: active.start_date,
          end_date: active.end_date,
          duration_months: active.duration_months,
          north_star_metric: active.north_star_metric,
          meta_global: active.meta_global_descripcion,
          mision: active.mision,
          vision: active.vision,
          rubro: active.rubro,
          descripcion: active.descripcion,
          arquetipos: active.arquetipos,
          canales: active.canales,
        },
        objectives: objectives.map((o) => ({
          id: o.id,
          funnel_stage: o.funnel_stage,
          objetivo_general: o.objetivo_general,
          objetivo_especifico: o.objetivo_especifico,
          tacticas: o.tacticas,
          kpis: o.kpis,
          responsable: o.responsable_agent,
        })),
        kpis: kpis.map((k) => ({
          id: k.id,
          name: k.name,
          funnel_stage: k.funnel_stage,
          target: k.target_value,
          current: k.current_value,
          unit: k.unit,
          period: k.period,
          status: k.status,
        })),
        upcomingTasks: upcomingTasks.slice(0, 20).map((t) => ({
          id: t.id,
          title: t.title,
          owner: t.owner_agent_id,
          scheduled_for: t.scheduled_for,
          deadline: t.deadline,
          priority: t.priority,
          category: t.category,
        })),
        experiments: experiments.slice(0, 10).map((e) => ({
          id: e.id,
          codigo: e.codigo,
          nombre: e.nombre,
          funnel_stage: e.funnel_stage,
          status: e.status,
          puntaje_total: e.puntaje_total,
          hacker: e.hacker_agent_id,
        })),
        recentReports: reports.map((r) => ({
          id: r.id,
          type: r.report_type,
          title: r.title,
          period_start: r.period_start,
          period_end: r.period_end,
        })),
        attachments: attachments.slice(0, 20).map((a) => ({
          id: a.id,
          kind: a.kind,
          title: a.title,
          filename: a.filename,
          has_parsed_text: !!a.parsed_text,
        })),
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Growth-only tools — crear estrategia y estructura
// ═══════════════════════════════════════════════════════════════════════════

export function createStrategyTool(actor: string) {
  return tool({
    description:
      "[SOLO HEAD OF GROWTH] Crea una nueva estrategia de marketing anual/semestral/trimestral. La estrategia queda en status 'draft' hasta que la activas con `activate_strategy`. Inicialmente llenás datos básicos — después agregás objetivos con `create_objective`, KPIs con `create_kpi`, tasks con `schedule_task`, etc. Usá slugify del nombre para el slug.",
    inputSchema: z.object({
      name: z.string().describe("Ej: 'FLUX Growth 2026 Q2-Q3'"),
      start_date: z.string().describe("Fecha inicio YYYY-MM-DD"),
      end_date: z.string().describe("Fecha fin YYYY-MM-DD"),
      rubro: z.string().optional(),
      descripcion: z.string().optional(),
      canales: z.array(z.string()).optional(),
      publico_descripcion: z.string().optional(),
      arquetipos: z
        .array(
          z.object({
            nombre: z.string(),
            tipo: z.string(),
            verbatim: z.string().optional(),
          }),
        )
        .optional(),
      mision: z.string().optional(),
      vision: z.string().optional(),
      territorio_marca: z.string().optional(),
      valores_marca: z.array(z.string()).optional(),
      plan_crecimiento: z.string().optional(),
      north_star_metric: z.string().describe("Ej: 'MRR activo' o '# de rentals mensuales'"),
      meta_global_descripcion: z.string().optional(),
      meta_global_valor: z.string().optional(),
      posicionamiento: z.record(z.string(), z.string()).optional(),
      document_md: z
        .string()
        .optional()
        .describe("Markdown completo de la estrategia — se genera después"),
    }),
    execute: async (input) => {
      const start = new Date(input.start_date);
      const end = new Date(input.end_date);
      const strategy = await createStrategy({
        name: input.name,
        slug: slugify(input.name),
        status: "draft",
        start_date: start,
        end_date: end,
        duration_months: monthsBetween(start, end),
        rubro: input.rubro ?? null,
        descripcion: input.descripcion ?? null,
        canales: input.canales ?? null,
        publico_descripcion: input.publico_descripcion ?? null,
        arquetipos: input.arquetipos ?? null,
        mision: input.mision ?? null,
        vision: input.vision ?? null,
        territorio_marca: input.territorio_marca ?? null,
        valores_marca: input.valores_marca ?? null,
        plan_crecimiento: input.plan_crecimiento ?? null,
        north_star_metric: input.north_star_metric ?? null,
        meta_global_descripcion: input.meta_global_descripcion ?? null,
        meta_global_valor: input.meta_global_valor ?? null,
        posicionamiento: input.posicionamiento ?? null,
        document_md: input.document_md ?? null,
        created_by: actor,
      });
      return {
        ok: true,
        strategy_id: strategy.id,
        slug: strategy.slug,
        duration_months: strategy.duration_months,
        status: strategy.status,
        message: `Estrategia creada en draft. Llamá a create_objective / create_kpi / schedule_task para llenarla, y después activate_strategy para activarla.`,
      };
    },
  });
}

export function activateStrategyTool() {
  return tool({
    description:
      "[SOLO HEAD OF GROWTH] Activa una estrategia en draft para que entre en ejecución. Los crons del autopilot empezarán a ejecutar tasks y KPIs según schedule. Solo puede haber 1 estrategia activa a la vez — la anterior se archiva automáticamente.",
    inputSchema: z.object({
      strategy_id: z.number(),
    }),
    execute: async ({ strategy_id }) => {
      // Archivar cualquier otra estrategia activa
      const current = await getActiveStrategy();
      if (current && current.id !== strategy_id) {
        await updateStrategyStatus(current.id, "archived");
      }
      await updateStrategyStatus(strategy_id, "active");
      return {
        ok: true,
        message:
          "Estrategia activada. El autopilot empezará a ejecutar tasks con scheduled_for <= NOW() en el próximo tick.",
      };
    },
  });
}

export function updateStrategyDocumentTool() {
  return tool({
    description:
      "[SOLO HEAD OF GROWTH] Actualiza el documento markdown master de la estrategia (el que sirve para exportar PDF). Llamalo después de haber creado todos los objectives/KPIs/tasks para generar el documento consolidado.",
    inputSchema: z.object({
      strategy_id: z.number(),
      document_md: z.string().describe("Markdown COMPLETO de la estrategia — headings + tablas"),
    }),
    execute: async ({ strategy_id, document_md }) => {
      await updateStrategyDocument(strategy_id, document_md);
      return { ok: true, length: document_md.length };
    },
  });
}

export function createObjectiveTool() {
  return tool({
    description:
      "Crea un objetivo estratégico para una etapa del funnel. Usá la estructura de PROYECCIÓN: objetivo general + específico + desafíos + canales + estrategia + tácticas + KPIs + métricas + herramientas + responsable_agent (slug del agente que lo ejecuta).",
    inputSchema: z.object({
      strategy_id: z.number(),
      funnel_stage: FunnelEnum,
      objetivo_general: z.string(),
      objetivo_especifico: z.string().optional(),
      desafios: z.array(z.string()).optional(),
      canales: z.array(z.string()).optional(),
      estrategia_txt: z.string().optional(),
      tacticas: z.array(z.string()).optional(),
      kpis: z
        .array(
          z.object({
            nombre: z.string(),
            target_value: z.number().optional(),
            unit: z.string().optional(),
            period: z.string().optional(),
          }),
        )
        .optional(),
      metricas_seguimiento: z.array(z.string()).optional(),
      herramientas: z.array(z.string()).optional(),
      responsable_agent: z
        .string()
        .optional()
        .describe("slug del agente responsable ej: seo-specialist, community-manager"),
    }),
    execute: async (input) => {
      const obj = await createObjective({
        strategy_id: input.strategy_id,
        funnel_stage: input.funnel_stage,
        objetivo_general: input.objetivo_general,
        objetivo_especifico: input.objetivo_especifico ?? null,
        desafios: input.desafios ?? null,
        canales: input.canales ?? null,
        estrategia_txt: input.estrategia_txt ?? null,
        tacticas: input.tacticas ?? null,
        kpis: input.kpis ?? null,
        metricas_seguimiento: input.metricas_seguimiento ?? null,
        herramientas: input.herramientas ?? null,
        responsable_agent: input.responsable_agent ?? null,
      });
      return { ok: true, objective_id: obj.id };
    },
  });
}

export function createKpiTool(actor: string) {
  return tool({
    description:
      "Crea un KPI trackeable con target, unidad y período. Cualquier agente puede crear KPIs de su área. El Head of Growth los consolida en el reporte.",
    inputSchema: z.object({
      strategy_id: z.number(),
      objective_id: z.number().optional(),
      name: z.string().describe("Ej: 'MRR activo', 'CAC Google', 'Activation rate'"),
      funnel_stage: FunnelEnum.optional(),
      target_value: z.number(),
      unit: z.string().describe("Ej: 'USD', '%', 'clientes', 'ordenes'"),
      period: z.enum(["weekly", "monthly", "quarterly", "annual"]),
      formula: z.string().optional(),
    }),
    execute: async (input) => {
      const kpi = await createKpi({
        strategy_id: input.strategy_id,
        objective_id: input.objective_id ?? null,
        name: input.name,
        funnel_stage: (input.funnel_stage as FunnelStage) ?? null,
        target_value: input.target_value,
        unit: input.unit,
        period: input.period,
        formula: input.formula ?? null,
        status: "on_track",
        last_updated_at: null,
        last_updated_by: actor,
      });
      return { ok: true, kpi_id: kpi.id };
    },
  });
}

export function updateKpiValueTool(actor: string) {
  return tool({
    description:
      "Actualiza el valor actual de un KPI y registra un snapshot temporal. Usalo cuando veas data nueva que lo impacte (data-analyst lo hace más).",
    inputSchema: z.object({
      kpi_id: z.number(),
      value: z.number(),
      note: z.string().optional(),
    }),
    execute: async ({ kpi_id, value, note }) => {
      await updateKpi(kpi_id, value, actor, note);
      return { ok: true, value };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Tasks — disponible para todos los agentes
// ═══════════════════════════════════════════════════════════════════════════

export function scheduleTaskTool(_actor: string) {
  return tool({
    description:
      "Programa una tarea concreta en una fecha/hora específica. Cuando llegue scheduled_for, el task scheduler despertará al owner_agent_id y le pasará la tarea para ejecutar. Si es recurrente (ej: cada lunes), usá recurrence_rule con formato simple: 'WEEKLY:MON:09:00' o 'MONTHLY:1:08:00' (día 1 del mes 8am).",
    inputSchema: z.object({
      strategy_id: z.number(),
      category: z.string().describe("Ej: 'Plan Mayo', 'Blog', 'Campaña Lanzamiento'"),
      estrategia: z.string().describe("Ej: 'Tráfico', 'Sign Ups', 'Retention'").optional(),
      funnel_stage: FunnelEnum.optional(),
      title: z.string(),
      description: z.string().optional(),
      owner_agent_id: z
        .string()
        .describe("slug del agente ej: 'community-manager', 'copy-lanzamiento'"),
      scheduled_for: z
        .string()
        .optional()
        .describe("ISO datetime cuando debe ejecutarse ej: '2026-05-16T09:00:00-05:00'"),
      deadline: z.string().optional().describe("ISO datetime de fecha límite"),
      priority: z.enum(["alta", "media", "baja"]),
      deliverable_type: z
        .string()
        .optional()
        .describe("Ej: 'post', 'email', 'brief', 'report', 'ad'"),
      recurrence_rule: z.string().optional(),
      comentarios: z.string().optional(),
    }),
    execute: async (input) => {
      const task = await createTask({
        strategy_id: input.strategy_id,
        parent_task_id: null,
        category: input.category,
        estrategia: input.estrategia ?? null,
        funnel_stage: (input.funnel_stage as FunnelStage) ?? null,
        title: input.title,
        description: input.description ?? null,
        owner_agent_id: input.owner_agent_id,
        scheduled_for: input.scheduled_for ? new Date(input.scheduled_for) : null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        status: "pending",
        priority: input.priority as TaskPriority,
        deliverable_type: input.deliverable_type ?? null,
        comentarios: input.comentarios ?? null,
        recurrence_rule: input.recurrence_rule ?? null,
        recurrence_parent_id: null,
      });
      return {
        ok: true,
        task_id: task.id,
        scheduled_for: task.scheduled_for,
        owner: task.owner_agent_id,
      };
    },
  });
}

export function markTaskDoneTool(_actor: string) {
  return tool({
    description:
      "Marca una tarea como completada. Pasále el rel_path del archivo que generaste como deliverable.",
    inputSchema: z.object({
      task_id: z.number(),
      output_file_path: z.string().optional(),
    }),
    execute: async ({ task_id, output_file_path }) => {
      await updateTaskStatus(task_id, "done", output_file_path);
      return { ok: true };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Experiments
// ═══════════════════════════════════════════════════════════════════════════

export function createExperimentTool(actor: string) {
  return tool({
    description:
      "Crea un experimento growth con hipótesis, método, criterios éxito/fracaso. Después de crearlo, usá schedule_task para programar las acciones específicas. PIE score se calcula: puntaje_total = probabilidad × impacto × ease (cada uno 1-10).",
    inputSchema: z.object({
      strategy_id: z.number(),
      nombre: z.string(),
      codigo: z.string().optional().describe("Ej: E001, E002"),
      funnel_stage: FunnelEnum,
      objetivo: z.string(),
      hipotesis: z
        .string()
        .describe("'Si hacemos X, esperamos que Y suba un Z% porque...'"),
      metodo: z.string(),
      recursos: z.string().optional(),
      audiencia_objetivo: z.string().optional(),
      metricas_a_atacar: z.string(),
      criterio_exito: z.string(),
      criterio_fracaso: z.string(),
      probabilidad: z.number().min(1).max(10),
      impacto: z.number().min(1).max(10),
      ease: z.number().min(1).max(10),
      acciones: z
        .array(z.object({ numero: z.number(), descripcion: z.string() }))
        .optional(),
      hacker_agent_id: z.string().optional(),
    }),
    execute: async (input) => {
      const puntaje = input.probabilidad * input.impacto * input.ease;
      const exp = await createExperiment({
        strategy_id: input.strategy_id,
        codigo: input.codigo ?? null,
        semana: null,
        ranking: null,
        nombre: input.nombre,
        funnel_stage: input.funnel_stage,
        objetivo: input.objetivo,
        hipotesis: input.hipotesis,
        metodo: input.metodo,
        recursos: input.recursos ?? null,
        detalles: null,
        audiencia_objetivo: input.audiencia_objetivo ?? null,
        metricas_a_atacar: input.metricas_a_atacar,
        criterio_exito: input.criterio_exito,
        criterio_fracaso: input.criterio_fracaso,
        puntaje_total: puntaje,
        probabilidad: input.probabilidad,
        impacto: input.impacto,
        ease: input.ease,
        voter_scores: null,
        hacker_agent_id: input.hacker_agent_id ?? actor,
        status: "idea",
        acciones: input.acciones ?? null,
        resultado_texto: null,
        resultado_metricas: null,
        exitoso: null,
        comentarios: null,
      });
      return { ok: true, experiment_id: exp.id, puntaje_total: puntaje };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Content Calendar
// ═══════════════════════════════════════════════════════════════════════════

export function createCalendarItemTool(actor: string) {
  return tool({
    description:
      "Crea un item en el calendario editorial (parrilla). Usá los campos exactos de la parrilla real: canal (Instagram/TikTok/LinkedIn/Facebook/WhatsApp/Notificación/Mailing/Pop-up/Cupones), formato (Story/Post/Reel/Video/Imagen/Texto), segmento, tema, contenido, área, owner.",
    inputSchema: z.object({
      strategy_id: z.number(),
      fecha_publicacion: z.string().describe("YYYY-MM-DD"),
      hora_publicacion: z.string().optional().describe("HH:MM"),
      canal: z.string(),
      formato: z.string().optional(),
      segmento: z.string().optional(),
      canjean: z.string().optional(),
      tema: z.string().optional(),
      contenido_text: z.string().describe("El copy final"),
      contenido_brief: z.string().optional().describe("Brief para diseño"),
      area: z.string().optional(),
      owner_agent_id: z.string().optional(),
      task_id: z.number().optional(),
    }),
    execute: async (input) => {
      const item = await createContentItem({
        strategy_id: input.strategy_id,
        fecha_publicacion: new Date(input.fecha_publicacion),
        hora_publicacion: input.hora_publicacion ?? null,
        canal: input.canal,
        formato: input.formato ?? null,
        segmento: input.segmento ?? null,
        canjean: input.canjean ?? null,
        tema: input.tema ?? null,
        contenido_text: input.contenido_text,
        contenido_brief: input.contenido_brief ?? null,
        area: input.area ?? null,
        owner_agent_id: input.owner_agent_id ?? actor,
        fecha_aprobacion: null,
        estado: "borrador",
        comentarios: null,
        asset_urls: null,
        task_id: input.task_id ?? null,
      });
      return { ok: true, calendar_item_id: item.id };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SEM Plan
// ═══════════════════════════════════════════════════════════════════════════

export function createSemPlanTool() {
  return tool({
    description:
      "Crea una línea del plan de medios pagado con forecast completo (registros/transacciones mensuales/diarias estimadas por pauta, CTR, CPR, inversión USD/PEN). Basado 1:1 en el template SEM.",
    inputSchema: z.object({
      strategy_id: z.number(),
      periodo: z.string().describe("Ej: 'Abril 2026', 'Q2 2026'"),
      campana: z.string(),
      medio: z
        .string()
        .describe("Google Search|YouTube|Facebook|Instagram|Programática|LinkedIn"),
      objetivo: z.string().optional(),
      formato: z.string().optional(),
      segmentacion: z.string().optional(),
      duracion: z.string().optional(),
      tipo_compra: z.string().optional().describe("CPA|CPC|CPM|CPV|CPE|CPR"),
      alcance_estimado: z.number().optional(),
      impresiones_estimadas: z.number().optional(),
      clics_estimados: z.number().optional(),
      registros_mensuales_por_pauta: z.number().optional(),
      registros_diarios_por_pauta: z.number().optional(),
      transacciones_mensuales_por_pauta: z.number().optional(),
      ctr_er: z.number().optional(),
      cpr: z.number().optional(),
      inversion_usd: z.number(),
      inversion_pen: z.number().optional(),
      fecha_inicio: z.string().optional(),
      fecha_fin: z.string().optional(),
    }),
    execute: async (input) => {
      const plan = await createSemPlan({
        strategy_id: input.strategy_id,
        periodo: input.periodo,
        campana: input.campana,
        medio: input.medio,
        objetivo: input.objetivo ?? null,
        formato: input.formato ?? null,
        segmentacion: input.segmentacion ?? null,
        duracion: input.duracion ?? null,
        tipo_compra: input.tipo_compra ?? null,
        alcance_estimado: input.alcance_estimado ?? null,
        impresiones_estimadas: input.impresiones_estimadas ?? null,
        interacciones_estimadas: null,
        clics_estimados: input.clics_estimados ?? null,
        visualizaciones_estimadas: null,
        registros_mensuales_por_pauta: input.registros_mensuales_por_pauta ?? null,
        registros_diarios_por_pauta: input.registros_diarios_por_pauta ?? null,
        transacciones_mensuales_por_pauta: input.transacciones_mensuales_por_pauta ?? null,
        transacciones_diarias_por_pauta: null,
        ctr_er: input.ctr_er ?? null,
        cpr: input.cpr ?? null,
        inversion_usd: input.inversion_usd,
        inversion_pen: input.inversion_pen ?? null,
        soi_pct: null,
        fecha_inicio: input.fecha_inicio ? new Date(input.fecha_inicio) : null,
        fecha_fin: input.fecha_fin ? new Date(input.fecha_fin) : null,
        status: "draft",
      });
      return { ok: true, sem_plan_id: plan.id };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Budget — para que Growth pida dinero
// ═══════════════════════════════════════════════════════════════════════════

export function allocateBudgetTool() {
  return tool({
    description:
      "[SOLO HEAD OF GROWTH + SEM-MANAGER] Aloca presupuesto para un canal en un período. Útil para pedir dinero a Edson — el Head of Growth debería usar esto cuando propone una campaña que requiere inversión. Basado en INVERSIÓN GROWTH del template.",
    inputSchema: z.object({
      strategy_id: z.number(),
      canal: z
        .string()
        .describe(
          "Ej: 'Google Search', 'Facebook/Conversiones', 'Mención RPP', 'LinkedIn Ads', 'SEO'",
        ),
      period_type: z.enum(["weekly", "monthly", "quarterly"]),
      period_number: z.number().describe("Semana 1-52 o mes 1-12"),
      period_year: z.number(),
      amount_usd: z.number(),
      amount_pen: z.number().optional(),
      notes: z.string().optional().describe("Justificación — por qué hace falta este dinero"),
    }),
    execute: async (input) => {
      const bl = await createBudgetLine({
        strategy_id: input.strategy_id,
        canal: input.canal,
        period_type: input.period_type,
        period_number: input.period_number,
        period_year: input.period_year,
        amount_usd: input.amount_usd,
        amount_pen: input.amount_pen ?? null,
        status: "allocated",
        notes: input.notes ?? null,
      });
      const total = await totalBudgetUsd(input.strategy_id);
      return {
        ok: true,
        budget_line_id: bl.id,
        total_strategy_budget_usd: total,
        message: `Allocado $${input.amount_usd} USD a ${input.canal} para ${input.period_type} ${input.period_number}/${input.period_year}. Total estrategia: $${total}`,
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Reports — Growth y data-analyst
// ═══════════════════════════════════════════════════════════════════════════

export function writeReportTool(actor: string) {
  return tool({
    description:
      "Escribe un reporte ejecutivo (weekly/monthly/quarterly/adhoc) para Edson. El markdown completo va en content_md. Incluí ejecutivo summary, KPIs snapshot, experiments, tasks, recomendaciones y next steps. Esto queda fijado en el admin panel para Edson lo lea.",
    inputSchema: z.object({
      strategy_id: z.number(),
      report_type: z.enum(["weekly", "monthly", "quarterly", "adhoc", "experiment", "launch"]),
      title: z.string(),
      executive_summary: z.string(),
      content_md: z.string().describe("Markdown completo del reporte"),
      period_start: z.string().optional(),
      period_end: z.string().optional(),
      week_number: z.number().optional(),
      kpis_snapshot: z
        .array(
          z.object({
            name: z.string(),
            target: z.number(),
            current: z.number(),
            delta: z.number(),
          }),
        )
        .optional(),
      tasks_summary: z
        .object({
          completed: z.number(),
          pending: z.number(),
          overdue: z.number(),
        })
        .optional(),
      recommendations_md: z.string().optional(),
      next_steps_md: z.string().optional(),
    }),
    execute: async (input) => {
      const report = await createReport({
        strategy_id: input.strategy_id,
        report_type: input.report_type,
        period_start: input.period_start ? new Date(input.period_start) : null,
        period_end: input.period_end ? new Date(input.period_end) : null,
        week_number: input.week_number ?? null,
        title: input.title,
        executive_summary: input.executive_summary,
        content_md: input.content_md,
        kpis_snapshot: input.kpis_snapshot ?? null,
        experiments_summary: null,
        tasks_summary: input.tasks_summary ?? null,
        recommendations_md: input.recommendations_md ?? null,
        next_steps_md: input.next_steps_md ?? null,
        generated_by: actor,
      });
      return { ok: true, report_id: report.id, title: report.title };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Research — competitor + media matrix
// ═══════════════════════════════════════════════════════════════════════════

export function trackCompetitorTool(actor: string) {
  return tool({
    description:
      "Registra el análisis de un competidor. Usalo cuando hagas un scan con web_fetch. Estructura exacta al template Hoja8: ubicación, servicios, canales, promociones, operaciones inmediatas/interbancarias, trayectoria.",
    inputSchema: z.object({
      strategy_id: z.number().optional(),
      competitor_name: z.string(),
      ubicacion: z.string().optional(),
      servicios: z.array(z.string()).optional(),
      canales_comunicacion: z.array(z.string()).optional(),
      promociones: z.array(z.string()).optional(),
      operaciones_inmediatas: z.array(z.string()).optional(),
      operaciones_interbancarias: z.array(z.string()).optional(),
      trayectoria: z.string().optional(),
      notas_adicionales: z.string().optional(),
    }),
    execute: async (input) => {
      const comp = await createCompetitor({
        strategy_id: input.strategy_id ?? null,
        competitor_name: input.competitor_name,
        ubicacion: input.ubicacion ?? null,
        servicios: input.servicios ?? null,
        canales_comunicacion: input.canales_comunicacion ?? null,
        promociones: input.promociones ?? null,
        operaciones_inmediatas: input.operaciones_inmediatas ?? null,
        operaciones_interbancarias: input.operaciones_interbancarias ?? null,
        trayectoria: input.trayectoria ?? null,
        notas_adicionales: input.notas_adicionales ?? null,
        last_analyzed_at: new Date(),
        analyzed_by_agent: actor,
      });
      return { ok: true, competitor_id: comp.id };
    },
  });
}

export function addMediaMatrixTool() {
  return tool({
    description:
      "Agrega una línea a la matriz PAID/OWNED/EARNED MEDIA. Estructura exacta a Hoja1 de pauta: tipo_media, detalle, medios, canales_especificos, embudo, cupón.",
    inputSchema: z.object({
      strategy_id: z.number(),
      tipo_media: z.enum(["PAID MEDIA", "OWNED MEDIA", "EARNED MEDIA"]),
      detalle: z.string().optional(),
      medios: z.string().optional(),
      canales_especificos: z.string().optional(),
      embudo: z.string().optional(),
      cupon_nombre: z.string().optional(),
      cupon_valor: z.string().optional(),
      cupon_usos: z.string().optional(),
      owner: z.string().optional(),
      notas: z.string().optional(),
    }),
    execute: async (input) => {
      const line = await createMediaMatrixLine({
        strategy_id: input.strategy_id,
        tipo_media: input.tipo_media,
        detalle: input.detalle ?? null,
        medios: input.medios ?? null,
        canales_especificos: input.canales_especificos ?? null,
        embudo: input.embudo ?? null,
        cupon_nombre: input.cupon_nombre ?? null,
        cupon_valor: input.cupon_valor ?? null,
        cupon_usos: input.cupon_usos ?? null,
        owner: input.owner ?? null,
        notas: input.notas ?? null,
      });
      return { ok: true, matrix_line_id: line.id };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Delegate to agent — SOLO para Growth (y el chat)
// Ejecuta un subagente síncronamente dentro del tool loop.
// ═══════════════════════════════════════════════════════════════════════════

export function delegateToAgentTool(actor: string) {
  return tool({
    description:
      "Delegá una tarea a un subagente especialista y esperá su respuesta. ÚSALO PRIMERO antes de preguntarle datos al usuario. Ejemplos: data-analyst para baseline de métricas reales (MRR, CAC, LTV, churn del Postgres real), market-researcher para competitive scan, seo-specialist para keyword gap analysis, estratega-oferta para brief de posicionamiento. El agente EJECUTA y escribe archivos reales. Devuelve el texto + lista de archivos. Si falla, dice por qué.",
    inputSchema: z.object({
      agent: z.enum([
        "estratega-oferta",
        "copy-lanzamiento",
        "disenador-creativo",
        "seo-specialist",
        "content-creator",
        "sem-manager",
        "community-manager",
        "data-analyst",
        "lead-qualifier",
        "market-researcher",
        "programador-fullstack",
      ]),
      task: z
        .string()
        .describe(
          "Instrucción completa en español para el subagente. Sé específico sobre qué querés que te devuelva.",
        ),
      max_steps: z
        .number()
        .optional()
        .describe("Máximo de pasos del tool loop del subagente, default 6"),
    }),
    execute: async ({ agent, task, max_steps }) => {
      // Delegación ASÍNCRONA. El orquestador NO espera el resultado del subagente.
      // Si esperábamos sync, 3 subagentes × 40s = >2min + razonamiento orq → >5min
      // → Vercel mataba la función → chat nunca respondía.
      // Ahora: disparamos el run con after(), retornamos al instante.
      // El usuario ve el resultado en el panel de agentes (scene + runs history).
      const { runAgent } = await import("./agent-runner");
      const { after } = await import("next/server");

      after(async () => {
        try {
          const result = await runAgent({
            agentId: agent as AgentId,
            task,
            actor: `growth:${actor}`,
            maxSteps: max_steps ?? 6,
            depth: 1,
          });
          console.log(
            `[delegate-async] ${agent} done · success=${result.success} files=${result.filesWritten.length}`,
          );
        } catch (err) {
          console.error(`[delegate-async] ${agent} failed`, err);
        }
      });

      return {
        success: true,
        status: "dispatched",
        text: `✅ Tarea delegada a ${agent}. Corre en background — resultado disponible en el panel de agentes en ~30-60 segundos.`,
        note: "Delegación async: no esperes este output, continúa la conversación o delega otra tarea si es necesario.",
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SQL Query readonly — solo para data-analyst
// ═══════════════════════════════════════════════════════════════════════════

export function sqlQueryReadonlyTool() {
  return tool({
    description:
      "Ejecuta una query SQL READONLY contra la base de datos de producción de FLUX (Postgres). SOLO SELECT — no INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE. Usa esto para obtener métricas reales: MRR, clientes activos, órdenes, pagos, equipos, etc. Tablas principales: users, subscriptions, payments, payment_invoices, equipment, products. Devuelve las primeras 100 filas como JSON.",
    inputSchema: z.object({
      sql: z.string().describe(
        "Query SELECT en SQL. Ej: 'SELECT COUNT(*) as total FROM subscriptions WHERE status = \\'active\\''",
      ),
    }),
    execute: async ({ sql }) => {
      // Validación estricta: solo SELECT
      const trimmed = sql.trim().toUpperCase();
      const forbidden = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "ALTER",
        "TRUNCATE",
        "CREATE",
        "GRANT",
        "REVOKE",
        "COPY",
        "EXECUTE",
      ];
      for (const keyword of forbidden) {
        if (
          trimmed.startsWith(keyword) ||
          trimmed.includes(` ${keyword} `) ||
          trimmed.includes(`${keyword} `)
        ) {
          return {
            error: `BLOQUEADO: query contiene '${keyword}'. Solo SELECT permitido.`,
          };
        }
      }
      if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
        return {
          error: "Solo queries que empiecen con SELECT o WITH (CTE) están permitidas.",
        };
      }

      try {
        const { query: dbQuery } = await import("./db");
        const result = await dbQuery(sql);
        return {
          rows: result.rows.slice(0, 100),
          rowCount: result.rowCount,
          fields: result.fields?.map((f) => f.name),
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "query failed",
        };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Blockers — cualquier agente puede reportar que no puede completar algo
// ═══════════════════════════════════════════════════════════════════════════

export function reportBlockerTool(actor: string, defaultAgentId: AgentId) {
  return tool({
    description:
      "Reportá un bloqueo cuando intentás completar una tarea y descubrís que te falta algo crítico: una API key, credenciales, conexión a un servicio externo, env var, permisos, acceso a una DB, etc. El blocker aparece como linterna roja en tu avatar en /admin/agentes. Incluí SIEMPRE los pasos exactos para resolverlo. Si ya existe un blocker abierto con el mismo context_key, se actualiza.",
    inputSchema: z.object({
      title: z
        .string()
        .describe("Título corto del problema. Ej: 'Falta META_ACCESS_TOKEN'"),
      description: z
        .string()
        .describe("Qué estabas intentando hacer cuando descubriste el bloqueo"),
      steps_to_fix: z
        .string()
        .describe(
          "Markdown con los pasos NUMERADOS exactos para resolverlo. Incluí URLs, nombres de env vars, permisos/scopes necesarios. Sé literal.",
        ),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      context_key: z
        .string()
        .optional()
        .describe(
          "Clave única para dedupe. Ej: 'env:META_ACCESS_TOKEN'. Si no pasás, se genera automáticamente.",
        ),
    }),
    execute: async ({ title, description, steps_to_fix, severity, context_key }) => {
      const { reportBlocker } = await import("./agent-blockers");
      const b = await reportBlocker({
        agentId: defaultAgentId,
        title,
        description,
        stepsToFix: steps_to_fix,
        severity: severity ?? "warning",
        source: `agent:${actor}`,
        contextKey: context_key,
      });
      return {
        ok: true,
        blocker_id: b.id,
        message:
          "Blocker reportado. Edson va a verlo como linterna roja en tu avatar en /admin/agentes.",
      };
    },
  });
}

export function resolveBlockerTool(actor: string) {
  return tool({
    description:
      "Marca un blocker propio como resuelto. Usalo cuando ya encontraste workaround o el user configuró lo que faltaba.",
    inputSchema: z.object({
      blocker_id: z.number(),
    }),
    execute: async ({ blocker_id }) => {
      const { resolveBlocker } = await import("./agent-blockers");
      await resolveBlocker(blocker_id, actor);
      return { ok: true };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Build strategy toolset por agente
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Devuelve el set de tools de estrategia apropiado para un agente dado.
 * El orquestador (Head of Growth) tiene TODAS; los demás tienen lo suyo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function strategyToolsForAgent(agentId: AgentId, actor: string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {
    // Todos tienen acceso al contexto y al sistema de blockers
    get_strategy_context: getStrategyContextTool(),
    schedule_task: scheduleTaskTool(actor),
    mark_task_done: markTaskDoneTool(actor),
    update_kpi: updateKpiValueTool(actor),
    write_report: writeReportTool(actor),
    report_blocker: reportBlockerTool(actor, agentId),
    resolve_blocker: resolveBlockerTool(actor),
  };

  if (agentId === "orquestador") {
    // Head of Growth: CRUD completo de estrategia + delegate sincrónico
    tools.create_strategy = createStrategyTool(actor);
    tools.activate_strategy = activateStrategyTool();
    tools.update_strategy_document = updateStrategyDocumentTool();
    tools.create_objective = createObjectiveTool();
    tools.create_kpi = createKpiTool(actor);
    tools.create_experiment = createExperimentTool(actor);
    tools.allocate_budget = allocateBudgetTool();
    tools.add_media_matrix = addMediaMatrixTool();
    tools.delegate_to_agent = delegateToAgentTool(actor);
    return tools;
  }

  if (agentId === "estratega-oferta") {
    tools.create_objective = createObjectiveTool();
    tools.create_kpi = createKpiTool(actor);
    tools.create_experiment = createExperimentTool(actor);
    tools.add_media_matrix = addMediaMatrixTool();
  }

  if (agentId === "sem-manager") {
    tools.create_sem_plan = createSemPlanTool();
    tools.allocate_budget = allocateBudgetTool();
  }

  if (agentId === "community-manager" || agentId === "copy-lanzamiento") {
    tools.create_calendar_item = createCalendarItemTool(actor);
  }

  if (agentId === "market-researcher") {
    tools.track_competitor = trackCompetitorTool(actor);
  }

  if (agentId === "data-analyst") {
    tools.create_kpi = createKpiTool(actor);
    tools.sql_query = sqlQueryReadonlyTool();
  }

  return tools;
}
