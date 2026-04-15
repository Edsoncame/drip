/**
 * Agent Blockers — sistema de alertas cuando un agente necesita algo
 * que no tiene (env var, API key, credenciales, conexión externa).
 *
 * Los blockers los reporta el propio agente con el tool `report_blocker`
 * cuando detecta que no puede completar una tarea, o los genera
 * automáticamente el detector de env vars en cada tick del autopilot.
 *
 * En la UI aparecen como:
 * - Linterna roja pulsante sobre el avatar que tiene blockers abiertos
 * - Tab nueva en el detail panel con la lista + pasos de solución
 * - Campana global top-right con contador total
 */

import { query } from "./db";
import type { AgentId } from "./agents";

export type BlockerSeverity = "info" | "warning" | "critical";
export type BlockerStatus = "open" | "resolved" | "ignored";

export interface DbBlocker {
  id: number;
  agent_id: AgentId;
  title: string;
  description: string;
  steps_to_fix: string; // markdown
  severity: BlockerSeverity;
  status: BlockerStatus;
  source: string; // "self-report" | "auto-detect" | "user"
  context_key: string | null; // clave única para dedupe (ej: "env:GITHUB_TOKEN")
  created_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
}

let blockerSchemaReady = false;

export async function ensureBlockerSchema(): Promise<void> {
  if (blockerSchemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS marketing_agent_blockers (
      id BIGSERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      steps_to_fix TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      status TEXT NOT NULL DEFAULT 'open',
      source TEXT NOT NULL DEFAULT 'self-report',
      context_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT,
      UNIQUE(agent_id, context_key)
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_agent_blockers_agent ON marketing_agent_blockers(agent_id, status);`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_marketing_agent_blockers_open ON marketing_agent_blockers(status) WHERE status = 'open';`,
  );
  blockerSchemaReady = true;
}

export async function reportBlocker(input: {
  agentId: AgentId;
  title: string;
  description: string;
  stepsToFix: string;
  severity?: BlockerSeverity;
  source?: string;
  contextKey?: string;
}): Promise<DbBlocker> {
  await ensureBlockerSchema();
  // Upsert: si hay un blocker abierto con el mismo contextKey lo re-activa
  // o actualiza description/steps, en vez de crear uno nuevo cada vez.
  const key = input.contextKey ?? `${input.agentId}:${input.title.slice(0, 60)}`;
  const res = await query<DbBlocker>(
    `INSERT INTO marketing_agent_blockers (
       agent_id, title, description, steps_to_fix, severity, source, context_key
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (agent_id, context_key)
     DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       steps_to_fix = EXCLUDED.steps_to_fix,
       severity = EXCLUDED.severity,
       status = 'open',
       resolved_at = NULL,
       resolved_by = NULL
     RETURNING *`,
    [
      input.agentId,
      input.title,
      input.description,
      input.stepsToFix,
      input.severity ?? "warning",
      input.source ?? "self-report",
      key,
    ],
  );
  return res.rows[0];
}

export async function resolveBlocker(
  id: number,
  resolvedBy: string,
): Promise<void> {
  await ensureBlockerSchema();
  await query(
    `UPDATE marketing_agent_blockers
     SET status = 'resolved', resolved_at = NOW(), resolved_by = $2
     WHERE id = $1`,
    [id, resolvedBy],
  );
}

export async function ignoreBlocker(id: number, by: string): Promise<void> {
  await ensureBlockerSchema();
  await query(
    `UPDATE marketing_agent_blockers
     SET status = 'ignored', resolved_at = NOW(), resolved_by = $2
     WHERE id = $1`,
    [id, by],
  );
}

export async function listOpenBlockers(agentId?: AgentId): Promise<DbBlocker[]> {
  await ensureBlockerSchema();
  if (agentId) {
    const res = await query<DbBlocker>(
      `SELECT * FROM marketing_agent_blockers
       WHERE agent_id = $1 AND status = 'open'
       ORDER BY
         CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
         created_at DESC`,
      [agentId],
    );
    return res.rows;
  }
  const res = await query<DbBlocker>(
    `SELECT * FROM marketing_agent_blockers
     WHERE status = 'open'
     ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
       created_at DESC`,
  );
  return res.rows;
}

export async function countOpenBlockersByAgent(): Promise<Record<string, number>> {
  await ensureBlockerSchema();
  const res = await query<{ agent_id: string; count: string }>(
    `SELECT agent_id, COUNT(*)::text AS count
     FROM marketing_agent_blockers
     WHERE status = 'open'
     GROUP BY agent_id`,
  );
  const out: Record<string, number> = {};
  for (const row of res.rows) {
    out[row.agent_id] = parseInt(row.count, 10);
  }
  return out;
}

/**
 * Auto-detección de blockers conocidos (env vars faltantes, credenciales,
 * integraciones que el agente necesita). Se llama al inicio de cada
 * autopilot tick. Si detecta algo nuevo, crea el blocker. Si el user ya
 * configuró el env var, el blocker se auto-resuelve.
 */
export async function autoDetectBlockers(): Promise<{
  detected: number;
  autoResolved: number;
}> {
  await ensureBlockerSchema();

  type Check = {
    agentId: AgentId;
    contextKey: string;
    envVar: string;
    title: string;
    description: string;
    stepsToFix: string;
    severity: BlockerSeverity;
  };

  const checks: Check[] = [
    {
      agentId: "orquestador",
      contextKey: "env:ANTHROPIC_API_KEY",
      envVar: "ANTHROPIC_API_KEY",
      title: "Falta ANTHROPIC_API_KEY",
      description:
        "Sin esta key ningún agente del equipo puede ejecutar tool loops con Claude. Todo el sistema queda parado.",
      stepsToFix: `1. Entrá a https://console.anthropic.com/settings/keys
2. Click "Create Key" → copialo
3. Vercel → drip project → Settings → Environment Variables
4. New variable:
   - Name: \`ANTHROPIC_API_KEY\`
   - Value: la key (empieza con sk-ant-api03-...)
   - Environments: Production, Preview, Development
5. Save y **Redeploy** el último deployment`,
      severity: "critical",
    },
    {
      agentId: "programador-fullstack",
      contextKey: "env:GITHUB_TOKEN",
      envVar: "GITHUB_TOKEN",
      title: "Falta GITHUB_TOKEN — no puedo editar código",
      description:
        "Sin este token no puedo leer ni escribir archivos del repo de FLUX vía GitHub API. Cualquier tarea de código falla inmediato.",
      stepsToFix: `1. Entrá a https://github.com/settings/tokens/new
2. Expiration: 90 días (o lo que prefieras)
3. Scopes (classic): marcá **repo** completo
   O fine-grained: solo el repo Edsoncame/drip con permisos:
   - Contents: Read and write
   - Metadata: Read-only
   - Commit statuses: Read-only
4. Generate token → copialo
5. Vercel → drip → Settings → Environment Variables
6. New variable:
   - Name: \`GITHUB_TOKEN\`
   - Value: el token (empieza con ghp_ o github_pat_)
   - Environments: Production
7. Save y **Redeploy**`,
      severity: "critical",
    },
    {
      agentId: "sem-manager",
      contextKey: "env:META_ADS_ACCESS_TOKEN",
      envVar: "META_ADS_ACCESS_TOKEN",
      title: "Falta META_ADS_ACCESS_TOKEN",
      description:
        "No puedo publicar ni consultar campañas de Meta Ads. Los planes que armo quedan solo en papel.",
      stepsToFix: `1. Entrá al Business Manager de Meta: https://business.facebook.com
2. Acá elegí la página de FLUX
3. Click Settings → Users → System Users → Add System User
   - Name: "FLUX Marketing Agent"
   - Role: Admin
4. Click "Generate New Token" → seleccioná la app → scopes:
   - ads_management
   - business_management
   - read_insights
5. Copiá el token generado (no vence si es system user)
6. Vercel → Environment Variables:
   - Name: \`META_ADS_ACCESS_TOKEN\`
   - Value: el token
7. También necesitás \`META_AD_ACCOUNT_ID\` (es el ID de tu cuenta publicitaria, formato "act_XXXXX")
8. Save y Redeploy`,
      severity: "warning",
    },
    {
      agentId: "sem-manager",
      contextKey: "env:GOOGLE_ADS_DEVELOPER_TOKEN",
      envVar: "GOOGLE_ADS_DEVELOPER_TOKEN",
      title: "Falta GOOGLE_ADS_DEVELOPER_TOKEN",
      description:
        "No puedo publicar ni medir campañas en Google Ads. Los planes quedan solo en papel.",
      stepsToFix: `1. Entrá a https://ads.google.com/aw/apicenter (necesitás cuenta Manager/MCC)
2. Solicitá un developer token — inicialmente es "Test Account Access"
   (para producción hay que aplicar a "Basic Access" con un formulario)
3. Vercel → Environment Variables:
   - \`GOOGLE_ADS_DEVELOPER_TOKEN\` = el token
   - \`GOOGLE_ADS_CLIENT_ID\` = OAuth2 client ID
   - \`GOOGLE_ADS_CLIENT_SECRET\` = OAuth2 secret
   - \`GOOGLE_ADS_REFRESH_TOKEN\` = refresh token (generalo con OAuth Playground)
   - \`GOOGLE_ADS_CUSTOMER_ID\` = tu customer ID sin guiones
4. Save y Redeploy`,
      severity: "warning",
    },
    {
      agentId: "data-analyst",
      contextKey: "env:GA4_MEASUREMENT_ID",
      envVar: "GA4_MEASUREMENT_ID",
      title: "Falta GA4_MEASUREMENT_ID + GA4_API_SECRET",
      description:
        "No puedo mandar eventos server-side al Measurement Protocol ni consultar reports. Dependo solo de GTM client-side.",
      stepsToFix: `1. Entrá a https://analytics.google.com
2. Admin → Data Streams → seleccioná el stream web de fluxperu.com
3. Copiá el **Measurement ID** (formato G-XXXXXXXXXX)
4. En la misma pantalla, abajo: "Measurement Protocol API secrets" → Create
5. Copiá el secret
6. Vercel env vars:
   - \`GA4_MEASUREMENT_ID\` = G-XXXXXXXXXX
   - \`GA4_API_SECRET\` = el secret
7. Save y Redeploy`,
      severity: "info",
    },
    {
      agentId: "seo-specialist",
      contextKey: "env:GOOGLE_SEARCH_CONSOLE_CREDENTIALS",
      envVar: "GOOGLE_SEARCH_CONSOLE_CREDENTIALS",
      title: "Falta GOOGLE_SEARCH_CONSOLE_CREDENTIALS",
      description:
        "No puedo consultar el Search Console API para ver posiciones, impresiones, clicks reales. Trabajo solo con web scraping público.",
      stepsToFix: `1. Entrá a https://console.cloud.google.com
2. API Library → buscá "Search Console API" → Enable
3. Credentials → Create Credentials → Service Account
4. Dale un nombre "flux-seo-agent" → Create
5. En el Service Account → Keys → Add Key → JSON → descargá el JSON
6. Compartí la propiedad de Search Console con el email del service account (permiso "Restringido")
7. Copiá TODO el contenido del JSON (es multilínea)
8. Vercel env vars:
   - Name: \`GOOGLE_SEARCH_CONSOLE_CREDENTIALS\`
   - Value: el JSON completo (Vercel lo acepta como string)
9. Save y Redeploy`,
      severity: "info",
    },
    {
      agentId: "community-manager",
      contextKey: "env:META_GRAPH_ACCESS_TOKEN",
      envVar: "META_GRAPH_ACCESS_TOKEN",
      title: "Falta META_GRAPH_ACCESS_TOKEN",
      description:
        "No puedo publicar posts orgánicos en Instagram/Facebook vía API ni leer métricas de engagement.",
      stepsToFix: `1. Podés usar el mismo token que sem-manager si tiene los permisos correctos
2. Scopes adicionales necesarios para orgánico:
   - instagram_basic
   - instagram_content_publish
   - pages_read_engagement
   - pages_manage_posts
3. También necesitás:
   - \`INSTAGRAM_BUSINESS_ACCOUNT_ID\` (del Business Manager)
   - \`FACEBOOK_PAGE_ID\` de la página de FLUX
4. Vercel env vars con esos 3 valores
5. Save y Redeploy`,
      severity: "info",
    },
  ];

  let detected = 0;
  let autoResolved = 0;

  for (const check of checks) {
    const isSet = !!process.env[check.envVar];
    if (!isSet) {
      // Reportar blocker (upsert por contextKey)
      await reportBlocker({
        agentId: check.agentId,
        title: check.title,
        description: check.description,
        stepsToFix: check.stepsToFix,
        severity: check.severity,
        source: "auto-detect",
        contextKey: check.contextKey,
      });
      detected++;
    } else {
      // Si el env var ahora SÍ está seteado y había un blocker open, lo resolvemos
      const r = await query(
        `UPDATE marketing_agent_blockers
         SET status = 'resolved', resolved_at = NOW(), resolved_by = 'auto-detect'
         WHERE agent_id = $1 AND context_key = $2 AND status = 'open'`,
        [check.agentId, check.contextKey],
      );
      if ((r.rowCount ?? 0) > 0) autoResolved++;
    }
  }

  return { detected, autoResolved };
}
