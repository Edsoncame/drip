/**
 * Inventory matching utilities — single source of truth para normalizar
 * el campo `chip` entre las tablas `products` y `equipment`.
 *
 * Por qué existe esta función:
 *  - `products.chip` guarda valores como "Apple M4", "Apple A16 Pro".
 *  - `equipment.chip` guarda solo "M4", "A16 Pro" (sin prefijo "Apple").
 *  - Sin normalización, el JOIN entre ambas tablas falla silenciosamente
 *    y reportamos stock incorrecto a Drop Chat / al admin.
 *
 * El SQL del sync usa `REGEXP_REPLACE(chip, '^Apple\\s+', '', 'i')` —
 * esta función debe mantener paridad con esa expresión.
 */

export function normalizeChip(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^apple\s+/, "")
    .replace(/\s+/g, " ");
}

import { query } from "@/lib/db";

/**
 * Migración idempotente del inventario. Agrega el discriminador `tipo`
 * (alquiler | venta) y asegura `battery_cycles` (Ciclos). Mismo patrón que
 * ensureMdmColumns en lib/simplemdm.ts: corre una sola vez por proceso.
 *
 * `retail_price_usd` = precio de lista Apple cuando el equipo era nuevo. Es el
 * ancla de ahorro que se muestra tachada en /comprar. NO confundir con
 * `precio_compra_usd`, que es lo que FLUX pagó por el equipo (dato interno que
 * nunca debe salir a la web).
 */
/**
 * Convierte el `modelo_completo` del inventario en el slug del catálogo
 * (igual al `slug` de la tabla products). ÚNICA fuente de verdad del match
 * modelo→producto — reemplaza los mapeos difusos duplicados en /api/stock,
 * dropchat-catalog y sale-equipment.
 *
 * Ej: 'MacBook Pro 14" M4 (2024)'  → 'macbook-pro-14-m4'
 *     'MacBook Air 13" M4 (2024)'  → 'macbook-air-13-m4'
 *     'MacBook Neo 13" A18 Pro'    → 'macbook-neo-13-a18'
 *     'MacBook Pro Core i5'        → 'macbook-pro-core-i5'
 */
export function modelKey(modeloCompleto: string | null | undefined): string | null {
  if (!modeloCompleto) return null;
  const s = modeloCompleto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  // Orden importa: "MacBook Neo … A18 Pro" contiene "pro" (tier del chip), pero la familia es Neo.
  const family =
    s.includes("air") ? "air" :
    s.includes("neo") ? "neo" :
    s.includes("pro") ? "pro" :
    s.includes("macbook") ? "macbook" : null;
  if (!family) return null;

  const sizeM = s.match(/\b(13|14|15|16)\b/);
  const size = sizeM ? sizeM[1] : null;

  // Chip: M-series (m1..m5), A-series (a18), o Intel "core i5/i7"
  let chip: string | null = null;
  const mSeries = s.match(/\bm([1-9])\b/);
  const aSeries = s.match(/\ba(\d{2})\b/);
  const intel = s.match(/\bcore\s*(i[3579])\b/);
  if (mSeries) chip = `m${mSeries[1]}`;
  else if (aSeries) chip = `a${aSeries[1]}`;
  else if (intel) chip = `core-${intel[1]}`;

  return ["macbook", family === "macbook" ? null : family, size, chip]
    .filter(Boolean)
    .join("-");
}

let inventoryColumnsEnsured = false;
export async function ensureInventoryColumns(): Promise<void> {
  if (inventoryColumnsEnsured) return;
  await query(`
    ALTER TABLE equipment
      ADD COLUMN IF NOT EXISTS tipo             TEXT DEFAULT 'alquiler',
      ADD COLUMN IF NOT EXISTS battery_cycles   INTEGER,
      ADD COLUMN IF NOT EXISTS image_url        TEXT,
      ADD COLUMN IF NOT EXISTS retail_price_usd NUMERIC(10,2)
  `);
  inventoryColumnsEnsured = true;
}
