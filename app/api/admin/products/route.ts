import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

interface ProductBody {
  slug: string;
  name: string;
  short_name: string;
  chip: string;
  ram: string;
  ssd: string;
  color: string;
  image_url: string;
  badge?: string | null;
  is_new?: boolean;
  stock: number;
  cost_usd?: number | null;
  pricing: { months: number; price: number }[];
  specs: { label: string; value: string }[];
  includes: string[];
  display_order?: number;
  active?: boolean;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await query(
    `SELECT id, slug, name, short_name, chip, ram, ssd, color, image_url, badge, is_new,
            stock, cost_usd, pricing, specs, includes, display_order, active, created_at, updated_at
     FROM products ORDER BY display_order ASC, created_at ASC`
  );
  return NextResponse.json({ products: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as ProductBody;

  if (!body.slug?.trim() || !body.name?.trim() || !body.image_url?.trim()) {
    return NextResponse.json({ error: "slug, name e image_url son requeridos" }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO products (
        slug, name, short_name, chip, ram, ssd, color, image_url, badge, is_new,
        stock, cost_usd, pricing, specs, includes, display_order, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17)
      RETURNING id, slug`,
      [
        body.slug.trim().toLowerCase(),
        body.name.trim(),
        body.short_name.trim(),
        body.chip,
        body.ram,
        body.ssd,
        body.color,
        body.image_url,
        body.badge ?? null,
        !!body.is_new,
        body.stock ?? 0,
        body.cost_usd ?? null,
        JSON.stringify(body.pricing ?? []),
        JSON.stringify(body.specs ?? []),
        JSON.stringify(body.includes ?? []),
        body.display_order ?? 999,
        body.active !== false,
      ]
    );
    return NextResponse.json({ ok: true, product: result.rows[0] }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (msg.includes("products_slug_key")) {
      return NextResponse.json({ error: "Ya existe un producto con ese slug" }, { status: 409 });
    }
    console.error("[admin/products POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as ProductBody & { id: string };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await query(
    `UPDATE products SET
      slug = $2, name = $3, short_name = $4, chip = $5, ram = $6, ssd = $7,
      color = $8, image_url = $9, badge = $10, is_new = $11,
      stock = $12, cost_usd = $13, pricing = $14::jsonb, specs = $15::jsonb,
      includes = $16::jsonb, display_order = $17, active = $18, updated_at = NOW()
    WHERE id = $1`,
    [
      body.id, body.slug.trim().toLowerCase(), body.name.trim(), body.short_name.trim(),
      body.chip, body.ram, body.ssd, body.color, body.image_url,
      body.badge ?? null, !!body.is_new, body.stock ?? 0, body.cost_usd ?? null,
      JSON.stringify(body.pricing ?? []), JSON.stringify(body.specs ?? []),
      JSON.stringify(body.includes ?? []), body.display_order ?? 999,
      body.active !== false,
    ]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await query(`DELETE FROM products WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
