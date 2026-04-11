import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/vault";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

async function assertAdmin() {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!await assertAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await query(`SELECT * FROM vault_entries ORDER BY category, nombre`);
  const rows = result.rows.map(r => ({
    ...r,
    password: r.password_enc ? decrypt(r.password_enc) : "",
    password_enc: undefined,
  }));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!await assertAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { category, nombre, url, usuario, password, notas } = await req.json();
  const password_enc = password ? encrypt(password) : null;
  const r = await query(
    `INSERT INTO vault_entries (category, nombre, url, usuario, password_enc, notas)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [category ?? "General", nombre, url ?? null, usuario ?? null, password_enc, notas ?? null]
  );
  return NextResponse.json({ id: r.rows[0].id });
}

export async function PATCH(req: NextRequest) {
  if (!await assertAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id, category, nombre, url, usuario, password, notas } = await req.json();
  const password_enc = password !== undefined ? (password ? encrypt(password) : null) : undefined;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (category  !== undefined) { sets.push(`category=$${i++}`);     vals.push(category); }
  if (nombre    !== undefined) { sets.push(`nombre=$${i++}`);       vals.push(nombre); }
  if (url       !== undefined) { sets.push(`url=$${i++}`);          vals.push(url || null); }
  if (usuario   !== undefined) { sets.push(`usuario=$${i++}`);      vals.push(usuario || null); }
  if (password_enc !== undefined) { sets.push(`password_enc=$${i++}`); vals.push(password_enc); }
  if (notas     !== undefined) { sets.push(`notas=$${i++}`);        vals.push(notas || null); }
  sets.push(`updated_at=NOW()`);
  vals.push(id);
  await query(`UPDATE vault_entries SET ${sets.join(",")} WHERE id=$${i}`, vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!await assertAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await req.json();
  await query(`DELETE FROM vault_entries WHERE id=$1`, [id]);
  return NextResponse.json({ ok: true });
}
