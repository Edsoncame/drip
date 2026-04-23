/**
 * OFAC SDN list fetcher — Office of Foreign Assets Control.
 *
 * Fuente: https://www.treasury.gov/ofac/downloads/sdn.xml
 * Esquema: `<sdnList><sdnEntry>...</sdnEntry>*</sdnList>`
 *
 * Por qué regex y no XML parser completo: el schema de OFAC es extremadamente
 * estable (cambios raros en 20 años) y solo nos interesan ~8 campos por
 * sdnEntry. Un parser XML completo agrega dependencia para poca ganancia.
 * Si OFAC rompe esto migramos a fast-xml-parser en un commit aparte.
 *
 * Documentación del formato:
 *   https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists
 */

import type { SanctionsRecord } from "./types";

export type HttpFn = (url: string) => Promise<string>;

const DEFAULT_HTTP: HttpFn = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OFAC fetch HTTP ${res.status}`);
  return res.text();
};

const ENTRY_RE = /<sdnEntry\b[\s\S]*?<\/sdnEntry>/g;

function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`);
  const m = re.exec(xml);
  return m ? decode(m[1].trim()) : null;
}

function tagAll(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(decode(m[1].trim()));
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseEntry(entry: string): SanctionsRecord | null {
  const uid = tag(entry, "uid");
  if (!uid) return null;

  const sdnType = tag(entry, "sdnType") ?? "Individual";
  const first = tag(entry, "firstName") ?? "";
  const last = tag(entry, "lastName") ?? "";
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  if (!fullName) return null;

  const akaNames: string[] = [];
  const akaBlocks = entry.match(/<aka>[\s\S]*?<\/aka>/g) ?? [];
  for (const block of akaBlocks) {
    const a = tag(block, "firstName") ?? "";
    const b = tag(block, "lastName") ?? "";
    const name = [a, b].filter(Boolean).join(" ").trim();
    if (name) akaNames.push(name);
  }

  const programs = tagAll(entry, "program");
  const listType = classifyList(programs);

  const nationality = tag(entry, "country");
  const dob = tag(entry, "dateOfBirth");

  const idBlocks = entry.match(/<id>[\s\S]*?<\/id>/g) ?? [];
  let docType: string | null = null;
  let docNumber: string | null = null;
  for (const block of idBlocks) {
    const t = tag(block, "idType");
    const n = tag(block, "idNumber");
    if (t && n) {
      docType = t;
      docNumber = n;
      break;
    }
  }

  return {
    source: "OFAC_SDN",
    source_id: uid,
    full_name: fullName,
    aka_names: akaNames.slice(0, 10),
    doc_type: docType,
    doc_number: docNumber,
    date_of_birth: dob,
    nationality,
    list_type: listType,
    metadata: {
      sdn_type: sdnType,
      programs,
    },
  };
}

function classifyList(programs: string[]): SanctionsRecord["list_type"] {
  const joined = programs.join(" ").toUpperCase();
  if (/SDGT|TERROR/.test(joined)) return "TERRORISM";
  if (/NARCOTIC|SDNTK|SDNT/.test(joined)) return "AML";
  return "SANCTION";
}

export async function fetchOfac(httpFn: HttpFn = DEFAULT_HTTP): Promise<SanctionsRecord[]> {
  const url = process.env.KYC_SANCTIONS_OFAC_URL?.trim();
  if (!url) return [];

  const body = await httpFn(url);
  const records: SanctionsRecord[] = [];
  let parseErrors = 0;
  const entries = body.match(ENTRY_RE) ?? [];

  for (const entry of entries) {
    try {
      const rec = parseEntry(entry);
      if (rec) records.push(rec);
    } catch {
      parseErrors++;
    }
  }

  if (parseErrors > 0) {
    console.warn(`[kyc/sanctions/ofac] ${parseErrors} entries failed to parse`);
  }
  return records;
}
