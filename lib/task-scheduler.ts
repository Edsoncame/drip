/**
 * Task Scheduler — ejecuta tareas programadas cuando llega su fecha.
 *
 * Se dispara dentro del autopilot tick (cada 10 min mientras el modo 24/7
 * está activo, y manual con el botón). Revisa `marketing_strategy_tasks`
 * por tasks con `scheduled_for <= NOW() AND status = 'pending'` y las
 * ejecuta vía runAgent.
 *
 * Si la task tiene `recurrence_rule`, después de ejecutar crea la próxima
 * instancia siguiendo la regla (WEEKLY:MON:09:00, MONTHLY:1:08:00, etc).
 */

import { runAgent } from "./agent-runner";
import {
  getDueTasks,
  updateTaskStatus,
  createTask,
  type DbTask,
  type TaskPriority,
  type FunnelStage,
} from "./strategy-db";
import type { AgentId } from "./agents";

export interface ScheduledTickResult {
  tickedAt: string;
  checked: number;
  executed: number;
  rescheduled: number;
  results: {
    task_id: number;
    agent: AgentId;
    title: string;
    status: "done" | "failed" | "skipped";
    files: number;
    error?: string;
  }[];
}

/**
 * Calcula la próxima ocurrencia para una recurrence_rule simple.
 *
 * Formatos soportados:
 *   - "DAILY:HH:MM"             → todos los días a HH:MM
 *   - "WEEKLY:DAY:HH:MM"        → cada semana, DAY = MON|TUE|WED|THU|FRI|SAT|SUN
 *   - "MONTHLY:D:HH:MM"         → cada mes, día D (1-31) a HH:MM
 *   - "QUARTERLY:D:HH:MM"       → cada 3 meses, día D
 */
export function nextOccurrence(rule: string, after: Date = new Date()): Date | null {
  const parts = rule.split(":");
  const kind = parts[0];
  const base = new Date(after);
  base.setSeconds(0, 0);

  const parseHHMM = (hh: string, mm: string) => {
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (isNaN(h) || isNaN(m)) return null;
    return { h, m };
  };

  if (kind === "DAILY" && parts.length === 3) {
    const t = parseHHMM(parts[1], parts[2]);
    if (!t) return null;
    const next = new Date(base);
    next.setHours(t.h, t.m, 0, 0);
    if (next <= base) next.setDate(next.getDate() + 1);
    return next;
  }

  if (kind === "WEEKLY" && parts.length === 4) {
    const dayMap: Record<string, number> = {
      SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
    };
    const day = dayMap[parts[1].toUpperCase()];
    if (day === undefined) return null;
    const t = parseHHMM(parts[2], parts[3]);
    if (!t) return null;
    const next = new Date(base);
    next.setHours(t.h, t.m, 0, 0);
    const diff = (day - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + (diff === 0 && next <= base ? 7 : diff));
    return next;
  }

  if (kind === "MONTHLY" && parts.length === 4) {
    const day = parseInt(parts[1], 10);
    const t = parseHHMM(parts[2], parts[3]);
    if (isNaN(day) || !t) return null;
    const next = new Date(base);
    next.setDate(day);
    next.setHours(t.h, t.m, 0, 0);
    if (next <= base) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(day);
    }
    return next;
  }

  if (kind === "QUARTERLY" && parts.length === 4) {
    const day = parseInt(parts[1], 10);
    const t = parseHHMM(parts[2], parts[3]);
    if (isNaN(day) || !t) return null;
    const next = new Date(base);
    next.setDate(day);
    next.setHours(t.h, t.m, 0, 0);
    while (next <= base) {
      next.setMonth(next.getMonth() + 3);
      next.setDate(day);
    }
    return next;
  }

  return null;
}

/**
 * Formatea una task como prompt para pasársela al runner del agente.
 */
function taskToPrompt(task: DbTask): string {
  const parts: string[] = [];
  parts.push(`TAREA PROGRAMADA DE LA ESTRATEGIA — ejecutá AHORA.`);
  parts.push(``);
  parts.push(`**Título:** ${task.title}`);
  if (task.category) parts.push(`**Categoría:** ${task.category}`);
  if (task.estrategia) parts.push(`**Estrategia:** ${task.estrategia}`);
  if (task.funnel_stage) parts.push(`**Funnel stage:** ${task.funnel_stage}`);
  if (task.priority) parts.push(`**Prioridad:** ${task.priority}`);
  if (task.deliverable_type) parts.push(`**Entregable esperado:** ${task.deliverable_type}`);
  if (task.deadline) parts.push(`**Deadline:** ${task.deadline.toISOString()}`);
  parts.push(``);
  if (task.description) {
    parts.push(`## Descripción`);
    parts.push(task.description);
    parts.push(``);
  }
  if (task.comentarios) {
    parts.push(`## Comentarios`);
    parts.push(task.comentarios);
    parts.push(``);
  }
  parts.push(
    `## Protocolo`,
    ``,
    `1. Llamá a \`get_strategy_context\` para ver el estado actual de la estrategia`,
    `2. Ejecutá la tarea usando tus tools (write_file para el deliverable, más los tools de estrategia si aplica)`,
    `3. Si escribís un archivo markdown como deliverable, después llamá a \`mark_task_done\` con task_id=${task.id} y el rel_path del archivo`,
    `4. Respetá el owner y la deadline — no dilates más allá de lo necesario`,
  );
  return parts.join("\n");
}

/**
 * Ejecuta un tick del scheduler: encuentra tareas due, las corre secuencialmente
 * y reprograma las recurrentes. Pensado para correr dentro del autopilot tick o
 * en un cron separado.
 */
export async function runSchedulerTick(opts?: {
  maxTasks?: number;
}): Promise<ScheduledTickResult> {
  const maxTasks = opts?.maxTasks ?? 5;
  const results: ScheduledTickResult["results"] = [];

  const dueTasks = await getDueTasks(maxTasks);
  let rescheduled = 0;

  for (const task of dueTasks) {
    if (!task.owner_agent_id) {
      await updateTaskStatus(task.id, "failed");
      results.push({
        task_id: task.id,
        agent: "orquestador" as AgentId,
        title: task.title,
        status: "failed",
        files: 0,
        error: "sin owner_agent_id asignado",
      });
      continue;
    }

    // Marcar running
    await updateTaskStatus(task.id, "running");

    const run = await runAgent({
      agentId: task.owner_agent_id as AgentId,
      task: taskToPrompt(task),
      actor: `scheduler:task-${task.id}`,
      maxSteps: 8,
      depth: 0,
    });

    const finalStatus = run.success ? "done" : "failed";
    const firstFile = run.filesWritten[0]?.relPath;
    await updateTaskStatus(
      task.id,
      finalStatus,
      firstFile ? `${task.owner_agent_id}/${firstFile}` : undefined,
    );

    results.push({
      task_id: task.id,
      agent: task.owner_agent_id as AgentId,
      title: task.title,
      status: finalStatus,
      files: run.filesWritten.length,
      error: run.error,
    });

    // Si tiene regla de recurrencia, programamos la siguiente instancia
    if (task.recurrence_rule) {
      const next = nextOccurrence(task.recurrence_rule, new Date());
      if (next) {
        await createTask({
          strategy_id: task.strategy_id,
          parent_task_id: null,
          category: task.category,
          estrategia: task.estrategia,
          funnel_stage: task.funnel_stage as FunnelStage | null,
          title: task.title,
          description: task.description,
          owner_agent_id: task.owner_agent_id,
          scheduled_for: next,
          deadline: null,
          status: "pending",
          priority: task.priority as TaskPriority,
          deliverable_type: task.deliverable_type,
          comentarios: task.comentarios,
          recurrence_rule: task.recurrence_rule,
          recurrence_parent_id: task.recurrence_parent_id ?? task.id,
        });
        rescheduled++;
      }
    }
  }

  return {
    tickedAt: new Date().toISOString(),
    checked: dueTasks.length,
    executed: results.filter((r) => r.status === "done").length,
    rescheduled,
    results,
  };
}
