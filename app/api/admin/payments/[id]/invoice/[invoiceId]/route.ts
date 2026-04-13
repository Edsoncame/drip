import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, invoiceId } = await params;

  // Fetch invoice to get the blob URL before deleting
  const result = await query<{ invoice_url: string }>(
    `SELECT invoice_url FROM payment_invoices WHERE id = $1 AND payment_id = $2`,
    [invoiceId, id]
  );
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  // Delete from Vercel Blob (best-effort)
  try {
    await del(row.invoice_url);
  } catch (err) {
    console.warn("[invoice/delete] blob delete failed (continuing):", err);
  }

  // Delete from DB
  await query(`DELETE FROM payment_invoices WHERE id = $1`, [invoiceId]);

  // If this was the invoice shown in the legacy payments.invoice_url, clear it
  // and set the most recent remaining invoice (if any) as the new pointer
  const remaining = await query<{ invoice_url: string; invoice_number: string }>(
    `SELECT invoice_url, invoice_number FROM payment_invoices
     WHERE payment_id = $1
     ORDER BY uploaded_at DESC LIMIT 1`,
    [id]
  );
  const latest = remaining.rows[0];
  await query(
    `UPDATE payments SET invoice_url = $2, invoice_number = $3 WHERE id = $1`,
    [id, latest?.invoice_url ?? null, latest?.invoice_number ?? null]
  );

  console.log(`[admin/invoice/delete] ${session.email} removed invoice ${invoiceId}`);
  return NextResponse.json({ ok: true });
}
