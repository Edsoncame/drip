import { upsertExpense } from "@/lib/finance-providers";
import { query } from "@/lib/db";

/**
 * Auto-pullers para proveedores externos.
 *
 * Cada puller:
 *   - recibe un period "YYYY-MM"
 *   - intenta leer del proveedor externo
 *   - upserta en finance_expenses con un source único (p. ej. "vercel-auto")
 *   - es idempotente: correr 2× el mismo mes actualiza el monto, no duplica
 *
 * Si falla (token no seteado, API error), loggea warning y devuelve null.
 * El admin sigue pudiendo cargar el monto manualmente.
 */

const tag = "[finance-pullers]";

function monthRange(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // último día del mes
  return { from, to };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERCEL — usage endpoint (mismo que usa el CLI `vercel usage`)
// ═══════════════════════════════════════════════════════════════════════════

interface VercelUsageResponse {
  services?: Array<{
    name: string;
    slug?: string;
    cost?: { billed?: number; effective?: number; usd?: number };
    billedCost?: number;
    effectiveCost?: number;
  }>;
  totals?: { billedCost?: number; effectiveCost?: number };
}

export async function pullVercelUsage(period: string): Promise<{
  vercel_usd: number;
  blob_usd: number;
} | null> {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) {
    console.warn(`${tag} VERCEL_API_TOKEN no seteado — skip pull`);
    return null;
  }

  const { from, to } = monthRange(period);
  const url = new URL("https://api.vercel.com/v1/usage");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`${tag} vercel pull HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as VercelUsageResponse;

    // Sumar hosting (todo menos blob) vs blob
    let hostingUsd = 0;
    let blobUsd = 0;
    for (const svc of data.services ?? []) {
      const cost = svc.cost?.billed ?? svc.cost?.usd ?? svc.billedCost ?? svc.effectiveCost ?? 0;
      const name = (svc.slug ?? svc.name ?? "").toLowerCase();
      if (name.includes("blob")) blobUsd += cost;
      else hostingUsd += cost;
    }

    // Upsert ambos con source específico
    if (hostingUsd > 0) {
      await upsertExpense({
        provider_slug: "vercel",
        period,
        amount_usd: Math.round(hostingUsd * 100) / 100,
        source: "vercel-auto",
        notes: `Auto-pull Vercel API (${from} → ${to})`,
      });
    }
    if (blobUsd > 0) {
      await upsertExpense({
        provider_slug: "vercel-blob",
        period,
        amount_usd: Math.round(blobUsd * 100) / 100,
        source: "vercel-auto",
        notes: `Auto-pull Vercel Blob (${from} → ${to})`,
      });
    }

    console.log(`${tag} vercel period=${period} hosting=$${hostingUsd} blob=$${blobUsd}`);
    return { vercel_usd: hostingUsd, blob_usd: blobUsd };
  } catch (err) {
    console.error(`${tag} vercel pull error`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE — invoices que Flux PAGÓ (no las que emitió a clientes)
// Para capturar facturas de Stripe Atlas + otros SaaS que cobren vía Stripe.
// ═══════════════════════════════════════════════════════════════════════════

export async function pullStripeReceivedInvoices(period: string): Promise<{
  atlas_usd: number;
  count: number;
} | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn(`${tag} STRIPE_SECRET_KEY no seteado — skip`);
    return null;
  }

  const { from } = monthRange(period);
  const [y, m] = period.split("-").map(Number);
  const gte = Math.floor(new Date(Date.UTC(y, m - 1, 1)).getTime() / 1000);
  const lt = Math.floor(new Date(Date.UTC(y, m, 1)).getTime() / 1000);

  try {
    // Stripe tiene "/v1/invoices" pero son las que VOS emitiste.
    // Los charges que Stripe Inc te hizo van por /v1/charges en la cuenta Atlas,
    // visible como "balance transactions" de tipo 'atlas_fee' o similar.
    // Best effort: leer balance_transactions negativas del mes.
    const params = new URLSearchParams({
      "created[gte]": String(gte),
      "created[lt]": String(lt),
      limit: "100",
    });
    const res = await fetch(
      `https://api.stripe.com/v1/balance_transactions?${params}`,
      { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) {
      console.warn(`${tag} stripe balance_transactions HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      data: Array<{ id: string; type: string; amount: number; description?: string; net: number }>;
    };

    // Filtrar sólo las que son cobros de Stripe a nosotros (no revenues)
    // Típicamente: stripe_fee, atlas_*, issuing_*
    const atlasLike = data.data.filter((t) => {
      const d = (t.description ?? "").toLowerCase();
      const kind = t.type.toLowerCase();
      return (
        kind.includes("atlas") ||
        d.includes("atlas") ||
        d.includes("delaware") ||
        d.includes("franchise") ||
        kind === "stripe_fee" // backup si cobran como fee genérico
      );
    });

    // Los amounts vienen en cents. Valores NEGATIVOS son cobros hacia nosotros.
    let totalCents = 0;
    for (const t of atlasLike) {
      if (t.amount < 0) totalCents += Math.abs(t.amount);
    }
    const totalUsd = totalCents / 100;

    if (totalUsd > 0) {
      await upsertExpense({
        provider_slug: "stripe-atlas",
        period,
        amount_usd: Math.round(totalUsd * 100) / 100,
        source: "stripe-auto",
        notes: `Auto-pull Stripe balance_transactions (${atlasLike.length} tx desde ${from})`,
      });
    }

    console.log(`${tag} stripe-atlas period=${period} total=$${totalUsd} tx=${atlasLike.length}`);
    return { atlas_usd: totalUsd, count: atlasLike.length };
  } catch (err) {
    console.error(`${tag} stripe pull error`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS — providers que exceden typical_monthly_usd × threshold
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Devuelve los proveedores que gastaron más de threshold× su typical del mes.
 * Idempotencia diaria: escribe una fila en finance_alerts_log con el timestamp
 * para no mandar el mismo alert 2× el mismo día.
 */
export async function checkBudgetAlerts(opts?: {
  threshold?: number;
  period?: string;
  dryRun?: boolean;
}): Promise<Array<{ provider_slug: string; name: string; spent_usd: number; typical_usd: number; ratio: number }>> {
  const threshold = opts?.threshold ?? 1.5;
  const now = new Date();
  const period =
    opts?.period ??
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const { getFinanceSnapshot } = await import("@/lib/finance-providers");
  const snapshot = await getFinanceSnapshot(period);

  const alerts: Array<{ provider_slug: string; name: string; spent_usd: number; typical_usd: number; ratio: number }> = [];
  for (const row of snapshot.rows) {
    const typical = parseFloat(row.provider.typical_monthly_usd ?? "0");
    if (!typical || typical <= 0) continue;
    const spent = row.total_usd;
    if (spent > typical * threshold) {
      alerts.push({
        provider_slug: row.provider.slug,
        name: row.provider.name,
        spent_usd: Math.round(spent * 100) / 100,
        typical_usd: typical,
        ratio: Math.round((spent / typical) * 100) / 100,
      });
    }
  }

  if (alerts.length === 0 || opts?.dryRun) return alerts;

  // Dedupe diario: para cada alert, chequear si ya mandamos hoy
  await ensureAlertsLogTable();
  const today = new Date().toISOString().slice(0, 10);
  const toSend: typeof alerts = [];
  for (const a of alerts) {
    const key = `budget:${a.provider_slug}:${period}:${today}`;
    const existing = await query(
      `SELECT 1 FROM finance_alerts_log WHERE alert_key = $1 LIMIT 1`,
      [key],
    );
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO finance_alerts_log (alert_key, provider_slug, period, spent_usd, typical_usd)
         VALUES ($1,$2,$3,$4,$5)`,
        [key, a.provider_slug, period, a.spent_usd, a.typical_usd],
      );
      toSend.push(a);
    }
  }

  if (toSend.length > 0) {
    const { sendEmail } = await import("@/lib/email");
    const rowsHtml = toSend.map(a =>
      `<tr>
        <td style="padding:6px 8px"><strong>${a.name}</strong></td>
        <td style="padding:6px 8px;text-align:right;color:#DC2626">$${a.spent_usd.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:right;color:#666">$${a.typical_usd.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:right"><strong>${(a.ratio * 100).toFixed(0)}%</strong></td>
      </tr>`
    ).join("");

    await sendEmail({
      to: process.env.ADMIN_EMAILS?.split(",")[0] ?? "hola@fluxperu.com",
      subject: `⚠️ Budget alert — ${toSend.length} proveedor${toSend.length > 1 ? "es" : ""} excedieron ${threshold}× su presupuesto`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;border-radius:16px">
  <h2 style="color:#DC2626;margin:0 0 16px">⚠️ Gasto por encima del presupuesto</h2>
  <p style="color:#666;margin:0 0 16px">Período: <strong>${period}</strong></p>
  <table style="width:100%;font-size:13px;border-collapse:collapse">
    <thead style="background:#F7F7F7">
      <tr>
        <th style="padding:8px;text-align:left">Proveedor</th>
        <th style="padding:8px;text-align:right">Gastado</th>
        <th style="padding:8px;text-align:right">Esperado</th>
        <th style="padding:8px;text-align:right">Ratio</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="color:#666;font-size:12px;margin-top:16px">
    Ver detalles en <a href="https://www.fluxperu.com/admin/finanzas" style="color:#1B4FFF">/admin/finanzas</a>.
  </p>
  <p style="color:#999;font-size:11px;margin-top:16px">
    Alerta automática — threshold ${threshold}× de typical_monthly_usd.
  </p>
</div>`,
    }).catch((err) => console.error(`${tag} alert email failed`, err));

    console.log(`${tag} sent ${toSend.length} budget alerts`);
  }

  return alerts;
}

async function ensureAlertsLogTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS finance_alerts_log (
      id            BIGSERIAL PRIMARY KEY,
      alert_key     TEXT UNIQUE NOT NULL,
      provider_slug VARCHAR(50) NOT NULL,
      period        CHAR(7) NOT NULL,
      spent_usd     NUMERIC(10,2) NOT NULL,
      typical_usd   NUMERIC(10,2) NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
