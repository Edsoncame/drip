/**
 * Drop Chat — Sync del catálogo de productos de Flux.
 *
 * Envía los 4 modelos de MacBook a Drop Chat para que su IAn (bot de WhatsApp)
 * cotice en tiempo real con precios y stock reales.
 *
 * Un SKU por modelo de MacBook (no por plan) — el bot puede preguntar al
 * cliente cuál plan (8/16/24 meses) prefiere después. Los 3 precios quedan
 * en custom_fields para que IAn los lea.
 *
 * Endpoints:
 *   POST /api/v1/sync/product   (individual)
 *   POST /api/v1/sync/products  (batch hasta 2000)
 */

import { query } from "@/lib/db";

const API_URL =
  process.env.DROPCHAT_API_URL?.replace(/\/$/, "") ??
  "https://omni-platform-api-production.up.railway.app";

const tag = "[dropchat-catalog]";

export interface DropchatProduct {
  sku: string;
  name: string;
  price: number;
  stock: number;
  custom_fields?: Record<string, unknown>;
}

interface PricingRow {
  months: number;
  price: number;
}

interface ProductRow {
  id: string;
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
  cost_usd: string | null;
  specs: unknown;
  includes: unknown;
  pricing: PricingRow[];
  active: boolean;
  live_available: string; // count(equipment estado='Disponible') por modelo
}

/**
 * Lee productos + stock en vivo del inventario real (equipment).
 * Hace best-effort match de products.slug contra equipment.modelo_completo
 * usando la chip como key (Air M4 → M4, Pro M5 → M5).
 */
async function loadProducts(): Promise<ProductRow[]> {
  const res = await query<ProductRow>(
    `SELECT p.id, p.slug, p.name, p.short_name, p.chip, p.ram, p.ssd, p.color,
            p.image_url, p.badge, p.is_new, p.stock, p.cost_usd::text,
            p.specs, p.includes, p.pricing, p.active,
            COALESCE((
              SELECT COUNT(*)::text
              FROM equipment e
              WHERE e.estado_actual = 'Disponible'
                AND lower(e.modelo_completo) LIKE '%' || lower(split_part(p.name, '—', 2)) || '%'
            ), '0') AS live_available
     FROM products p
     WHERE p.active = true
     ORDER BY p.display_order`,
  );
  return res.rows;
}

/**
 * Convierte un ProductRow al payload Drop Chat.
 * SKU = slug del producto (estable, único, lowercase).
 * Precio principal = plan de 16 meses (el más común en Flux).
 */
export function toDropchatProduct(p: ProductRow): DropchatProduct {
  const plans = Array.isArray(p.pricing) ? p.pricing : [];
  const plan8  = plans.find((x) => x.months === 8);
  const plan16 = plans.find((x) => x.months === 16);
  const plan24 = plans.find((x) => x.months === 24);

  const mainPrice = plan16?.price ?? plan8?.price ?? plan24?.price ?? 0;

  // Stock: usamos count de equipment.estado='Disponible' si hay; fallback al p.stock configurado
  const liveStock = parseInt(p.live_available, 10);
  const stock = liveStock > 0 ? liveStock : p.stock;

  return {
    sku: p.slug,
    name: p.name,
    price: mainPrice,
    stock,
    custom_fields: {
      // Metadatos del producto — IAn puede personalizar respuestas
      currency: "USD",
      billing_cycle: "monthly",
      type: "rental",
      category: "MacBook",
      brand: "Apple",
      chip: p.chip,
      ram: p.ram,
      ssd: p.ssd,
      color: p.color,
      is_new: p.is_new,
      badge: p.badge,
      image_url: p.image_url,
      product_url: `https://www.fluxperu.com/laptops/${p.slug}`,
      // Pricing por plan — IAn cotiza el que el cliente pida
      price_8m_usd: plan8?.price ?? null,
      price_16m_usd: plan16?.price ?? null,
      price_24m_usd: plan24?.price ?? null,
      // Derivados útiles para campañas
      total_plans: plans.length,
      min_monthly_price: Math.min(...plans.map((x) => x.price).filter((n) => n > 0)),
      max_monthly_price: Math.max(...plans.map((x) => x.price).filter((n) => n > 0)),
      // Source tag
      source: "flux",
    },
  };
}

/**
 * Fire-and-forget — usado por los hooks de admin/productos y admin/precios.
 * Nunca throws.
 */
export function fireSyncCatalog(): Promise<void> {
  if (!process.env.DROPCHAT_API_KEY) return Promise.resolve();
  return syncAllProducts()
    .then((r) => {
      if (!r.ok) console.warn(`${tag} fire sync err=${r.errors[0]?.error}`);
    })
    .catch((err) => console.warn(`${tag} fire sync error`, err));
}

/**
 * Sync individual — util para cuando se edita UN producto.
 */
export async function syncProduct(slug: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.DROPCHAT_API_KEY;
  if (!apiKey) return { ok: false, error: "DROPCHAT_API_KEY no seteado" };

  const res = await query<ProductRow>(
    `SELECT p.id, p.slug, p.name, p.short_name, p.chip, p.ram, p.ssd, p.color,
            p.image_url, p.badge, p.is_new, p.stock, p.cost_usd::text,
            p.specs, p.includes, p.pricing, p.active,
            '0' AS live_available
     FROM products p
     WHERE p.slug = $1`,
    [slug],
  );
  if (res.rows.length === 0) return { ok: false, error: "product not found" };
  const payload = toDropchatProduct(res.rows[0]);

  try {
    const r = await fetch(`${API_URL}/api/v1/sync/product`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `HTTP ${r.status}: ${t.slice(0, 200)}` };
    }
    console.log(`${tag} synced sku=${payload.sku} price=$${payload.price} stock=${payload.stock}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Batch sync — todos los productos activos. Idempotente en Drop Chat
 * (matchea por sku). Se usa desde el cron + botón admin.
 */
export async function syncAllProducts(): Promise<{
  ok: boolean;
  total: number;
  synced: number;
  errors: Array<{ sku: string; error: string }>;
}> {
  const apiKey = process.env.DROPCHAT_API_KEY;
  if (!apiKey) {
    return { ok: false, total: 0, synced: 0, errors: [{ sku: "-", error: "DROPCHAT_API_KEY no seteado" }] };
  }

  const products = await loadProducts();
  const payloads = products.map(toDropchatProduct);

  try {
    const r = await fetch(`${API_URL}/api/v1/sync/products`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ products: payloads }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return {
        ok: false,
        total: payloads.length,
        synced: 0,
        errors: [{ sku: "-batch-", error: `HTTP ${r.status}: ${t.slice(0, 200)}` }],
      };
    }
    console.log(`${tag} batch synced ${payloads.length} productos`);
    return { ok: true, total: payloads.length, synced: payloads.length, errors: [] };
  } catch (err) {
    return {
      ok: false,
      total: payloads.length,
      synced: 0,
      errors: [{ sku: "-batch-", error: err instanceof Error ? err.message : String(err) }],
    };
  }
}
