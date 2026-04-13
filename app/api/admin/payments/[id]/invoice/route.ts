import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { invoiceUrl, invoiceNumber } = await req.json() as {
    invoiceUrl: string;
    invoiceNumber: string;
  };

  await query(
    `UPDATE payments SET
      invoice_url = $2,
      invoice_number = $3,
      invoice_uploaded_at = NOW()
    WHERE id = $1`,
    [id, invoiceUrl, invoiceNumber]
  );

  // Notify client
  const payment = (await query<{
    user_email: string; user_name: string; period_label: string; amount: string;
  }>(
    `SELECT u.email AS user_email, u.name AS user_name, p.period_label, p.amount
     FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [id]
  )).rows[0];

  if (payment) {
    sendEmail({
      to: payment.user_email,
      subject: `📄 Factura disponible — ${payment.period_label}`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">Tu factura está lista</h1>
  <p style="color:#666;margin:0 0 16px">${payment.user_name.split(" ")[0]}, emitimos la factura de tu pago de <strong>${payment.period_label}</strong> por <strong>$${payment.amount} USD</strong>.</p>
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px">
    <p style="color:#999;font-size:12px;margin:0 0 4px">N° de factura</p>
    <p style="font-weight:700;color:#18191F;font-size:18px;margin:0">${invoiceNumber}</p>
  </div>
  <a href="https://www.fluxperu.com/cuenta/pagos" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Ver mi factura</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
    }).catch(() => {});
  }

  console.log(`[admin/invoice] ${session.email} uploaded invoice ${invoiceNumber} for payment ${id}`);
  return NextResponse.json({ ok: true });
}
