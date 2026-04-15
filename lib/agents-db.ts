/**
 * Capa de persistencia para archivos dinámicos de los agentes de marketing.
 *
 * Los archivos estáticos (CLAUDE.md, agents.md, README.md, memory.md) viven
 * bundleados en `data/flux-marketing/`. Los archivos DINÁMICOS que los agentes
 * escriben cuando corren en el server (briefs, drafts, reports, leads) viven
 * en Postgres en la tabla `marketing_agent_files`.
 *
 * Este módulo NO ejecuta agentes, solo lee/escribe en la DB.
 */

import { query } from "./db";
import type { AgentId } from "./agents";

export interface DbAgentFile {
  id: number;
  agent_id: AgentId;
  rel_path: string;
  content: string;
  size: number;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

let ensuredSchema = false;

/**
 * Crea la tabla si no existe. Se llama idempotentemente antes de cualquier
 * operación para que la primera request en un deploy nuevo la cree.
 */
export async function ensureSchema(): Promise<void> {
  if (ensuredSchema) return;
  await query(`
    CREATE TABLE IF NOT EXISTS marketing_agent_files (
      id BIGSERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL,
      rel_path TEXT NOT NULL,
      content TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT,
      UNIQUE(agent_id, rel_path)
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_agent_files_agent ON marketing_agent_files(agent_id);`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_agent_files_updated ON marketing_agent_files(updated_at DESC);`,
  );
  ensuredSchema = true;
}

export async function listAgentFiles(agentId: AgentId): Promise<DbAgentFile[]> {
  await ensureSchema();
  const res = await query<DbAgentFile>(
    `SELECT id, agent_id, rel_path, content, size, created_at, updated_at, created_by
     FROM marketing_agent_files
     WHERE agent_id = $1
     ORDER BY updated_at DESC`,
    [agentId],
  );
  return res.rows;
}

export async function listAllRecent(limit = 50): Promise<DbAgentFile[]> {
  await ensureSchema();
  const res = await query<DbAgentFile>(
    `SELECT id, agent_id, rel_path, content, size, created_at, updated_at, created_by
     FROM marketing_agent_files
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function readAgentFile(
  agentId: AgentId,
  relPath: string,
): Promise<DbAgentFile | null> {
  await ensureSchema();
  const res = await query<DbAgentFile>(
    `SELECT id, agent_id, rel_path, content, size, created_at, updated_at, created_by
     FROM marketing_agent_files
     WHERE agent_id = $1 AND rel_path = $2`,
    [agentId, relPath],
  );
  return res.rows[0] ?? null;
}

export async function writeAgentFile(
  agentId: AgentId,
  relPath: string,
  content: string,
  createdBy: string | null = null,
): Promise<DbAgentFile> {
  await ensureSchema();
  const size = Buffer.byteLength(content, "utf8");
  const res = await query<DbAgentFile>(
    `INSERT INTO marketing_agent_files (agent_id, rel_path, content, size, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (agent_id, rel_path)
     DO UPDATE SET content = EXCLUDED.content,
                   size = EXCLUDED.size,
                   updated_at = NOW(),
                   created_by = COALESCE(marketing_agent_files.created_by, EXCLUDED.created_by)
     RETURNING id, agent_id, rel_path, content, size, created_at, updated_at, created_by`,
    [agentId, relPath, content, size, createdBy],
  );
  return res.rows[0];
}

export async function deleteAgentFile(agentId: AgentId, relPath: string): Promise<void> {
  await ensureSchema();
  await query(
    `DELETE FROM marketing_agent_files WHERE agent_id = $1 AND rel_path = $2`,
    [agentId, relPath],
  );
}

export async function countAgentFiles(agentId: AgentId): Promise<number> {
  await ensureSchema();
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM marketing_agent_files WHERE agent_id = $1`,
    [agentId],
  );
  return parseInt(res.rows[0]?.count ?? "0", 10);
}
