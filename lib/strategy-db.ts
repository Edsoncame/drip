/**
 * Strategy Engine — capa de persistencia.
 *
 * Schema basado 1:1 en los templates reales que Edson compartió:
 * - estrategia.xlsx (Securex) → marketing_strategies + funnels + experiments
 * - pauta2.xlsx (PROYECCIÓN) → objectives + budget + media matrix + competitors
 * - parrilla.xlsx → content_calendar
 * - funnel1/funnel2 → tasks (con structure exacta N° / Category / Estrategia / Tarea / Deadline / Responsable / Status / Prioridad / Comentarios)
 * - sem.xlsx → sem_plans con 21 columnas del plan de medios
 *
 * Todas las tablas se auto-crean en el primer request vía ensureStrategySchema().
 */

import { query } from "./db";

export type StrategyStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type FunnelStage =
  | "awareness"
  | "consideracion"
  | "acquisition"
  | "activation"
  | "retention"
  | "revenue"
  | "referral";
export type TaskStatus = "pending" | "running" | "done" | "failed" | "skipped" | "overdue";
export type TaskPriority = "alta" | "media" | "baja";
export type ExperimentStatus =
  | "idea"
  | "priorizado"
  | "en_ejecucion"
  | "completado"
  | "descartado"
  | "fallido";
export type ContentEstado = "borrador" | "aprobado" | "publicado" | "cancelado";
export type KpiStatus = "on_track" | "at_risk" | "off_track" | "achieved";
export type ReportType = "weekly" | "monthly" | "quarterly" | "adhoc" | "experiment" | "launch";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DbStrategy {
  id: number;
  name: string;
  slug: string;
  status: StrategyStatus;
  start_date: Date;
  end_date: Date;
  duration_months: number | null;
  rubro: string | null;
  descripcion: string | null;
  canales: string[] | null;
  publico_descripcion: string | null;
  arquetipos: { nombre: string; tipo: string; verbatim?: string }[] | null;
  mision: string | null;
  vision: string | null;
  territorio_marca: string | null;
  valores_marca: string[] | null;
  plan_crecimiento: string | null;
  north_star_metric: string | null;
  meta_global_descripcion: string | null;
  meta_global_valor: string | null;
  posicionamiento: Record<string, string> | null;
  document_md: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface DbObjective {
  id: number;
  strategy_id: number;
  funnel_stage: FunnelStage;
  objetivo_general: string | null;
  objetivo_especifico: string | null;
  desafios: string[] | null;
  canales: string[] | null;
  estrategia_txt: string | null;
  tacticas: string[] | null;
  kpis: { nombre: string; target_value?: number; unit?: string; period?: string }[] | null;
  metricas_seguimiento: string[] | null;
  herramientas: string[] | null;
  responsable_agent: string | null;
  created_at: Date;
}

export interface DbKpi {
  id: number;
  strategy_id: number;
  objective_id: number | null;
  name: string;
  funnel_stage: FunnelStage | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  period: string | null;
  formula: string | null;
  status: KpiStatus;
  last_updated_at: Date | null;
  last_updated_by: string | null;
  created_at: Date;
}

export interface DbTask {
  id: number;
  strategy_id: number;
  parent_task_id: number | null;
  category: string | null;
  estrategia: string | null;
  funnel_stage: FunnelStage | null;
  title: string;
  description: string | null;
  owner_agent_id: string | null;
  scheduled_for: Date | null;
  deadline: Date | null;
  status: TaskStatus;
  priority: TaskPriority;
  deliverable_type: string | null;
  output_file_path: string | null;
  output_run_id: number | null;
  executed_at: Date | null;
  comentarios: string | null;
  recurrence_rule: string | null;
  recurrence_parent_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbExperiment {
  id: number;
  strategy_id: number;
  codigo: string | null;
  semana: string | null;
  ranking: number | null;
  nombre: string;
  funnel_stage: FunnelStage | null;
  objetivo: string | null;
  hipotesis: string | null;
  metodo: string | null;
  recursos: string | null;
  detalles: string | null;
  audiencia_objetivo: string | null;
  metricas_a_atacar: string | null;
  criterio_exito: string | null;
  criterio_fracaso: string | null;
  puntaje_total: number | null;
  probabilidad: number | null;
  impacto: number | null;
  ease: number | null;
  voter_scores: Record<string, { probabilidad: number; impacto: number; ease: number }> | null;
  hacker_agent_id: string | null;
  status: ExperimentStatus;
  acciones: { numero: number; descripcion: string }[] | null;
  resultado_texto: string | null;
  resultado_metricas: Record<string, number> | null;
  exitoso: boolean | null;
  comentarios: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbContentCalendar {
  id: number;
  strategy_id: number;
  fecha_publicacion: Date;
  hora_publicacion: string | null;
  canal: string;
  formato: string | null;
  segmento: string | null;
  canjean: string | null;
  tema: string | null;
  contenido_text: string | null;
  contenido_brief: string | null;
  area: string | null;
  owner_agent_id: string | null;
  fecha_aprobacion: Date | null;
  estado: ContentEstado;
  comentarios: string | null;
  asset_urls: string[] | null;
  task_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbSemPlan {
  id: number;
  strategy_id: number;
  periodo: string;
  campana: string;
  medio: string;
  objetivo: string | null;
  formato: string | null;
  segmentacion: string | null;
  duracion: string | null;
  tipo_compra: string | null;
  alcance_estimado: number | null;
  impresiones_estimadas: number | null;
  interacciones_estimadas: number | null;
  clics_estimados: number | null;
  visualizaciones_estimadas: number | null;
  registros_mensuales_por_pauta: number | null;
  registros_diarios_por_pauta: number | null;
  transacciones_mensuales_por_pauta: number | null;
  transacciones_diarias_por_pauta: number | null;
  ctr_er: number | null;
  cpr: number | null;
  inversion_usd: number | null;
  inversion_pen: number | null;
  soi_pct: number | null;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  status: string;
  created_at: Date;
}

export interface DbBudget {
  id: number;
  strategy_id: number;
  canal: string;
  period_type: "weekly" | "monthly" | "quarterly";
  period_number: number;
  period_year: number;
  amount_usd: number;
  amount_pen: number | null;
  actual_spent_usd: number;
  status: string;
  notes: string | null;
  created_at: Date;
}

export interface DbCompetitor {
  id: number;
  strategy_id: number | null;
  competitor_name: string;
  ubicacion: string | null;
  servicios: string[] | null;
  canales_comunicacion: string[] | null;
  promociones: string[] | null;
  operaciones_inmediatas: string[] | null;
  operaciones_interbancarias: string[] | null;
  trayectoria: string | null;
  notas_adicionales: string | null;
  last_analyzed_at: Date | null;
  analyzed_by_agent: string | null;
  created_at: Date;
}

export interface DbMediaMatrix {
  id: number;
  strategy_id: number;
  tipo_media: "PAID MEDIA" | "OWNED MEDIA" | "EARNED MEDIA";
  detalle: string | null;
  medios: string | null;
  canales_especificos: string | null;
  embudo: string | null;
  cupon_nombre: string | null;
  cupon_valor: string | null;
  cupon_usos: string | null;
  owner: string | null;
  notas: string | null;
  created_at: Date;
}

export interface DbReport {
  id: number;
  strategy_id: number;
  report_type: ReportType;
  period_start: Date | null;
  period_end: Date | null;
  week_number: number | null;
  title: string;
  executive_summary: string | null;
  content_md: string;
  kpis_snapshot: { name: string; target: number; current: number; delta: number }[] | null;
  experiments_summary: Record<string, unknown> | null;
  tasks_summary: { completed: number; pending: number; overdue: number } | null;
  recommendations_md: string | null;
  next_steps_md: string | null;
  generated_at: Date;
  generated_by: string | null;
  seen_by_user: boolean;
  pinned: boolean;
}

export interface DbAttachment {
  id: number;
  strategy_id: number | null;
  kind: string;
  title: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  blob_url: string | null;
  parsed_text: string | null;
  uploaded_at: Date;
  uploaded_by: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Schema setup
// ═══════════════════════════════════════════════════════════════════════════

let schemaReady = false;

export async function ensureStrategySchema(): Promise<void> {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategies (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      duration_months INTEGER,
      rubro TEXT,
      descripcion TEXT,
      canales JSONB,
      publico_descripcion TEXT,
      arquetipos JSONB,
      mision TEXT,
      vision TEXT,
      territorio_marca TEXT,
      valores_marca JSONB,
      plan_crecimiento TEXT,
      north_star_metric TEXT,
      meta_global_descripcion TEXT,
      meta_global_valor TEXT,
      posicionamiento JSONB,
      document_md TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategies_status ON marketing_strategies(status);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_objectives (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      funnel_stage TEXT NOT NULL,
      objetivo_general TEXT,
      objetivo_especifico TEXT,
      desafios JSONB,
      canales JSONB,
      estrategia_txt TEXT,
      tacticas JSONB,
      kpis JSONB,
      metricas_seguimiento JSONB,
      herramientas JSONB,
      responsable_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_objectives_strategy ON marketing_strategy_objectives(strategy_id);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_kpis (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      objective_id BIGINT REFERENCES marketing_strategy_objectives(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      funnel_stage TEXT,
      target_value NUMERIC,
      current_value NUMERIC DEFAULT 0,
      unit TEXT,
      period TEXT,
      formula TEXT,
      status TEXT NOT NULL DEFAULT 'on_track',
      last_updated_at TIMESTAMPTZ,
      last_updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_kpis_strategy ON marketing_strategy_kpis(strategy_id);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_kpi_snapshots (
      id BIGSERIAL PRIMARY KEY,
      kpi_id BIGINT NOT NULL REFERENCES marketing_strategy_kpis(id) ON DELETE CASCADE,
      value NUMERIC NOT NULL,
      snapshot_date DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_tasks (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      parent_task_id BIGINT REFERENCES marketing_strategy_tasks(id) ON DELETE SET NULL,
      category TEXT,
      estrategia TEXT,
      funnel_stage TEXT,
      title TEXT NOT NULL,
      description TEXT,
      owner_agent_id TEXT,
      scheduled_for TIMESTAMPTZ,
      deadline TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT DEFAULT 'media',
      deliverable_type TEXT,
      output_file_path TEXT,
      output_run_id BIGINT,
      executed_at TIMESTAMPTZ,
      comentarios TEXT,
      recurrence_rule TEXT,
      recurrence_parent_id BIGINT REFERENCES marketing_strategy_tasks(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_tasks_scheduled ON marketing_strategy_tasks(scheduled_for) WHERE status = 'pending';`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_tasks_owner ON marketing_strategy_tasks(owner_agent_id, status);`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_tasks_strategy ON marketing_strategy_tasks(strategy_id, status);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_experiments (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      codigo TEXT,
      semana TEXT,
      ranking INTEGER,
      nombre TEXT NOT NULL,
      funnel_stage TEXT,
      objetivo TEXT,
      hipotesis TEXT,
      metodo TEXT,
      recursos TEXT,
      detalles TEXT,
      audiencia_objetivo TEXT,
      metricas_a_atacar TEXT,
      criterio_exito TEXT,
      criterio_fracaso TEXT,
      puntaje_total NUMERIC,
      probabilidad NUMERIC,
      impacto NUMERIC,
      ease NUMERIC,
      voter_scores JSONB,
      hacker_agent_id TEXT,
      status TEXT NOT NULL DEFAULT 'idea',
      acciones JSONB,
      resultado_texto TEXT,
      resultado_metricas JSONB,
      exitoso BOOLEAN,
      comentarios TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_experiments_strategy ON marketing_strategy_experiments(strategy_id);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_content_calendar (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      fecha_publicacion DATE NOT NULL,
      hora_publicacion TIME,
      canal TEXT NOT NULL,
      formato TEXT,
      segmento TEXT,
      canjean TEXT,
      tema TEXT,
      contenido_text TEXT,
      contenido_brief TEXT,
      area TEXT,
      owner_agent_id TEXT,
      fecha_aprobacion DATE,
      estado TEXT NOT NULL DEFAULT 'borrador',
      comentarios TEXT,
      asset_urls JSONB,
      task_id BIGINT REFERENCES marketing_strategy_tasks(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_content_calendar_fecha ON marketing_content_calendar(fecha_publicacion);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_sem_plans (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      periodo TEXT NOT NULL,
      campana TEXT NOT NULL,
      medio TEXT NOT NULL,
      objetivo TEXT,
      formato TEXT,
      segmentacion TEXT,
      duracion TEXT,
      tipo_compra TEXT,
      alcance_estimado NUMERIC,
      impresiones_estimadas NUMERIC,
      interacciones_estimadas NUMERIC,
      clics_estimados NUMERIC,
      visualizaciones_estimadas NUMERIC,
      registros_mensuales_por_pauta NUMERIC,
      registros_diarios_por_pauta NUMERIC,
      transacciones_mensuales_por_pauta NUMERIC,
      transacciones_diarias_por_pauta NUMERIC,
      ctr_er NUMERIC,
      cpr NUMERIC,
      inversion_usd NUMERIC,
      inversion_pen NUMERIC,
      soi_pct NUMERIC,
      fecha_inicio DATE,
      fecha_fin DATE,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_budget (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      canal TEXT NOT NULL,
      period_type TEXT NOT NULL,
      period_number INTEGER NOT NULL,
      period_year INTEGER NOT NULL,
      amount_usd NUMERIC NOT NULL,
      amount_pen NUMERIC,
      actual_spent_usd NUMERIC DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'allocated',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_budget_strategy ON marketing_strategy_budget(strategy_id);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_competitor_benchmarks (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT REFERENCES marketing_strategies(id) ON DELETE SET NULL,
      competitor_name TEXT NOT NULL,
      ubicacion TEXT,
      servicios JSONB,
      canales_comunicacion JSONB,
      promociones JSONB,
      operaciones_inmediatas JSONB,
      operaciones_interbancarias JSONB,
      trayectoria TEXT,
      notas_adicionales TEXT,
      last_analyzed_at TIMESTAMPTZ,
      analyzed_by_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_media_matrix (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      tipo_media TEXT NOT NULL,
      detalle TEXT,
      medios TEXT,
      canales_especificos TEXT,
      embudo TEXT,
      cupon_nombre TEXT,
      cupon_valor TEXT,
      cupon_usos TEXT,
      owner TEXT,
      notas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_reports (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT NOT NULL REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL,
      period_start DATE,
      period_end DATE,
      week_number INTEGER,
      title TEXT NOT NULL,
      executive_summary TEXT,
      content_md TEXT NOT NULL,
      kpis_snapshot JSONB,
      experiments_summary JSONB,
      tasks_summary JSONB,
      recommendations_md TEXT,
      next_steps_md TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      generated_by TEXT,
      seen_by_user BOOLEAN DEFAULT FALSE,
      pinned BOOLEAN DEFAULT FALSE
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_strategy_reports_strategy ON marketing_strategy_reports(strategy_id, generated_at DESC);`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS marketing_strategy_attachments (
      id BIGSERIAL PRIMARY KEY,
      strategy_id BIGINT REFERENCES marketing_strategies(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT,
      size_bytes INTEGER,
      blob_url TEXT,
      parsed_text TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      uploaded_by TEXT
    );
  `);

  schemaReady = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Strategies
// ═══════════════════════════════════════════════════════════════════════════

export async function createStrategy(
  input: Omit<DbStrategy, "id" | "created_at" | "updated_at"> & { duration_months?: number | null },
): Promise<DbStrategy> {
  await ensureStrategySchema();
  const res = await query<DbStrategy>(
    `INSERT INTO marketing_strategies (
      name, slug, status, start_date, end_date, duration_months,
      rubro, descripcion, canales, publico_descripcion, arquetipos,
      mision, vision, territorio_marca, valores_marca, plan_crecimiento,
      north_star_metric, meta_global_descripcion, meta_global_valor,
      posicionamiento, document_md, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING *`,
    [
      input.name,
      input.slug,
      input.status,
      input.start_date,
      input.end_date,
      input.duration_months ?? null,
      input.rubro,
      input.descripcion,
      input.canales ? JSON.stringify(input.canales) : null,
      input.publico_descripcion,
      input.arquetipos ? JSON.stringify(input.arquetipos) : null,
      input.mision,
      input.vision,
      input.territorio_marca,
      input.valores_marca ? JSON.stringify(input.valores_marca) : null,
      input.plan_crecimiento,
      input.north_star_metric,
      input.meta_global_descripcion,
      input.meta_global_valor,
      input.posicionamiento ? JSON.stringify(input.posicionamiento) : null,
      input.document_md,
      input.created_by,
    ],
  );
  return res.rows[0];
}

export async function getStrategy(id: number): Promise<DbStrategy | null> {
  await ensureStrategySchema();
  const res = await query<DbStrategy>(`SELECT * FROM marketing_strategies WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function getStrategyBySlug(slug: string): Promise<DbStrategy | null> {
  await ensureStrategySchema();
  const res = await query<DbStrategy>(`SELECT * FROM marketing_strategies WHERE slug = $1`, [slug]);
  return res.rows[0] ?? null;
}

export async function getActiveStrategy(): Promise<DbStrategy | null> {
  await ensureStrategySchema();
  const res = await query<DbStrategy>(
    `SELECT * FROM marketing_strategies WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
  );
  return res.rows[0] ?? null;
}

export async function listStrategies(): Promise<DbStrategy[]> {
  await ensureStrategySchema();
  const res = await query<DbStrategy>(
    `SELECT * FROM marketing_strategies ORDER BY created_at DESC`,
  );
  return res.rows;
}

export async function updateStrategyStatus(id: number, status: StrategyStatus): Promise<void> {
  await ensureStrategySchema();
  await query(
    `UPDATE marketing_strategies SET status = $2, updated_at = NOW() WHERE id = $1`,
    [id, status],
  );
}

export async function updateStrategyDocument(id: number, documentMd: string): Promise<void> {
  await ensureStrategySchema();
  await query(
    `UPDATE marketing_strategies SET document_md = $2, updated_at = NOW() WHERE id = $1`,
    [id, documentMd],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Objectives
// ═══════════════════════════════════════════════════════════════════════════

export async function createObjective(
  input: Omit<DbObjective, "id" | "created_at">,
): Promise<DbObjective> {
  await ensureStrategySchema();
  const res = await query<DbObjective>(
    `INSERT INTO marketing_strategy_objectives (
      strategy_id, funnel_stage, objetivo_general, objetivo_especifico,
      desafios, canales, estrategia_txt, tacticas, kpis,
      metricas_seguimiento, herramientas, responsable_agent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      input.strategy_id,
      input.funnel_stage,
      input.objetivo_general,
      input.objetivo_especifico,
      input.desafios ? JSON.stringify(input.desafios) : null,
      input.canales ? JSON.stringify(input.canales) : null,
      input.estrategia_txt,
      input.tacticas ? JSON.stringify(input.tacticas) : null,
      input.kpis ? JSON.stringify(input.kpis) : null,
      input.metricas_seguimiento ? JSON.stringify(input.metricas_seguimiento) : null,
      input.herramientas ? JSON.stringify(input.herramientas) : null,
      input.responsable_agent,
    ],
  );
  return res.rows[0];
}

export async function listObjectives(strategyId: number): Promise<DbObjective[]> {
  await ensureStrategySchema();
  const res = await query<DbObjective>(
    `SELECT * FROM marketing_strategy_objectives WHERE strategy_id = $1 ORDER BY id`,
    [strategyId],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// KPIs
// ═══════════════════════════════════════════════════════════════════════════

export async function createKpi(input: Omit<DbKpi, "id" | "created_at" | "current_value"> & { current_value?: number }): Promise<DbKpi> {
  await ensureStrategySchema();
  const res = await query<DbKpi>(
    `INSERT INTO marketing_strategy_kpis (
      strategy_id, objective_id, name, funnel_stage, target_value, current_value,
      unit, period, formula, status, last_updated_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      input.strategy_id,
      input.objective_id,
      input.name,
      input.funnel_stage,
      input.target_value,
      input.current_value ?? 0,
      input.unit,
      input.period,
      input.formula,
      input.status,
      input.last_updated_by,
    ],
  );
  return res.rows[0];
}

export async function updateKpi(
  id: number,
  value: number,
  actor: string,
  note?: string,
): Promise<void> {
  await ensureStrategySchema();
  await query(
    `UPDATE marketing_strategy_kpis
     SET current_value = $2, last_updated_at = NOW(), last_updated_by = $3
     WHERE id = $1`,
    [id, value, actor],
  );
  await query(
    `INSERT INTO marketing_strategy_kpi_snapshots (kpi_id, value, snapshot_date, note, created_by)
     VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
    [id, value, note ?? null, actor],
  );
}

export async function listKpis(strategyId: number): Promise<DbKpi[]> {
  await ensureStrategySchema();
  const res = await query<DbKpi>(
    `SELECT * FROM marketing_strategy_kpis WHERE strategy_id = $1 ORDER BY funnel_stage, id`,
    [strategyId],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tasks
// ═══════════════════════════════════════════════════════════════════════════

export async function createTask(
  input: Omit<DbTask, "id" | "created_at" | "updated_at" | "output_file_path" | "output_run_id" | "executed_at">,
): Promise<DbTask> {
  await ensureStrategySchema();
  const res = await query<DbTask>(
    `INSERT INTO marketing_strategy_tasks (
      strategy_id, parent_task_id, category, estrategia, funnel_stage,
      title, description, owner_agent_id, scheduled_for, deadline,
      status, priority, deliverable_type, comentarios,
      recurrence_rule, recurrence_parent_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [
      input.strategy_id,
      input.parent_task_id,
      input.category,
      input.estrategia,
      input.funnel_stage,
      input.title,
      input.description,
      input.owner_agent_id,
      input.scheduled_for,
      input.deadline,
      input.status,
      input.priority,
      input.deliverable_type,
      input.comentarios,
      input.recurrence_rule,
      input.recurrence_parent_id,
    ],
  );
  return res.rows[0];
}

export async function getDueTasks(limit = 10): Promise<DbTask[]> {
  await ensureStrategySchema();
  const res = await query<DbTask>(
    `SELECT * FROM marketing_strategy_tasks
     WHERE status = 'pending' AND scheduled_for IS NOT NULL AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function getUpcomingTasks(strategyId: number, days = 14): Promise<DbTask[]> {
  await ensureStrategySchema();
  const res = await query<DbTask>(
    `SELECT * FROM marketing_strategy_tasks
     WHERE strategy_id = $1 AND status = 'pending'
       AND scheduled_for BETWEEN NOW() AND NOW() + ($2::int || ' days')::interval
     ORDER BY scheduled_for ASC`,
    [strategyId, days],
  );
  return res.rows;
}

export async function updateTaskStatus(
  id: number,
  status: TaskStatus,
  outputFilePath?: string,
  runId?: number,
): Promise<void> {
  await ensureStrategySchema();
  await query(
    `UPDATE marketing_strategy_tasks
     SET status = $2,
         executed_at = CASE WHEN $2 IN ('done','failed','skipped') THEN NOW() ELSE executed_at END,
         output_file_path = COALESCE($3, output_file_path),
         output_run_id = COALESCE($4, output_run_id),
         updated_at = NOW()
     WHERE id = $1`,
    [id, status, outputFilePath ?? null, runId ?? null],
  );
}

export async function listTasks(strategyId: number, status?: TaskStatus): Promise<DbTask[]> {
  await ensureStrategySchema();
  if (status) {
    const res = await query<DbTask>(
      `SELECT * FROM marketing_strategy_tasks WHERE strategy_id = $1 AND status = $2 ORDER BY scheduled_for ASC NULLS LAST, id`,
      [strategyId, status],
    );
    return res.rows;
  }
  const res = await query<DbTask>(
    `SELECT * FROM marketing_strategy_tasks WHERE strategy_id = $1 ORDER BY scheduled_for ASC NULLS LAST, id`,
    [strategyId],
  );
  return res.rows;
}

export async function getTasksSummary(strategyId: number): Promise<{
  completed: number;
  pending: number;
  overdue: number;
  running: number;
  failed: number;
}> {
  await ensureStrategySchema();
  const res = await query<{
    status: TaskStatus;
    count: string;
  }>(
    `SELECT status, COUNT(*)::text AS count
     FROM marketing_strategy_tasks
     WHERE strategy_id = $1
     GROUP BY status`,
    [strategyId],
  );
  const out = { completed: 0, pending: 0, overdue: 0, running: 0, failed: 0 };
  for (const row of res.rows) {
    const n = parseInt(row.count, 10);
    if (row.status === "done") out.completed = n;
    else if (row.status === "pending") out.pending = n;
    else if (row.status === "overdue") out.overdue = n;
    else if (row.status === "running") out.running = n;
    else if (row.status === "failed") out.failed = n;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Experiments
// ═══════════════════════════════════════════════════════════════════════════

export async function createExperiment(
  input: Omit<DbExperiment, "id" | "created_at" | "updated_at">,
): Promise<DbExperiment> {
  await ensureStrategySchema();
  const res = await query<DbExperiment>(
    `INSERT INTO marketing_strategy_experiments (
      strategy_id, codigo, semana, ranking, nombre, funnel_stage,
      objetivo, hipotesis, metodo, recursos, detalles,
      audiencia_objetivo, metricas_a_atacar, criterio_exito, criterio_fracaso,
      puntaje_total, probabilidad, impacto, ease, voter_scores,
      hacker_agent_id, status, acciones, resultado_texto, resultado_metricas,
      exitoso, comentarios
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    RETURNING *`,
    [
      input.strategy_id,
      input.codigo,
      input.semana,
      input.ranking,
      input.nombre,
      input.funnel_stage,
      input.objetivo,
      input.hipotesis,
      input.metodo,
      input.recursos,
      input.detalles,
      input.audiencia_objetivo,
      input.metricas_a_atacar,
      input.criterio_exito,
      input.criterio_fracaso,
      input.puntaje_total,
      input.probabilidad,
      input.impacto,
      input.ease,
      input.voter_scores ? JSON.stringify(input.voter_scores) : null,
      input.hacker_agent_id,
      input.status,
      input.acciones ? JSON.stringify(input.acciones) : null,
      input.resultado_texto,
      input.resultado_metricas ? JSON.stringify(input.resultado_metricas) : null,
      input.exitoso,
      input.comentarios,
    ],
  );
  return res.rows[0];
}

export async function listExperiments(strategyId: number): Promise<DbExperiment[]> {
  await ensureStrategySchema();
  const res = await query<DbExperiment>(
    `SELECT * FROM marketing_strategy_experiments WHERE strategy_id = $1 ORDER BY puntaje_total DESC NULLS LAST, ranking`,
    [strategyId],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// Content Calendar
// ═══════════════════════════════════════════════════════════════════════════

export async function createContentItem(
  input: Omit<DbContentCalendar, "id" | "created_at" | "updated_at">,
): Promise<DbContentCalendar> {
  await ensureStrategySchema();
  const res = await query<DbContentCalendar>(
    `INSERT INTO marketing_content_calendar (
      strategy_id, fecha_publicacion, hora_publicacion, canal, formato,
      segmento, canjean, tema, contenido_text, contenido_brief,
      area, owner_agent_id, fecha_aprobacion, estado, comentarios,
      asset_urls, task_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [
      input.strategy_id,
      input.fecha_publicacion,
      input.hora_publicacion,
      input.canal,
      input.formato,
      input.segmento,
      input.canjean,
      input.tema,
      input.contenido_text,
      input.contenido_brief,
      input.area,
      input.owner_agent_id,
      input.fecha_aprobacion,
      input.estado,
      input.comentarios,
      input.asset_urls ? JSON.stringify(input.asset_urls) : null,
      input.task_id,
    ],
  );
  return res.rows[0];
}

export async function listContentByMonth(
  strategyId: number,
  year: number,
  month: number,
): Promise<DbContentCalendar[]> {
  await ensureStrategySchema();
  const res = await query<DbContentCalendar>(
    `SELECT * FROM marketing_content_calendar
     WHERE strategy_id = $1
       AND EXTRACT(YEAR FROM fecha_publicacion) = $2
       AND EXTRACT(MONTH FROM fecha_publicacion) = $3
     ORDER BY fecha_publicacion, hora_publicacion`,
    [strategyId, year, month],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEM Plans
// ═══════════════════════════════════════════════════════════════════════════

export async function createSemPlan(
  input: Omit<DbSemPlan, "id" | "created_at">,
): Promise<DbSemPlan> {
  await ensureStrategySchema();
  const res = await query<DbSemPlan>(
    `INSERT INTO marketing_sem_plans (
      strategy_id, periodo, campana, medio, objetivo, formato, segmentacion,
      duracion, tipo_compra, alcance_estimado, impresiones_estimadas,
      interacciones_estimadas, clics_estimados, visualizaciones_estimadas,
      registros_mensuales_por_pauta, registros_diarios_por_pauta,
      transacciones_mensuales_por_pauta, transacciones_diarias_por_pauta,
      ctr_er, cpr, inversion_usd, inversion_pen, soi_pct,
      fecha_inicio, fecha_fin, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
    RETURNING *`,
    [
      input.strategy_id, input.periodo, input.campana, input.medio,
      input.objetivo, input.formato, input.segmentacion, input.duracion,
      input.tipo_compra, input.alcance_estimado, input.impresiones_estimadas,
      input.interacciones_estimadas, input.clics_estimados, input.visualizaciones_estimadas,
      input.registros_mensuales_por_pauta, input.registros_diarios_por_pauta,
      input.transacciones_mensuales_por_pauta, input.transacciones_diarias_por_pauta,
      input.ctr_er, input.cpr, input.inversion_usd, input.inversion_pen, input.soi_pct,
      input.fecha_inicio, input.fecha_fin, input.status,
    ],
  );
  return res.rows[0];
}

export async function listSemPlans(strategyId: number): Promise<DbSemPlan[]> {
  await ensureStrategySchema();
  const res = await query<DbSemPlan>(
    `SELECT * FROM marketing_sem_plans WHERE strategy_id = $1 ORDER BY periodo, campana`,
    [strategyId],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// Budget
// ═══════════════════════════════════════════════════════════════════════════

export async function createBudgetLine(
  input: Omit<DbBudget, "id" | "created_at" | "actual_spent_usd">,
): Promise<DbBudget> {
  await ensureStrategySchema();
  const res = await query<DbBudget>(
    `INSERT INTO marketing_strategy_budget (
      strategy_id, canal, period_type, period_number, period_year,
      amount_usd, amount_pen, status, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      input.strategy_id, input.canal, input.period_type,
      input.period_number, input.period_year,
      input.amount_usd, input.amount_pen, input.status, input.notes,
    ],
  );
  return res.rows[0];
}

export async function listBudget(strategyId: number): Promise<DbBudget[]> {
  await ensureStrategySchema();
  const res = await query<DbBudget>(
    `SELECT * FROM marketing_strategy_budget WHERE strategy_id = $1 ORDER BY period_year, period_number, canal`,
    [strategyId],
  );
  return res.rows;
}

export async function totalBudgetUsd(strategyId: number): Promise<number> {
  await ensureStrategySchema();
  const res = await query<{ total: string | null }>(
    `SELECT COALESCE(SUM(amount_usd), 0)::text AS total FROM marketing_strategy_budget WHERE strategy_id = $1`,
    [strategyId],
  );
  return parseFloat(res.rows[0]?.total ?? "0");
}

// ═══════════════════════════════════════════════════════════════════════════
// Reports
// ═══════════════════════════════════════════════════════════════════════════

export async function createReport(
  input: Omit<DbReport, "id" | "generated_at" | "seen_by_user" | "pinned">,
): Promise<DbReport> {
  await ensureStrategySchema();
  const res = await query<DbReport>(
    `INSERT INTO marketing_strategy_reports (
      strategy_id, report_type, period_start, period_end, week_number,
      title, executive_summary, content_md, kpis_snapshot,
      experiments_summary, tasks_summary, recommendations_md, next_steps_md,
      generated_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      input.strategy_id, input.report_type, input.period_start, input.period_end,
      input.week_number, input.title, input.executive_summary, input.content_md,
      input.kpis_snapshot ? JSON.stringify(input.kpis_snapshot) : null,
      input.experiments_summary ? JSON.stringify(input.experiments_summary) : null,
      input.tasks_summary ? JSON.stringify(input.tasks_summary) : null,
      input.recommendations_md, input.next_steps_md, input.generated_by,
    ],
  );
  return res.rows[0];
}

export async function listReports(strategyId: number, limit = 20): Promise<DbReport[]> {
  await ensureStrategySchema();
  const res = await query<DbReport>(
    `SELECT * FROM marketing_strategy_reports WHERE strategy_id = $1 ORDER BY generated_at DESC LIMIT $2`,
    [strategyId, limit],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// Attachments
// ═══════════════════════════════════════════════════════════════════════════

export async function createAttachment(
  input: Omit<DbAttachment, "id" | "uploaded_at">,
): Promise<DbAttachment> {
  await ensureStrategySchema();
  const res = await query<DbAttachment>(
    `INSERT INTO marketing_strategy_attachments (
      strategy_id, kind, title, filename, content_type, size_bytes,
      blob_url, parsed_text, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      input.strategy_id, input.kind, input.title, input.filename,
      input.content_type, input.size_bytes, input.blob_url,
      input.parsed_text, input.uploaded_by,
    ],
  );
  return res.rows[0];
}

export async function listAttachments(
  strategyId: number | null,
  kind?: string,
): Promise<DbAttachment[]> {
  await ensureStrategySchema();
  if (strategyId === null && kind) {
    const res = await query<DbAttachment>(
      `SELECT * FROM marketing_strategy_attachments WHERE kind = $1 ORDER BY uploaded_at DESC`,
      [kind],
    );
    return res.rows;
  }
  if (strategyId === null) {
    const res = await query<DbAttachment>(
      `SELECT * FROM marketing_strategy_attachments ORDER BY uploaded_at DESC LIMIT 50`,
    );
    return res.rows;
  }
  if (kind) {
    const res = await query<DbAttachment>(
      `SELECT * FROM marketing_strategy_attachments WHERE (strategy_id = $1 OR strategy_id IS NULL) AND kind = $2 ORDER BY uploaded_at DESC`,
      [strategyId, kind],
    );
    return res.rows;
  }
  const res = await query<DbAttachment>(
    `SELECT * FROM marketing_strategy_attachments WHERE strategy_id = $1 OR strategy_id IS NULL ORDER BY uploaded_at DESC`,
    [strategyId],
  );
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// Competitors + Media Matrix (compactos)
// ═══════════════════════════════════════════════════════════════════════════

export async function createCompetitor(
  input: Omit<DbCompetitor, "id" | "created_at">,
): Promise<DbCompetitor> {
  await ensureStrategySchema();
  const res = await query<DbCompetitor>(
    `INSERT INTO marketing_competitor_benchmarks (
      strategy_id, competitor_name, ubicacion, servicios, canales_comunicacion,
      promociones, operaciones_inmediatas, operaciones_interbancarias,
      trayectoria, notas_adicionales, last_analyzed_at, analyzed_by_agent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      input.strategy_id, input.competitor_name, input.ubicacion,
      input.servicios ? JSON.stringify(input.servicios) : null,
      input.canales_comunicacion ? JSON.stringify(input.canales_comunicacion) : null,
      input.promociones ? JSON.stringify(input.promociones) : null,
      input.operaciones_inmediatas ? JSON.stringify(input.operaciones_inmediatas) : null,
      input.operaciones_interbancarias ? JSON.stringify(input.operaciones_interbancarias) : null,
      input.trayectoria, input.notas_adicionales, input.last_analyzed_at, input.analyzed_by_agent,
    ],
  );
  return res.rows[0];
}

export async function createMediaMatrixLine(
  input: Omit<DbMediaMatrix, "id" | "created_at">,
): Promise<DbMediaMatrix> {
  await ensureStrategySchema();
  const res = await query<DbMediaMatrix>(
    `INSERT INTO marketing_media_matrix (
      strategy_id, tipo_media, detalle, medios, canales_especificos,
      embudo, cupon_nombre, cupon_valor, cupon_usos, owner, notas
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      input.strategy_id, input.tipo_media, input.detalle, input.medios,
      input.canales_especificos, input.embudo, input.cupon_nombre,
      input.cupon_valor, input.cupon_usos, input.owner, input.notas,
    ],
  );
  return res.rows[0];
}
