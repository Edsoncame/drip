import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { fireSyncCatalog } from "@/lib/dropchat-catalog";
import { ensureInventoryColumns, modelKey } from "@/lib/inventory";
import { calcAllPrices } from "@/lib/pricing-formula";

export const runtime = "nodejs";

const tag = "[admin/products/derived]";

interface EqRow {
  id: string; codigo_interno: string; modelo_completo: string;
  chip: string | null; ram: string | null; ssd: string | null; color: string | null;
  precio_compra_usd: string | null; estado_actual: string; tipo: string;
  battery_cycles: number | null; sale_price_usd: string | null;
  sale_condition: string | null; for_sale: boolean | null; image_url: string | null;
}

interface Overlay {
  slug: string; name: string; short_name: string; image_url: string;
  badge: string | null; is_new: boolean; active: boolean; display_order: number;
}

function mode<T>(arr: T[]): T | null {
  const m = new Map<T, number>();
  for (const v of arr) if (v != null) m.set(v, (m.get(v) ?? 0) + 1);
  let best: T | null = null, n = 0;
  for (const [k, c] of m) if (c > n) { best = k; n = c; }
  return best;
}

function friendly(slug: string): { name: string; short: string } {
  // macbook-air-13-m4 → "MacBook Air 13\" M4"
  const parts = slug.split("-");
  const fam = parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : "";
  const size = parts[2] && /^\d+$/.test(parts[2]) ? `${parts[2]}"` : "";
  const chip = parts.slice(parts[2] && /^\d+$/.test(parts[2]) ? 3 : 2).join(" ").toUpperCase();
  return { name: `MacBook ${fam} ${size} ${chip}`.replace(/\s+/g, " ").trim(), short: `MacBook ${fam} ${size}`.trim() };
}

/** Construye la vista derivada del inventario (alquiler por modelo + venta por unidad). */
async function buildDerived() {
  await ensureInventoryColumns();
  const eq = await query<EqRow>(
    `SELECT id, codigo_interno, modelo_completo, chip, ram, ssd, color,
            precio_compra_usd, estado_actual, COALESCE(tipo,'alquiler') AS tipo,
            battery_cycles, sale_price_usd, sale_condition, for_sale, image_url
     FROM equipment`,
  );
  const ov = await query<Overlay>(
    `SELECT slug, name, short_name, image_url, badge, is_new, active, display_order FROM products`,
  );
  const overlay = new Map(ov.rows.map((r) => [r.slug, r]));

  // ── Alquiler: agrupado por modelo ──
  const groups = new Map<string, EqRow[]>();
  for (const r of eq.rows) {
    if (r.tipo !== "alquiler") continue;
    const k = modelKey(r.modelo_completo);
    if (!k) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const alquiler = [...groups.entries()].map(([slug, units]) => {
    const chip = mode(units.map((u) => u.chip));
    const costs = units.map((u) => Number(u.precio_compra_usd)).filter((n) => n > 0);
    const avgCost = costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0;
    const all = avgCost ? calcAllPrices(avgCost, slug) : [];
    const price = (m: number) => all.find((p) => p.plan === `estreno_${m}m`)?.offline ?? 0;
    const o = overlay.get(slug) ?? null;
    return {
      slug,
      modelo_completo: mode(units.map((u) => u.modelo_completo)),
      chip: chip ? `Apple ${chip}` : null,
      ram: mode(units.map((u) => u.ram)),
      ssd: mode(units.map((u) => u.ssd)),
      color: mode(units.map((u) => u.color)),
      total: units.length,
      stock: units.filter((u) => u.estado_actual === "Disponible").length,
      avgCost,
      pricing: [{ months: 8, price: price(8) }, { months: 16, price: price(16) }, { months: 24, price: price(24) }],
      overlay: o ? { name: o.name, short_name: o.short_name, image_url: o.image_url, badge: o.badge, is_new: o.is_new, active: o.active, display_order: o.display_order } : null,
    };
  }).sort((a, b) => a.slug.localeCompare(b.slug));

  // ── Venta: por unidad ──
  const venta = eq.rows.filter((r) => r.tipo === "venta").map((r) => {
    const slug = modelKey(r.modelo_completo);
    return {
      id: r.id,
      codigo_interno: r.codigo_interno,
      modelo_completo: r.modelo_completo,
      chip: r.chip, ram: r.ram, ssd: r.ssd, color: r.color,
      battery_cycles: r.battery_cycles,
      sale_price_usd: r.sale_price_usd ? Number(r.sale_price_usd) : null,
      sale_condition: r.sale_condition,
      precio_compra_usd: r.precio_compra_usd ? Number(r.precio_compra_usd) : null,
      for_sale: !!r.for_sale,
      estado_actual: r.estado_actual,
      // Imagen propia de la unidad; si no tiene, cae a la del modelo.
      image_url: r.image_url || (slug && overlay.get(slug)?.image_url) || null,
    };
  });

  return { alquiler, venta };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await buildDerived());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error(`${tag} GET`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Sincroniza la tabla `products` (overlay del catálogo) con el inventario:
 * por cada modelo de alquiler, upsert de specs + precio + stock derivados,
 * PRESERVANDO imagen/copy/orden/activo (lo único manual). No crea nada de venta
 * (esa va por unidad desde equipment).
 */
export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { alquiler } = await buildDerived();
    let creados = 0, actualizados = 0;
    const sinImagen: string[] = [];

    for (const m of alquiler) {
      const specs = [
        { label: "Chip", value: m.chip ?? "" },
        { label: "RAM", value: m.ram ?? "" },
        { label: "SSD", value: m.ssd ?? "" },
        { label: "Color", value: m.color ?? "" },
      ];
      if (m.overlay) {
        // Actualiza solo lo derivado del inventario; conserva imagen/copy/orden/activo.
        await query(
          `UPDATE products SET chip=$2, ram=$3, ssd=$4, color=$5, stock=$6, cost_usd=$7,
             pricing=$8::jsonb, specs=$9::jsonb, updated_at=NOW() WHERE slug=$1`,
          [m.slug, m.chip ?? "", m.ram ?? "", m.ssd ?? "", m.stock, m.avgCost || null,
           JSON.stringify(m.pricing), JSON.stringify(specs)],
        );
        actualizados++;
        if (!m.overlay.image_url) sinImagen.push(m.slug);
      } else {
        // Crea el overlay nuevo: inactivo hasta que se le suba imagen.
        const f = friendly(m.slug);
        await query(
          `INSERT INTO products (slug, name, short_name, chip, ram, ssd, color, image_url,
             badge, is_new, stock, cost_usd, pricing, specs, includes, display_order, active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'',NULL,false,$8,$9,$10::jsonb,$11::jsonb,'[]'::jsonb,999,false)`,
          [m.slug, m.modelo_completo || f.name, f.short, m.chip ?? "", m.ram ?? "", m.ssd ?? "",
           m.color ?? "", m.stock, m.avgCost || null, JSON.stringify(m.pricing), JSON.stringify(specs)],
        );
        creados++;
        sinImagen.push(m.slug);
      }
    }

    fireSyncCatalog();
    console.log(`${tag} sync creados=${creados} actualizados=${actualizados}`);
    return NextResponse.json({ ok: true, creados, actualizados, sinImagen });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error(`${tag} POST`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
