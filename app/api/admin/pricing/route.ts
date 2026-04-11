import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

async function checkAdmin() {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) return null;
  return session;
}

export async function GET() {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await query(`SELECT * FROM pricing ORDER BY modelo, plan`);
  return NextResponse.json({ pricing: result.rows });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, precio_usd, residual_pct } = await req.json();
  if (!id || precio_usd == null) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  await query(
    `UPDATE pricing SET precio_usd = $1, residual_pct = $2, updated_at = NOW() WHERE id = $3`,
    [precio_usd, residual_pct ?? null, id]
  );
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { modelo, plan, precio_usd, residual_pct } = await req.json();
  if (!modelo || !plan || precio_usd == null) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO pricing (modelo, plan, precio_usd, residual_pct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (modelo, plan) DO UPDATE SET precio_usd = $3, residual_pct = $4, updated_at = NOW()
     RETURNING *`,
    [modelo, plan, precio_usd, residual_pct ?? null]
  );
  return NextResponse.json({ pricing: result.rows[0] }, { status: 201 });
}
