import { NextRequest, NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { generateContractPdf } from "@/lib/contract-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const isAdmin = !!(await requireAdmin());

  // Users can only download their own contracts; admins can download any
  const result = await query<{
    id: string;
    user_id: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    customer_company: string;
    customer_ruc: string | null;
    product_name: string;
    months: number;
    monthly_price: string;
    apple_care: boolean;
    delivery_method: string;
    started_at: string;
    ends_at: string;
  }>(
    `SELECT id, user_id, customer_name, customer_email, customer_phone,
            customer_company, customer_ruc, product_name, months, monthly_price,
            apple_care, delivery_method, started_at, ends_at
     FROM subscriptions WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  const sub = result.rows[0];

  if (!isAdmin && sub.user_id !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const year = new Date(sub.started_at).getFullYear();
  const seq = sub.id.slice(0, 8).toUpperCase();
  const contractNumber = `FLUX-${year}-${seq}`;

  const pdf = await generateContractPdf({
    contractNumber,
    customerName: sub.customer_name,
    customerEmail: sub.customer_email,
    customerPhone: sub.customer_phone,
    customerCompany: sub.customer_company,
    customerRuc: sub.customer_ruc,
    productName: sub.product_name,
    months: sub.months,
    monthlyPrice: parseFloat(sub.monthly_price),
    appleCare: sub.apple_care ?? false,
    deliveryMethod: sub.delivery_method ?? "shipping",
    startDate: new Date(sub.started_at),
    endDate: new Date(sub.ends_at),
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${contractNumber}.pdf"`,
    },
  });
}
