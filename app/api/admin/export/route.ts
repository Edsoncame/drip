import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

const tag = "[admin/export]";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    console.warn(`${tag} unauthorized access attempt`);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  console.log(`${tag} CSV export requested by ${session.email}`);

  const result = await query<{
    id: string; user_name: string; user_email: string;
    product_name: string; months: number; monthly_price: string;
    status: string; started_at: string; ends_at: string | null;
    billing_name: string; billing_email: string;
    billing_phone: string; billing_company: string; billing_ruc: string;
    apple_care: boolean;
  }>(`
    SELECT s.id, u.name AS user_name, u.email AS user_email,
           s.product_name, s.months, s.monthly_price, s.status,
           s.started_at, s.ends_at,
           s.billing_name, s.billing_email, s.billing_phone,
           s.billing_company, s.billing_ruc, s.apple_care
    FROM subscriptions s
    LEFT JOIN users u ON u.id = s.user_id
    ORDER BY s.started_at DESC
  `);

  const headers = [
    "ID", "Usuario", "Email usuario", "Producto", "Meses", "$/mes",
    "Estado", "Inicio", "Vence", "Cliente", "Email cliente",
    "Teléfono", "Empresa", "RUC", "AppleCare+",
  ];

  const rows = result.rows.map(r => [
    r.id,
    r.user_name ?? "",
    r.user_email ?? "",
    r.product_name,
    r.months,
    r.monthly_price,
    r.status,
    r.started_at ? new Date(r.started_at).toISOString().split("T")[0] : "",
    r.ends_at ? new Date(r.ends_at).toISOString().split("T")[0] : "",
    r.billing_name ?? "",
    r.billing_email ?? "",
    r.billing_phone ?? "",
    r.billing_company ?? "",
    r.billing_ruc ?? "",
    r.apple_care ? "Sí" : "No",
  ]);

  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [headers, ...rows]
    .map(row => row.map(escape).join(","))
    .join("\n");

  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flux-rentas-${date}.csv"`,
    },
  });
}
