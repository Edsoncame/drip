import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { modelKey } from "@/lib/inventory";

/**
 * Stock en vivo por slug de producto. Cuenta equipos de ALQUILER "Disponible"
 * agrupados por modelKey(modelo_completo) — misma normalización que el catálogo
 * y el sync de productos (sin mapeos hardcodeados).
 */
export async function GET() {
  try {
    const result = await query<{ modelo_completo: string; disponible: string }>(
      `SELECT modelo_completo,
              COUNT(*) FILTER (WHERE estado_actual = 'Disponible') AS disponible
       FROM equipment
       WHERE COALESCE(tipo, 'alquiler') = 'alquiler'
       GROUP BY modelo_completo`
    );

    const stock: Record<string, number> = {};
    for (const row of result.rows) {
      const slug = modelKey(row.modelo_completo);
      if (slug) stock[slug] = (stock[slug] ?? 0) + parseInt(row.disponible, 10);
    }

    return NextResponse.json(stock, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/stock] DB error:", err);
    return NextResponse.json({}, { status: 500 });
  }
}
