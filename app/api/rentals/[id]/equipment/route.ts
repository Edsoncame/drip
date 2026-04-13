import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * PATCH /api/rentals/[id]/equipment
 * Allow a client (empresa) to update equipment metadata for their own rental:
 * - colaborador (name of person using the Mac)
 * - area (department)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { colaborador, area } = await req.json() as {
    colaborador?: string;
    area?: string;
  };

  // Verify rental belongs to user and get equipment_code
  const subResult = await query<{ equipment_code: string | null }>(
    "SELECT equipment_code FROM subscriptions WHERE id = $1 AND user_id = $2",
    [id, session.userId]
  );

  if (subResult.rows.length === 0) {
    return NextResponse.json({ error: "Renta no encontrada" }, { status: 404 });
  }

  const equipmentCode = subResult.rows[0].equipment_code;
  if (!equipmentCode) {
    return NextResponse.json({ error: "Sin equipo asignado" }, { status: 400 });
  }

  // Update equipment
  await query(
    `UPDATE equipment SET
      colaborador = COALESCE($2, colaborador),
      area = COALESCE($3, area),
      updated_at = NOW()
    WHERE codigo_interno = $1`,
    [equipmentCode, colaborador ?? null, area ?? null]
  );

  console.log(`[rentals/equipment] user=${session.userId} updated ${equipmentCode}`);
  return NextResponse.json({ ok: true });
}
