import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tag = "[subscriptions/cancel]";
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    console.log(`${tag} request user=${session.userId} subscription=${id}`);

    // Verify ownership before cancelling
    const result = await query(
      `SELECT id, status, mp_subscription_id FROM subscriptions WHERE id = $1 AND user_id = $2`,
      [id, session.userId]
    );

    if (result.rows.length === 0) {
      console.warn(`${tag} not found id=${id} user=${session.userId}`);
      return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
    }

    const sub = result.rows[0];

    if (sub.status === "cancelled") {
      return NextResponse.json({ error: "Esta renta ya está cancelada" }, { status: 400 });
    }

    await query(`UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`, [id]);
    console.log(`${tag} cancelled id=${id} user=${session.userId}`);

    // TODO: Cancel in MercadoPago when mp_subscription_id exists
    // if (sub.mp_subscription_id) { await cancelMercadoPagoSubscription(sub.mp_subscription_id); }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
