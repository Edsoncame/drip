import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { SaleEquipment } from "../route";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await query<SaleEquipment>(
      `SELECT
         e.id, e.codigo_interno, e.modelo_completo, e.chip, e.ram, e.ssd, e.color,
         e.teclado,
         e.sale_price_usd::float AS sale_price_usd,
         COALESCE(e.sale_condition, 'Bueno') AS sale_condition,
         e.sale_listed_at,
         e.precio_compra_usd::float AS precio_compra_usd,
         p.image_url, p.slug
       FROM equipment e
       LEFT JOIN products p
         ON e.modelo_completo ILIKE '%' || CASE
           WHEN p.slug = 'macbook-air-13-m1' THEN 'MacBook Air%M1'
           WHEN p.slug = 'macbook-pro-13-m1' THEN 'MacBook Pro%M1'
           WHEN p.slug = 'macbook-air-13-m4' THEN 'MacBook Air%M4'
           WHEN p.slug = 'macbook-pro-14-m4' THEN 'MacBook Pro%M4'
           WHEN p.slug = 'macbook-pro-14-m5' THEN 'MacBook Pro%M5'
           ELSE p.slug
         END || '%'
       WHERE e.id = $1 AND e.for_sale = true
       LIMIT 1`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ equipment: result.rows[0] });
  } catch (err) {
    console.error("[sale-equipment/id] error", err);
    return NextResponse.json({ error: "Error al cargar equipo" }, { status: 500 });
  }
}
