import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface SaleEquipment {
  id: string;
  codigo_interno: string;
  modelo_completo: string;
  chip: string;
  ram: string;
  ssd: string;
  color: string;
  sale_price_usd: number;
  sale_condition: string;
  sale_listed_at: string;
  precio_compra_usd: number | null;
  image_url: string | null;
  slug: string | null;
}

export async function GET() {
  try {
    const result = await query<SaleEquipment>(
      `SELECT
         e.id,
         e.codigo_interno,
         e.modelo_completo,
         e.chip,
         e.ram,
         e.ssd,
         e.color,
         e.sale_price_usd::float AS sale_price_usd,
         COALESCE(e.sale_condition, 'Bueno') AS sale_condition,
         e.sale_listed_at,
         e.precio_compra_usd::float AS precio_compra_usd,
         p.image_url,
         p.slug
       FROM equipment e
       LEFT JOIN products p
         ON e.modelo_completo ILIKE '%' || CASE
           WHEN p.slug = 'macbook-air-13-m4' THEN 'MacBook Air'
           WHEN p.slug = 'macbook-pro-14-m4' THEN 'MacBook Pro%M4'
           WHEN p.slug = 'macbook-pro-14-m5' THEN 'MacBook Pro%M5'
           ELSE p.slug
         END || '%'
       WHERE e.for_sale = true
         AND NOT EXISTS (
           SELECT 1 FROM equipment_sale_orders eso
           WHERE eso.equipment_id = e.id
             AND eso.status NOT IN ('cancelled')
         )
       ORDER BY e.sale_listed_at DESC NULLS LAST`,
      [],
    );

    return NextResponse.json({ equipment: result.rows });
  } catch (err) {
    console.error("[sale-equipment] error", err);
    return NextResponse.json({ error: "Error al cargar equipos" }, { status: 500 });
  }
}
