import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    // Fetch current password hash
    const result = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [session.userId]
    );

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 401 });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, session.userId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json({ error: "Error al cambiar la contraseña. Intenta de nuevo." }, { status: 500 });
  }
}
