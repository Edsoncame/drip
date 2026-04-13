import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const contentType = req.headers.get("content-type") || "";

  let invoiceUrl: string;
  let invoiceNumber: string;
  let amount: number | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      // New path: file upload via FormData
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      invoiceNumber = (formData.get("invoiceNumber") as string || "").trim();
      const amountStr = formData.get("amount") as string | null;
      amount = amountStr ? parseFloat(amountStr) : null;

      if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
      if (!invoiceNumber) return NextResponse.json({ error: "N° de factura requerido" }, { status: 400 });
      if (!ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: "Solo PDF o imagen (JPG/PNG/WebP)" }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "El archivo no debe superar 15MB" }, { status: 400 });
      }

      const ext = file.name.split(".").pop() || "pdf";
      const safeNum = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = `invoices/${id}/${safeNum}-${Date.now()}.${ext}`;
      const blob = await put(path, file, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type,
      });
      invoiceUrl = blob.url;
    } else {
      // Legacy JSON path (backwards compat)
      const body = await req.json() as { invoiceUrl: string; invoiceNumber: string; amount?: number };
      invoiceUrl = body.invoiceUrl;
      invoiceNumber = body.invoiceNumber;
      amount = body.amount ?? null;
      if (!invoiceUrl || !invoiceNumber) {
        return NextResponse.json({ error: "invoiceUrl e invoiceNumber requeridos" }, { status: 400 });
      }
    }

    // Insert into payment_invoices table (supports multiple per payment)
    await query(
      `INSERT INTO payment_invoices (payment_id, invoice_number, invoice_url, amount, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, invoiceNumber, invoiceUrl, amount, session.email]
    );

    // Also update main payment record (for backward compat + quick access)
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
        subject: `Factura disponible — ${payment.period_label}`,
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
    return NextResponse.json({ ok: true, invoiceNumber, invoiceUrl });
  } catch (err) {
    console.error("[admin/invoice] error", err);
    const msg = err instanceof Error ? err.message : "Error al subir factura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
