import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { receiptUrl } = await req.json() as { receiptUrl: string };

  // Verify payment belongs to user
  const result = await query(
    "SELECT id FROM payments WHERE id = $1 AND user_id = $2",
    [id, session.userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  await query(
    `UPDATE payments SET
      receipt_url = $2,
      receipt_uploaded_at = NOW(),
      status = 'reviewing'
    WHERE id = $1`,
    [id, receiptUrl]
  );

  console.log(`[payments/receipt] user=${session.userId} uploaded receipt for payment=${id}`);

  return NextResponse.json({ ok: true });
}
