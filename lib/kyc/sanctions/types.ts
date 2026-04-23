/**
 * Tipos compartidos del módulo sanctions (listas nacionales/internacionales).
 *
 * Los fetchers devuelven `SanctionsRecord[]` canonicalizado; el schema persiste
 * ese mismo shape en `sanctions_list`. El match engine lee de DB y devuelve
 * `SanctionsCheckResult` al orquestador de KYC.
 */

export type SanctionsSource = "UIF_PE" | "OFAC_SDN" | "UN_CONSOLIDATED";

export type SanctionsListType =
  | "PEP"
  | "SANCTION"
  | "TERRORISM"
  | "AML"
  | "OTHER";

/**
 * Shape canónico de una entrada de lista, independiente del origen.
 * Los campos opcionales reflejan que cada fuente publica metadata distinta.
 */
export interface SanctionsRecord {
  source: SanctionsSource;
  source_id: string;
  full_name: string;
  aka_names: string[];
  doc_type: string | null;
  doc_number: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  list_type: SanctionsListType;
  metadata: Record<string, unknown>;
}

export interface SanctionsHit {
  source: SanctionsSource;
  source_id: string;
  full_name: string;
  list_type: SanctionsListType;
  match_type: "doc_exact" | "name_fuzzy";
  match_score: number;
  metadata: Record<string, unknown>;
}

export interface SanctionsCheckResult {
  hit: boolean;
  hits: SanctionsHit[];
  risk_score: number;
  checked_at: string;
}

export interface SanctionsFetchSummary {
  source: SanctionsSource;
  started_at: string;
  finished_at: string;
  status: "ok" | "partial" | "failed";
  records_inserted: number;
  records_updated: number;
  records_deactivated: number;
  error: string | null;
}
