/**
 * UN Consolidated Sanctions List fetcher.
 *
 * Fuente: https://scsanctions.un.org/resources/xml/en/consolidated.xml
 * Schema: `<CONSOLIDATED_LIST><INDIVIDUALS><INDIVIDUAL>…</INDIVIDUAL>*`
 *
 * Mismo trade-off que OFAC: regex per-entry sobre schema estable. La ONU
 * separa INDIVIDUALS y ENTITIES — leemos ambos como SanctionsRecord, el
 * campo `metadata.un_schema` indica cuál era.
 */

import type { SanctionsRecord } from "./types";

export type HttpFn = (url: string) => Promise<string>;

const DEFAULT_HTTP: HttpFn = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`UN fetch HTTP ${res.status}`);
  return res.text();
};

const INDIVIDUAL_RE = /<INDIVIDUAL\b[\s\S]*?<\/INDIVIDUAL>/g;
const ENTITY_RE = /<ENTITY\b[\s\S]*?<\/ENTITY>/g;

function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`);
  const m = re.exec(xml);
  return m ? decode(m[1].trim()) : null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function composeFullName(parts: Array<string | null>): string {
  return parts
    .filter((p): p is string => !!p && p.length > 0)
    .join(" ")
    .trim();
}

function parseDob(xml: string): string | null {
  const y = tag(xml, "YEAR");
  if (!y) return null;
  const m = tag(xml, "MONTH") ?? "1";
  const d = tag(xml, "DAY") ?? "1";
  const pad = (n: string) => n.padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

function classify(listType: string | null): SanctionsRecord["list_type"] {
  if (!listType) return "SANCTION";
  const u = listType.toUpperCase();
  if (u.includes("AL-QAIDA") || u.includes("TALIBAN") || u.includes("ISIL")) {
    return "TERRORISM";
  }
  return "SANCTION";
}

function parseIndividual(xml: string): SanctionsRecord | null {
  const dataid = tag(xml, "DATAID");
  if (!dataid) return null;

  const fullName = composeFullName([
    tag(xml, "FIRST_NAME"),
    tag(xml, "SECOND_NAME"),
    tag(xml, "THIRD_NAME"),
    tag(xml, "FOURTH_NAME"),
  ]);
  if (!fullName) return null;

  const akaBlocks = xml.match(/<INDIVIDUAL_ALIAS>[\s\S]*?<\/INDIVIDUAL_ALIAS>/g) ?? [];
  const akaNames = akaBlocks
    .map((b) => tag(b, "ALIAS_NAME"))
    .filter((n): n is string => !!n && n.length > 0)
    .slice(0, 10);

  const dobBlock = xml.match(/<INDIVIDUAL_DATE_OF_BIRTH>[\s\S]*?<\/INDIVIDUAL_DATE_OF_BIRTH>/)?.[0];
  const dob = dobBlock ? parseDob(dobBlock) : null;

  const natBlock = xml.match(/<NATIONALITY>[\s\S]*?<\/NATIONALITY>/)?.[0];
  const nationality = natBlock ? tag(natBlock, "VALUE") : null;

  const docBlock = xml.match(/<INDIVIDUAL_DOCUMENT>[\s\S]*?<\/INDIVIDUAL_DOCUMENT>/)?.[0];
  const docType = docBlock ? tag(docBlock, "TYPE_OF_DOCUMENT") : null;
  const docNumber = docBlock ? tag(docBlock, "NUMBER") : null;

  return {
    source: "UN_CONSOLIDATED",
    source_id: `IND-${dataid}`,
    full_name: fullName,
    aka_names: akaNames,
    doc_type: docType,
    doc_number: docNumber,
    date_of_birth: dob,
    nationality,
    list_type: classify(tag(xml, "UN_LIST_TYPE")),
    metadata: {
      un_schema: "individual",
      un_list_type: tag(xml, "UN_LIST_TYPE"),
    },
  };
}

function parseEntity(xml: string): SanctionsRecord | null {
  const dataid = tag(xml, "DATAID");
  const name = tag(xml, "FIRST_NAME");
  if (!dataid || !name) return null;

  return {
    source: "UN_CONSOLIDATED",
    source_id: `ENT-${dataid}`,
    full_name: name,
    aka_names: [],
    doc_type: null,
    doc_number: null,
    date_of_birth: null,
    nationality: null,
    list_type: classify(tag(xml, "UN_LIST_TYPE")),
    metadata: {
      un_schema: "entity",
      un_list_type: tag(xml, "UN_LIST_TYPE"),
    },
  };
}

export async function fetchUn(httpFn: HttpFn = DEFAULT_HTTP): Promise<SanctionsRecord[]> {
  const url = process.env.KYC_SANCTIONS_UN_URL?.trim();
  if (!url) return [];

  const body = await httpFn(url);
  const records: SanctionsRecord[] = [];
  let parseErrors = 0;

  const individuals = body.match(INDIVIDUAL_RE) ?? [];
  for (const xml of individuals) {
    try {
      const r = parseIndividual(xml);
      if (r) records.push(r);
    } catch {
      parseErrors++;
    }
  }

  const entities = body.match(ENTITY_RE) ?? [];
  for (const xml of entities) {
    try {
      const r = parseEntity(xml);
      if (r) records.push(r);
    } catch {
      parseErrors++;
    }
  }

  if (parseErrors > 0) {
    console.warn(`[kyc/sanctions/un] ${parseErrors} entries failed to parse`);
  }
  return records;
}
