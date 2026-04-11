import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Maps DB modelo values to product slugs
const MODEL_TO_SLUG: Record<string, string> = {
  "MacBook Air 13\" M4":   "macbook-air-13-m4",
  "MacBook Air M4":        "macbook-air-13-m4",
  "MacBook Pro 14\" M4":   "macbook-pro-14-m4",
  "MacBook Pro M4":        "macbook-pro-14-m4",
  "MacBook Pro 14\" M5":   "macbook-pro-14-m5",
  "MacBook Pro M5":        "macbook-pro-14-m5",
};

export async function GET() {
  try {
    const result = await query(
      `SELECT modelo, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE estado_actual = 'Disponible') AS disponible
       FROM equipment
       GROUP BY modelo`
    );

    const stock: Record<string, number> = {};
    for (const row of result.rows) {
      const slug = MODEL_TO_SLUG[row.modelo];
      if (slug) {
        stock[slug] = parseInt(row.disponible, 10);
      }
    }

    return NextResponse.json(stock, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/stock] DB error:", err);
    return NextResponse.json({}, { status: 500 });
  }
}
