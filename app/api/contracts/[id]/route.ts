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
  // Preferimos legal_name del users (DNI verificado) sobre billing_name (form)
  // para que el contrato siempre tenga el nombre oficial.
  const result = await query<{
    id: string;
    user_id: string | null;
    billing_name: string;
    billing_email: string;
    billing_phone: string;
    billing_company: string;
    billing_ruc: string | null;
    product_name: string;
    months: number;
    monthly_price: string;
    apple_care: boolean;
    delivery_method: string;
    started_at: string;
    ends_at: string;
    legal_name: string | null;
    dni_number_legal: string | null;
  }>(
    `SELECT s.id, s.user_id, s.billing_name, s.billing_email, s.billing_phone,
            s.billing_company, s.billing_ruc, s.product_name, s.months, s.monthly_price,
            s.apple_care, s.delivery_method, s.started_at, s.ends_at,
            u.legal_name, u.dni_number AS dni_number_legal
     FROM subscriptions s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
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

  // Nombre legal del DNI verificado > nombre del form. Para factura/contrato
  // la fuente de verdad es el OCR del DNI, no lo que el usuario digitó.
  const contractName = sub.legal_name ?? sub.billing_name;

  const pdf = await generateContractPdf({
    contractNumber,
    customerName: contractName,
    customerEmail: sub.billing_email,
    customerPhone: sub.billing_phone,
    customerCompany: sub.billing_company,
    customerRuc: sub.billing_ruc,
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
