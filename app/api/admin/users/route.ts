import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

function generatePassword(): string {
  return "Flux" + crypto.randomBytes(4).toString("hex") + "!";
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await query(
    `SELECT id, name, email, created_at, is_admin, is_super_admin
     FROM users WHERE is_admin = true ORDER BY is_super_admin DESC, created_at ASC`
  );
  return NextResponse.json({ users: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!session.isSuperAdmin) return NextResponse.json({ error: "Solo super admin puede crear usuarios" }, { status: 403 });

  const { name, email, isSuperAdmin } = await req.json() as {
    name: string; email: string; isSuperAdmin?: boolean;
  };

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nombre y email requeridos" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query("SELECT id FROM users WHERE LOWER(email) = $1", [normalizedEmail]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  const password = generatePassword();
  const hash = await bcrypt.hash(password, 10);

  await query(
    `INSERT INTO users (name, email, password_hash, is_admin, is_super_admin)
     VALUES ($1, $2, $3, true, $4)`,
    [name.trim(), normalizedEmail, hash, !!isSuperAdmin]
  );

  return NextResponse.json({ email: normalizedEmail, password });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!session.isSuperAdmin) return NextResponse.json({ error: "Solo super admin puede modificar roles" }, { status: 403 });

  const { userId, action } = await req.json() as {
    userId: string; action: "promote" | "demote" | "remove";
  };

  if (!userId || !action) {
    return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  }

  // Prevent self-modification
  const current = await query<{ email: string }>("SELECT email FROM users WHERE id = $1", [userId]);
  if (current.rows[0]?.email.toLowerCase() === session.email.toLowerCase()) {
    return NextResponse.json({ error: "No puedes modificar tu propio rol" }, { status: 400 });
  }

  if (action === "promote") {
    await query("UPDATE users SET is_super_admin = true WHERE id = $1", [userId]);
  } else if (action === "demote") {
    await query("UPDATE users SET is_super_admin = false WHERE id = $1", [userId]);
  } else if (action === "remove") {
    await query("UPDATE users SET is_admin = false, is_super_admin = false WHERE id = $1", [userId]);
  }

  return NextResponse.json({ ok: true });
}
