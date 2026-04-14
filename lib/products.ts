/**
 * Lectura del catálogo público de FLUX desde la base de datos.
 *
 * Antes este archivo era un array hardcoded con los 3 modelos. Ahora todo
 * vive en la tabla `products` (gestionada desde `/admin/productos`), y los
 * server components la leen mediante `getProducts()` o `getProduct(slug)`.
 *
 * Para client components hay un wrapper en `lib/use-products.ts` que llama
 * al endpoint público `/api/products` y cachea el resultado en memoria.
 */

import { query } from "./db";

/**
 * Forma del producto que esperan todos los componentes del frontend.
 * Mapea uno-a-uno a las columnas de la tabla `products`, con algunos campos
 * renombrados a camelCase (ej. `image_url` → `image`).
 */
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

/** Forma cruda de la fila de Postgres (snake_case). */
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

/** Convierte una fila snake_case del DB al shape camelCase del frontend. */
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

/**
 * Devuelve todos los productos activos ordenados por `display_order`.
 * Solo incluye los que tienen `active = true` (los demás están ocultos).
 */
export async function getProducts(): Promise<Product[]> {
  const res = await query<DbRow>(
    `SELECT slug, name, short_name, chip, ram, ssd, color, image_url, badge, is_new, stock, pricing, specs, includes
     FROM products
     WHERE active = true
     ORDER BY display_order ASC, created_at ASC`
  );
  return res.rows.map(rowToProduct);
}

/**
 * Busca un producto por su slug (URL-friendly).
 * Devuelve null si no existe o si está marcado como inactivo.
 *
 * @example
 *   const product = await getProduct("macbook-air-13-m4");
 */
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
