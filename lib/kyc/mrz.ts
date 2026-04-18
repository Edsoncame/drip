/**
 * MRZ parser para DNIe peruano — formato ICAO TD1 (3 líneas × 30 chars).
 *
 * Estructura TD1:
 *   Línea 1: IDPER<issuerNumber><checkDigit><optional>
 *   Línea 2: YYMMDD<check>sex YYMMDD<check>nat<optional><checkDigit>
 *   Línea 3: primary_name<<secondary_names
 *
 * El carácter "<" es el padding. Los nombres usan "<<" como separador entre
 * apellidos y nombres. Check digits siguen ICAO 9303 modulus 10-7-3-1.
 */

export interface MrzParsed {
  documentType: string;
  issuerCountry: string;
  documentNumber: string;
  documentNumberCheck: number;
  optionalData1?: string;
  birthDate: string; // YYYY-MM-DD
  birthDateCheck: number;
  sex: "M" | "F" | "X";
  expiryDate: string; // YYYY-MM-DD
  expiryDateCheck: number;
  nationality: string;
  finalCheck: number;
  primaryName: string; // apellido(s)
  secondaryName: string; // nombre(s)
  checksOk: boolean;
}

const WEIGHTS = [7, 3, 1];
const VALID_CHARS = /[A-Z0-9<]/;

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A=10 ... Z=35
  if (c === "<") return 0;
  return 0;
}

export function computeCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += charValue(input[i]) * WEIGHTS[i % 3];
  }
  return sum % 10;
}

function parseIcaoDate(yymmdd: string): string {
  if (!/^\d{6}$/.test(yymmdd)) return "";
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // Cutoff simple: 00-35 → 2000s, 36-99 → 1900s (birth dates mostly)
  const year = yy <= 35 ? 2000 + yy : 1900 + yy;
  return `${year}-${mm}-${dd}`;
}

/**
 * Parsea 3 líneas de MRZ TD1. Devuelve null si el formato no cuadra.
 * Las líneas pueden venir concatenadas con '\n' o espacios.
 */
export function parseTd1(raw: string): MrzParsed | null {
  if (!raw) return null;
  // Limpia whitespace, keep only A-Z, 0-9, <
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9<\n\r ]/g, "")
    .replace(/[\r ]+/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (cleaned.length < 3) return null;

  const l1 = cleaned[0].padEnd(30, "<").slice(0, 30);
  const l2 = cleaned[1].padEnd(30, "<").slice(0, 30);
  const l3 = cleaned[2].padEnd(30, "<").slice(0, 30);

  // Validar caracteres
  for (const line of [l1, l2, l3]) {
    if (!Array.from(line).every((c) => VALID_CHARS.test(c))) return null;
  }

  // Línea 1: I + issuer(1) + country(3) + docNumber(9) + check(1) + optional(15)
  const documentType = l1.slice(0, 2).replace(/</g, ""); // "I" o "ID"
  const issuerCountry = l1.slice(2, 5);
  const documentNumber = l1.slice(5, 14).replace(/</g, "");
  const documentNumberCheck = parseInt(l1[14], 10);
  const optionalData1 = l1.slice(15, 30).replace(/</g, "");

  // Línea 2: birth(6) + check(1) + sex(1) + expiry(6) + check(1) + nationality(3) + optional(11) + finalCheck(1)
  const birthRaw = l2.slice(0, 6);
  const birthCheck = parseInt(l2[6], 10);
  const sexChar = l2[7];
  const expiryRaw = l2.slice(8, 14);
  const expiryCheck = parseInt(l2[14], 10);
  const nationality = l2.slice(15, 18);
  const finalCheck = parseInt(l2[29], 10);

  const sex: "M" | "F" | "X" = sexChar === "M" || sexChar === "F" ? sexChar : "X";

  // Línea 3: nombres separados por <<
  const nameField = l3.replace(/<$/g, "");
  const [primaryRaw = "", secondaryRaw = ""] = nameField.split("<<");
  const primaryName = primaryRaw.replace(/</g, " ").trim();
  const secondaryName = secondaryRaw.replace(/</g, " ").trim();

  // Check digits
  const dCheck = computeCheckDigit(l1.slice(5, 14));
  const bCheck = computeCheckDigit(birthRaw);
  const eCheck = computeCheckDigit(expiryRaw);
  // Final check cubre: docNumber+check + optional1 + birth+check + expiry+check + optional2
  const composite =
    l1.slice(5, 15) +
    l1.slice(15, 30) +
    l2.slice(0, 7) +
    l2.slice(8, 15) +
    l2.slice(18, 29);
  const fCheck = computeCheckDigit(composite);

  const checksOk =
    dCheck === documentNumberCheck &&
    bCheck === birthCheck &&
    eCheck === expiryCheck &&
    fCheck === finalCheck;

  return {
    documentType,
    issuerCountry,
    documentNumber,
    documentNumberCheck,
    optionalData1: optionalData1 || undefined,
    birthDate: parseIcaoDate(birthRaw),
    birthDateCheck: birthCheck,
    sex,
    expiryDate: parseIcaoDate(expiryRaw),
    expiryDateCheck: expiryCheck,
    nationality,
    finalCheck,
    primaryName,
    secondaryName,
    checksOk,
  };
}
