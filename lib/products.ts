import { query } from "./db";

export interface Product {
  slug: string;
  name: string;
  shortName: string;
  chip: string;
  ram: string;
  ssd: string;
  color: string;
  image: string;
  badge?: string;
  isNew?: boolean;
  stock: number; // 0 = agotado, 1-3 = últimas unidades, 4+ = disponible
  pricing: {
    months: number;
    price: number;
  }[];
  specs: { label: string; value: string }[];
  includes: string[];
}

interface DbRow {
  slug: string;
  name: string;
  short_name: string;
  chip: string;
  ram: string;
  ssd: string;
  color: string;
  image_url: string;
  badge: string | null;
  is_new: boolean;
  stock: number;
  pricing: { months: number; price: number }[];
  specs: { label: string; value: string }[];
  includes: string[];
}

function rowToProduct(r: DbRow): Product {
  return {
    slug: r.slug,
    name: r.name,
    shortName: r.short_name,
    chip: r.chip,
    ram: r.ram,
    ssd: r.ssd,
    color: r.color,
    image: r.image_url,
    badge: r.badge ?? undefined,
    isNew: r.is_new,
    stock: r.stock,
    pricing: r.pricing,
    specs: r.specs,
    includes: r.includes,
  };
}

export async function getProducts(): Promise<Product[]> {
  const res = await query<DbRow>(
    `SELECT slug, name, short_name, chip, ram, ssd, color, image_url, badge, is_new, stock, pricing, specs, includes
     FROM products
     WHERE active = true
     ORDER BY display_order ASC, created_at ASC`
  );
  return res.rows.map(rowToProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const res = await query<DbRow>(
    `SELECT slug, name, short_name, chip, ram, ssd, color, image_url, badge, is_new, stock, pricing, specs, includes
     FROM products
     WHERE slug = $1 AND active = true
     LIMIT 1`,
    [slug]
  );
  const row = res.rows[0];
  return row ? rowToProduct(row) : null;
}
