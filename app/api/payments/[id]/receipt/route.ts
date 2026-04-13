import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const contentType = req.headers.get("content-type") || "";

  let receiptUrl: string;

  try {
    if (contentType.includes("multipart/form-data")) {
      // New flow: file upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
      if (!ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: "Solo JPG, PNG, WebP o PDF" }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "Máximo 10MB" }, { status: 400 });
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `receipts/${id}/${Date.now()}.${ext}`;
      const blob = await put(path, file, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type,
      });
      receiptUrl = blob.url;
    } else {
      // Legacy JSON body
      const body = await req.json() as { receiptUrl: string };
      receiptUrl = body.receiptUrl;
      if (!receiptUrl) return NextResponse.json({ error: "receiptUrl requerido" }, { status: 400 });
    }

    // Verify ownership: user can only upload for their own payments;
    // admins can upload for any payment
    const isAdminUser = !!(await requireAdmin());
    if (!isAdminUser) {
      const result = await query(
        "SELECT id FROM payments WHERE id = $1 AND user_id = $2",
        [id, session.userId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
      }
    } else {
      const result = await query("SELECT id FROM payments WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
      }
    }

    await query(
      `UPDATE payments SET
        receipt_url = $2,
        receipt_uploaded_at = NOW(),
        status = 'reviewing'
      WHERE id = $1`,
      [id, receiptUrl]
    );

    console.log(`[payments/receipt] ${session.email} uploaded receipt for payment=${id}`);
    return NextResponse.json({ ok: true, receiptUrl });
  } catch (err) {
    console.error("[payments/receipt] error", err);
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
