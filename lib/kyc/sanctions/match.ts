/**
 * Sanctions match engine.
 *
 * Entrada: dni_number + full_name + (opcional) date_of_birth.
 * Lógica:
 *   1. Si hay dni_number y matchea `doc_number` en alguna lista → hit fuerte (score 1.0).
 *   2. Jaro-Winkler sobre full_name normalizado vs todos los entries activos
 *      (lista canónica chica: ~13k hoy). Threshold default 0.92.
 *   3. Si `date_of_birth` está, descartamos matches cuyo DOB difiere > 1 año
 *      (reduce falsos positivos homónimos).
 *
 * Patrón mockable — queryFn inyectable, mismo estilo que `duplicates.ts`.
 *
 * Performance: la lista entera se trae con un SELECT. Volumen esperado 10-20k
 * rows → ~5MB, ~100ms. Cuando supere 100k migramos a pg_trgm + GIN.
 */

import { jaroWinkler, normalizeName } from "../match";
import type {
  SanctionsCheckResult,
  SanctionsHit,
  SanctionsListType,
  SanctionsSource,
} from "./types";

export const SANCTIONS_NAME_MIN = Number(
  process.env.KYC_SANCTIONS_NAME_THRESHOLD ?? "0.92",
);

const DOB_TOLERANCE_YEARS = 1;

export interface SanctionsCheckParams {
  correlation_id: string;
  dni_number: string | null;
  full_name: string | null;
  date_of_birth: string | null;
}

export type SanctionsQueryRow = {
  source: string;
  source_id: string;
  full_name: string;
  aka_names: unknown;
  doc_number: string | null;
  date_of_birth: string | null;
  list_type: string;
  metadata: unknown;
};

export type SanctionsQueryFn = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: SanctionsQueryRow[] }>;

function yearsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return Infinity;
  return Math.abs(da.getTime() - db.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function coerceAka(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function coerceListType(raw: string): SanctionsListType {
  if (
    raw === "PEP" ||
    raw === "SANCTION" ||
    raw === "TERRORISM" ||
    raw === "AML" ||
    raw === "OTHER"
  ) {
    return raw;
  }
  return "OTHER";
}

function coerceSource(raw: string): SanctionsSource {
  if (raw === "UIF_PE" || raw === "OFAC_SDN" || raw === "UN_CONSOLIDATED") {
    return raw;
  }
  return "OFAC_SDN";
}

function baseResult(): SanctionsCheckResult {
  return {
    hit: false,
    hits: [],
    risk_score: 0,
    checked_at: new Date().toISOString(),
  };
}

export async function checkSanctions(
  params: SanctionsCheckParams,
  queryFn: SanctionsQueryFn,
): Promise<SanctionsCheckResult> {
  const result = baseResult();
  if (!params.dni_number && !params.full_name) return result;

  const nameNorm = params.full_name ? normalizeName(params.full_name) : "";

  let rows: SanctionsQueryRow[] = [];
  try {
    const res = await queryFn(
      `SELECT source, source_id, full_name, aka_names, doc_number,
              date_of_birth::text AS date_of_birth, list_type, metadata
       FROM sanctions_list
       WHERE active = true
         AND (
           ($1::text IS NOT NULL AND doc_number = $1::text)
           OR ($2::text IS NOT NULL AND $2::text <> '')
         )`,
      [params.dni_number, nameNorm],
    );
    rows = res.rows;
  } catch (err) {
    console.error(
      "[kyc/sanctions/match] query failed:",
      err instanceof Error ? err.message : err,
    );
    return result;
  }

  const hits: SanctionsHit[] = [];
  for (const row of rows) {
    if (params.dni_number && row.doc_number === params.dni_number) {
      hits.push({
        source: coerceSource(row.source),
        source_id: row.source_id,
        full_name: row.full_name,
        list_type: coerceListType(row.list_type),
        match_type: "doc_exact",
        match_score: 1.0,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      });
      continue;
    }

    if (!nameNorm) continue;

    const candidates = [row.full_name, ...coerceAka(row.aka_names)];
    let best = 0;
    for (const c of candidates) {
      const s = jaroWinkler(nameNorm, normalizeName(c));
      if (s > best) best = s;
    }

    if (best < SANCTIONS_NAME_MIN) continue;

    if (
      params.date_of_birth &&
      row.date_of_birth &&
      yearsBetween(params.date_of_birth, row.date_of_birth) > DOB_TOLERANCE_YEARS
    ) {
      continue;
    }

    hits.push({
      source: coerceSource(row.source),
      source_id: row.source_id,
      full_name: row.full_name,
      list_type: coerceListType(row.list_type),
      match_type: "name_fuzzy",
      match_score: best,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    });
  }

  if (hits.length === 0) return result;

  // Severity del tipo de lista: un match en terrorismo no vale lo mismo que
  // un PEP — el PEP es escrutinio extra, no auto-reject.
  const SEVERITY: Record<SanctionsListType, number> = {
    TERRORISM: 1.0,
    SANCTION: 1.0,
    AML: 0.85,
    PEP: 0.5,
    OTHER: 0.3,
  };

  const risk = hits.reduce(
    (m, h) => Math.max(m, h.match_score * SEVERITY[h.list_type]),
    0,
  );

  return {
    hit: true,
    hits: hits.slice(0, 10),
    risk_score: Number(risk.toFixed(3)),
    checked_at: result.checked_at,
  };
}
