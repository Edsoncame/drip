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
