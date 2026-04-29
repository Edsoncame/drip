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

/** Limpia el API key: trim + quita caracteres no-ASCII printables (emojis, BOM, ZWSP). */
function cleanApiKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.trim().replace(/[^\x21-\x7E]/g, "");
}

export interface DropchatSubscriptionPlan {
  months: number;
  monthly_price: number;
  setup_fee?: number;
  label?: string;
}

export interface DropchatProduct {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  price_currency?: string;
  stock: number;
  image_url?: string;
  url?: string;
  attributes?: {
    pricing_model: "subscription";
    plans: DropchatSubscriptionPlan[];
  };
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
  stock: number; // valor manual de products.stock — referencia, NO autoritativo
  cost_usd: string | null;
  specs: unknown;
  includes: unknown;
  pricing: PricingRow[];
  active: boolean;
  /** Conteo real de equipment.estado_actual='Disponible' que matchea por chip. */
  live_available: number;
}

/**
 * Lee productos activos + stock real en vivo del inventario (`equipment`).
 *
 * Estrategia de matching (post-refactor 2026-04-28):
 *  - Normalizamos `chip` en ambas tablas removiendo el prefijo "Apple "
 *    y casándolo en lowercase. Mantiene paridad con `lib/inventory.ts`.
 *  - Además matcheamos por familia (Air / Pro / Neo) extraída de
 *    products.name y equipment.modelo_completo. Sin esto, dos productos
 *    con mismo chip (Air M4 y Pro M4) reportarían el mismo live_available.
 *  - JOIN explícito por (chip, familia) en CTE.
 *  - `live_available` es la única fuente autoritativa de stock que mandamos
 *    a Drop Chat. Si no hay equipment físico, reporta 0 — NO usamos
 *    products.stock como fallback porque eso ofrecía equipos inexistentes.
 */
async function loadProducts(): Promise<ProductRow[]> {
  const res = await query<ProductRow>(
    `WITH chip_inventory AS (
       SELECT
         LOWER(REGEXP_REPLACE(chip, '^Apple\\s+', '', 'i')) AS normalized_chip,
         CASE
           WHEN modelo_completo ILIKE '%Air%' THEN 'air'
           WHEN modelo_completo ILIKE '%Pro%' THEN 'pro'
           WHEN modelo_completo ILIKE '%Neo%' THEN 'neo'
           ELSE 'other'
         END AS family,
         COUNT(*) FILTER (WHERE estado_actual = 'Disponible') AS available_count
       FROM equipment
       WHERE chip IS NOT NULL AND chip <> ''
       GROUP BY 1, 2
     )
     SELECT p.id, p.slug, p.name, p.short_name, p.chip, p.ram, p.ssd, p.color,
            p.image_url, p.badge, p.is_new, p.stock, p.cost_usd::text,
            p.specs, p.includes, p.pricing, p.active,
            COALESCE(ci.available_count, 0)::int AS live_available
     FROM products p
     LEFT JOIN chip_inventory ci
       ON LOWER(REGEXP_REPLACE(p.chip, '^Apple\\s+', '', 'i')) = ci.normalized_chip
      AND CASE
            WHEN p.name ILIKE '%Air%' THEN 'air'
            WHEN p.name ILIKE '%Pro%' THEN 'pro'
            WHEN p.name ILIKE '%Neo%' THEN 'neo'
            ELSE 'other'
          END = ci.family
     WHERE p.active = true
     ORDER BY p.display_order`,
  );

  // Observabilidad: alertar cuando un producto activo no tiene equipment.
  // Esto suele indicar que el equipo se creó solo en `products` sin
  // registrar la unidad física, o que todas se arrendaron y no se repuso.
  for (const p of res.rows) {
    if (p.active && p.live_available === 0) {
      console.warn(
        `${tag} producto activo sin stock físico — slug=${p.slug} chip="${p.chip}" products.stock=${p.stock}`,
      );
    }
  }

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

  const prices = plans.map((x) => x.price).filter((n) => n > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // "price" top-level = plan más barato ("desde $X/mes" es el gancho principal)
  const mainPrice = minPrice;

  // Stock = ÚNICAMENTE equipment.estado_actual='Disponible' matcheado por chip
  // (ver loadProducts SQL). NO usamos products.stock como fallback — ese
  // campo es referencial para el admin pero no es autoritativo. Si no hay
  // unidades físicas, Drop Chat reporta 0 y IAn no ofrece lo que no existe.
  const stock = typeof p.live_available === "number" ? p.live_available : 0;

  const productUrl = `https://www.fluxperu.com/laptops/${p.slug}`;
  // Descripción corta basada en las specs principales — la consume IAn
  // cuando el cliente pregunta "¿qué MacBook es X?".
  const description = [p.chip, p.ram, p.ssd, p.color].filter(Boolean).join(" · ");

  return {
    sku: p.slug,
    name: p.name,
    description,
    category: "laptops",
    price: mainPrice,
    price_currency: "USD",
    stock,
    image_url: p.image_url,
    url: productUrl,
    // Spec Drop Chat /sync/products — IAn cotiza con estos 3 planes reales
    // en vez de inventar. Order del array no importa (backend lo ordena).
    attributes: {
      pricing_model: "subscription",
      plans: plans.map((x) => ({ months: x.months, monthly_price: x.price })),
    },
    custom_fields: {
      // Metadatos del producto (se mantienen para retrocompatibilidad —
      // IAn y otros consumers de Drop Chat pueden estar leyéndolos)
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
      product_url: productUrl,

      // Precios por plan — IAn cotiza el que el cliente pida
      price_8m_usd:  plan8?.price  ?? null,
      price_16m_usd: plan16?.price ?? null,
      price_24m_usd: plan24?.price ?? null,
      min_monthly_price: minPrice,
      max_monthly_price: maxPrice,
      total_plans: plans.length,
      pricing_summary: plans
        .map((x) => `${x.months}m: $${x.price}/mes`)
        .join(" · "),

      // ══════════════════════════════════════════════════════════════════════
      // MODELO FLUX — qué pasa al finalizar el plazo (IAn debe saberlo)
      // ══════════════════════════════════════════════════════════════════════
      //
      // Al finalizar cualquier plan, el cliente tiene 3 opciones:
      //   (a) DEVOLVER sin costo  (b) COMPRAR  (c) SEGUIR RENTANDO (auto-extend)
      //
      // Límites máximos de extensión por plan original:
      //   Plan 8m  → hasta 16m total (+8m extra)
      //   Plan 16m → hasta 24m total (+8m extra)
      //   Plan 24m → hasta 30m total (+6m extra)
      end_of_contract_options: ["return", "buy", "extend"],
      end_of_contract_policy:
        "Al finalizar podés: (a) devolver el Mac sin costo, (b) comprarlo a precio especial coordinado con ventas, o (c) seguir alquilándolo mes a mes. La auto-extensión es automática — no hacés nada y tu plan sigue.",
      max_extension_8m_plan_months: 16,
      max_extension_16m_plan_months: 24,
      max_extension_24m_plan_months: 30,
      can_return_free: true,
      can_buy_at_end: true,
      can_extend_rental: true,
      purchase_price_note:
        "El precio final de compra se coordina con un asesor al finalizar el plazo. Depende del estado del equipo y del plan elegido.",

      // AppleCare+ add-on
      applecare_addon_usd_monthly: 12,
      applecare_deductible_usd: 99,
      applecare_note:
        "Podés agregar AppleCare+ por +$12/mes. Cubre daños accidentales con deducible de $99 (líquidos, pantalla, caídas). Robo y pérdida NO cubiertos.",

      // Entrega + soporte
      delivery_lima_hours: 24,
      delivery_provinces_note: "Por ahora solo Lima Metropolitana (41 distritos)",
      delivery_free: true,
      support_included: true,

      // Links útiles para que IAn pueda referenciarlos
      how_it_works_url: "https://www.fluxperu.com/como-funciona",
      terms_url: "https://www.fluxperu.com/terminos",
      compare_url: "https://www.fluxperu.com/laptops/comparar",
      contact_whatsapp: "https://wa.me/51900164769",

      // Source
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
  const apiKey = cleanApiKey(process.env.DROPCHAT_API_KEY);
  if (!apiKey) return { ok: false, error: "DROPCHAT_API_KEY no seteado" };

  // Mismo JOIN que loadProducts() para que el sync individual también lea
  // stock real del inventario, no '0' hardcoded.
  const res = await query<ProductRow>(
    `WITH chip_inventory AS (
       SELECT
         LOWER(REGEXP_REPLACE(chip, '^Apple\\s+', '', 'i')) AS normalized_chip,
         CASE
           WHEN modelo_completo ILIKE '%Air%' THEN 'air'
           WHEN modelo_completo ILIKE '%Pro%' THEN 'pro'
           WHEN modelo_completo ILIKE '%Neo%' THEN 'neo'
           ELSE 'other'
         END AS family,
         COUNT(*) FILTER (WHERE estado_actual = 'Disponible') AS available_count
       FROM equipment
       WHERE chip IS NOT NULL AND chip <> ''
       GROUP BY 1, 2
     )
     SELECT p.id, p.slug, p.name, p.short_name, p.chip, p.ram, p.ssd, p.color,
            p.image_url, p.badge, p.is_new, p.stock, p.cost_usd::text,
            p.specs, p.includes, p.pricing, p.active,
            COALESCE(ci.available_count, 0)::int AS live_available
     FROM products p
     LEFT JOIN chip_inventory ci
       ON LOWER(REGEXP_REPLACE(p.chip, '^Apple\\s+', '', 'i')) = ci.normalized_chip
      AND CASE
            WHEN p.name ILIKE '%Air%' THEN 'air'
            WHEN p.name ILIKE '%Pro%' THEN 'pro'
            WHEN p.name ILIKE '%Neo%' THEN 'neo'
            ELSE 'other'
          END = ci.family
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
  const apiKey = cleanApiKey(process.env.DROPCHAT_API_KEY);
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
