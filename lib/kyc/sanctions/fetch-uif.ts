/**
 * UIF Perú — en Perú no hay un dump público oficial de la SBS, así que la
 * fuente efectiva son los PEPs peruanos que publica OpenSanctions (open source,
 * sin API key). Mantenemos la etiqueta `UIF_PE` porque la obligación
 * regulatoria es la del SPLAFT/UIF, independiente de dónde saquemos los datos.
 *
 * Formato esperado: FollowTheMoney NDJSON
 *   https://www.followthemoney.tech/explorer/schemata/Person/
 *
 * URL por default: `KYC_SANCTIONS_UIF_URL`. Si no está seteada el fetcher
 * retorna `[]` (no-op seguro en dev). La función HTTP es inyectable para
 * testear sin red.
 */

import type { SanctionsRecord } from "./types";

export type HttpFn = (url: string) => Promise<string>;

const DEFAULT_HTTP: HttpFn = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`UIF fetch HTTP ${res.status} — ${url}`);
  }
  return res.text();
};

interface FtmEntity {
  id?: string;
  schema?: string;
  properties?: {
    name?: string[];
    alias?: string[];
    birthDate?: string[];
    nationality?: string[];
    country?: string[];
    idNumber?: string[];
    position?: string[];
  };
}

function includesPeru(values: string[] | undefined): boolean {
  if (!values) return false;
  return values.some((v) => {
    const low = v.toLowerCase();
    return low === "pe" || low === "per" || low === "peru" || low === "perú";
  });
}

function parseEntity(ent: FtmEntity): SanctionsRecord | null {
  if (ent.schema !== "Person" && ent.schema !== "LegalEntity") return null;
  const props = ent.properties ?? {};
  const name = props.name?.[0]?.trim();
  if (!ent.id || !name) return null;

  const matchesPeru =
    includesPeru(props.country) || includesPeru(props.nationality);
  if (!matchesPeru) return null;

  return {
    source: "UIF_PE",
    source_id: ent.id,
    full_name: name,
    aka_names: (props.alias ?? []).slice(0, 10),
    doc_type: props.idNumber && props.idNumber.length > 0 ? "DNI" : null,
    doc_number: props.idNumber?.[0] ?? null,
    date_of_birth: props.birthDate?.[0] ?? null,
    nationality: props.nationality?.[0] ?? null,
    list_type: "PEP",
    metadata: {
      position: props.position ?? [],
      schema: ent.schema,
    },
  };
}

export async function fetchUif(httpFn: HttpFn = DEFAULT_HTTP): Promise<SanctionsRecord[]> {
  const url = process.env.KYC_SANCTIONS_UIF_URL?.trim();
  if (!url) return [];

  const body = await httpFn(url);
  const records: SanctionsRecord[] = [];
  const lines = body.split("\n");
  let parseErrors = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const ent = JSON.parse(trimmed) as FtmEntity;
      const rec = parseEntity(ent);
      if (rec) records.push(rec);
    } catch {
      parseErrors++;
    }
  }

  if (parseErrors > 0) {
    console.warn(`[kyc/sanctions/uif] ${parseErrors} lines failed to parse`);
  }
  return records;
}
