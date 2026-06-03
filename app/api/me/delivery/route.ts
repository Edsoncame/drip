import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureUserDeliveryColumn, type SavedDelivery } from "@/lib/user-profile";

export const runtime = "nodejs";

/**
 * Guarda el teléfono y la última dirección de entrega del usuario logueado,
 * para prellenarlos en su próximo checkout. Lo llaman los checkouts (compra y
 * alquiler) cuando el usuario continúa al pago.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = (await req.json()) as { phone?: string; delivery?: SavedDelivery };
    await ensureUserDeliveryColumn();

    // Limpia solo los campos de dirección que nos importan.
    const d = body.delivery || {};
    const saved: SavedDelivery = {
      method: d.method, street: d.street, streetNumber: d.streetNumber, distrito: d.distrito,
      reference: d.reference, placeType: d.placeType, apartment: d.apartment, floor: d.floor,
    };
    const phone = body.phone && body.phone.replace(/\D/g, "").length >= 8 ? body.phone : null;

    await query(
      `UPDATE users SET
         phone = COALESCE(NULLIF($2,''), phone),
         saved_delivery = $3::jsonb,
         updated_at = NOW()
       WHERE id = $1`,
      [session.userId, phone, JSON.stringify(saved)],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[me/delivery]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 200 }); // no bloquea el checkout
  }
}
