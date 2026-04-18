/**
 * Match de datos del formulario contra OCR del DNI.
 *
 * Política:
 *   - dni_number: exacto, mismatch → rechazo duro.
 *   - Nombres: Jaro-Winkler sobre texto normalizado.
 *     ≥ 0.90 → pass automático
 *     0.80–0.90 → review manual
 *     < 0.80 → rechazo (retry).
 *
 * Normalización:
 *   - lowercase
 *   - quitar acentos (NFD + remove diacritics), preservar Ñ/ñ
 *   - colapsar múltiples espacios
 */

export const NAME_MATCH_PASS = Number(process.env.KYC_NAME_MATCH_MIN ?? "0.90");
export const NAME_MATCH_REVIEW = Number(process.env.KYC_NAME_MATCH_REVIEW ?? "0.80");

export function normalizeName(s: string): string {
  if (!s) return "";
  // Preservar Ñ antes de strip diacritics (NFD convierte Ñ → N + \u0303)
  const preserved = s
    .replace(/Ñ/g, "\u0001")
    .replace(/ñ/g, "\u0002");
  const stripped = preserved
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "Ñ")
    .replace(/\u0002/g, "ñ");
  return stripped.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Jaro distance — base para Jaro-Winkler.
 * Fórmula estándar: https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
 */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  // Transposiciones
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;

  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
}

/**
 * Jaro-Winkler — Jaro + bonus por prefijo común (hasta 4 chars).
 * p (scaling factor) = 0.1 estándar.
 */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j < 0.7) return j; // sin bonus si Jaro bajo
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

export interface MatchInput {
  form: {
    dni_number: string;
    full_name: string; // "Juan Perez Garcia" o como lo ingrese el usuario
  };
  ocr: {
    dni_number: string;
    apellido_paterno: string;
    apellido_materno: string;
    prenombres: string;
  };
}

export interface MatchResult {
  outcome: "pass" | "review" | "reject";
  dni_match: boolean;
  name_match: boolean;
  name_score: number;
  reason?: string;
  rejection_message?: string;
}

/**
 * Compara el DNI y el nombre completo contra el OCR.
 * Nombre completo se construye: "apellido_paterno apellido_materno prenombres".
 * El usuario puede haber ingresado en distinto orden — JW es order-tolerant.
 */
export function matchIdentity(input: MatchInput): MatchResult {
  const formDni = input.form.dni_number.trim();
  const ocrDni = (input.ocr.dni_number ?? "").trim();

  // 1. DNI exacto
  if (!formDni || !ocrDni || formDni !== ocrDni) {
    return {
      outcome: "reject",
      dni_match: false,
      name_match: false,
      name_score: 0,
      reason: "dni_mismatch",
      rejection_message:
        "Los números del DNI no coinciden con la foto. Revisalo y volvé a intentarlo.",
    };
  }

  // 2. Nombres
  const formName = normalizeName(input.form.full_name);
  const ocrName = normalizeName(
    `${input.ocr.apellido_paterno} ${input.ocr.apellido_materno} ${input.ocr.prenombres}`,
  );

  // También probamos el orden inverso (nombre apellido1 apellido2) porque
  // los usuarios a veces escriben así.
  const ocrNameReverse = normalizeName(
    `${input.ocr.prenombres} ${input.ocr.apellido_paterno} ${input.ocr.apellido_materno}`,
  );

  const scoreA = jaroWinkler(formName, ocrName);
  const scoreB = jaroWinkler(formName, ocrNameReverse);
  const nameScore = Math.max(scoreA, scoreB);

  if (nameScore >= NAME_MATCH_PASS) {
    return {
      outcome: "pass",
      dni_match: true,
      name_match: true,
      name_score: nameScore,
    };
  }
  if (nameScore >= NAME_MATCH_REVIEW) {
    return {
      outcome: "review",
      dni_match: true,
      name_match: false,
      name_score: nameScore,
      reason: "name_similarity_low",
    };
  }
  return {
    outcome: "reject",
    dni_match: true,
    name_match: false,
    name_score: nameScore,
    reason: "name_mismatch",
    rejection_message:
      "Los nombres que registraste no coinciden con los de tu DNI. Corregilos para continuar.",
  };
}
