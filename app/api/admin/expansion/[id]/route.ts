import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * PATCH /api/admin/expansion/[id]
 * -------------------------------
 * Actualiza el estado/notas de una oportunidad de expansión.
 *
 * Body:
 *   {
 *     status?: 'new'|'contacted'|'in_conversation'|'won'|'lost'|'snoozed',
 *     lost_reason?: string,           // solo útil cuando status='lost'
 *     snoozed_until?: string (ISO),   // solo útil cuando status='snoozed'
 *     admin_notes?: string,
 *   }
 *
 * Efectos automáticos:
 * - status = 'contacted'        → contacted_at = NOW()  (si estaba null)
 * - status = 'won'              → won_at = NOW()
 * - status = 'snoozed' + snoozed_until null → default +14d
 *
 * DELETE /api/admin/expansion/[id]
 * -------------------------------
 * Elimina una oportunidad (full delete). Usarlo solo para limpiar ruido obvio.
 * Las cerradas como won/lost/snoozed normalmente se dejan para audit trail.
 */

const tag = "[admin/expansion/id]";

const VALID_STATUSES = ["new", "contacted", "in_conversation", "won", "lost", "snoozed"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

interface PatchBody {
  status?: ValidStatus;
  lost_reason?: string | null;
  snoozed_until?: string | null;
  admin_notes?: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sets: string[] = ["updated_at = NOW()"];
  const vals: (string | null)[] = [];
  let idx = 1;

  if (body.status !== undefined) {
    if (!(VALID_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    sets.push(`status = $${idx}`);
    vals.push(body.status);
    idx++;

    if (body.status === "contacted") {
      // Solo actualizar contacted_at si estaba null (preserva first-contact timestamp)
      sets.push(`contacted_at = COALESCE(contacted_at, NOW())`);
    }
    if (body.status === "won") {
      sets.push(`won_at = NOW()`);
    }
    if (body.status === "snoozed") {
      const snoozeUntil = body.snoozed_until ?? null;
      if (snoozeUntil) {
        sets.push(`snoozed_until = $${idx}`);
        vals.push(snoozeUntil);
        idx++;
      } else {
        // Default: snooze 14 días
        sets.push(`snoozed_until = NOW() + INTERVAL '14 days'`);
      }
    }
  } else if (body.snoozed_until !== undefined) {
    // Permitir actualizar snoozed_until sin cambiar status
    sets.push(`snoozed_until = $${idx}`);
    vals.push(body.snoozed_until);
    idx++;
  }

  if (body.lost_reason !== undefined) {
    sets.push(`lost_reason = $${idx}`);
    vals.push(body.lost_reason);
    idx++;
  }

  if (body.admin_notes !== undefined) {
    sets.push(`admin_notes = $${idx}`);
    vals.push(body.admin_notes);
    idx++;
  }

  // Si solo viene `updated_at`, no hay nada real que actualizar
  if (sets.length === 1) {
    return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
  }

  vals.push(id);

  try {
    const { rows } = await query<{ id: string }>(
      `
      UPDATE expansion_opportunities
      SET ${sets.join(", ")}
      WHERE id = $${idx}
      RETURNING id::text
      `,
      vals
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    console.log(
      `${tag} ${session.email} patched id=${id} status=${body.status ?? "-"} note=${body.admin_notes ? "yes" : "no"}`
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} PATCH failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: string }>(
      `DELETE FROM expansion_opportunities WHERE id = $1 RETURNING id::text`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    console.log(`${tag} ${session.email} deleted id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} DELETE failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
