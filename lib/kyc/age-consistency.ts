/**
 * Age consistency — estima la edad del rostro en la selfie vía AWS Rekognition
 * DetectFaces y la compara contra la edad calculada desde la fecha de nacimiento
 * del DNI (OCR).
 *
 * Detecta fraude donde el DNI tiene DOB de una persona y la selfie es de otra
 * con edad muy distinta. Tolerancia por default: ±3 años desde el rango
 * Rekognition (configurable vía KYC_AGE_TOLERANCE_YEARS).
 */

import { RekognitionClient, DetectFacesCommand } from "@aws-sdk/client-rekognition";

export interface AgeConsistencyResult {
  estimated_age_low: number;
  estimated_age_high: number;
  dni_age: number;
  within_range: boolean;
  /** Cuántos años se sale del rango si se sale (0 si dentro). */
  deviation_years: number;
}

export type AgeDetectFn = (
  selfieBuffer: Buffer,
) => Promise<{ low: number; high: number } | null>;

/** Calcula edad actual (años completos) a partir de YYYY-MM-DD. */
export function ageFromDob(dob: string, today = new Date()): number {
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const [, y, mo, d] = m;
  const birth = new Date(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(birth.getTime())) return NaN;
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

const defaultDetect: AgeDetectFn = async (selfieBuffer) => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return null;
  const client = new RekognitionClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  try {
    const resp = await client.send(
      new DetectFacesCommand({
        Image: { Bytes: selfieBuffer },
        Attributes: ["AGE_RANGE"],
      }),
    );
    const face = resp.FaceDetails?.[0];
    if (!face?.AgeRange?.Low || !face.AgeRange.High) return null;
    return { low: face.AgeRange.Low, high: face.AgeRange.High };
  } catch (err) {
    console.error(
      "[kyc/age-consistency] Rekognition failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};

export async function checkAgeConsistency(
  selfieBuffer: Buffer,
  dniDob: string,
  detectFn: AgeDetectFn = defaultDetect,
  toleranceYears: number = Number(process.env.KYC_AGE_TOLERANCE_YEARS ?? 3),
): Promise<AgeConsistencyResult> {
  const dniAge = ageFromDob(dniDob);
  const empty: AgeConsistencyResult = {
    estimated_age_low: 0,
    estimated_age_high: 0,
    dni_age: isNaN(dniAge) ? 0 : dniAge,
    within_range: false,
    deviation_years: 0,
  };

  if (isNaN(dniAge)) return empty;

  const detected = await detectFn(selfieBuffer).catch(() => null);
  if (!detected) {
    return { ...empty, within_range: true, deviation_years: 0 }; // no signal → no flag
  }

  const low = detected.low - toleranceYears;
  const high = detected.high + toleranceYears;
  const withinRange = dniAge >= low && dniAge <= high;
  const deviation = withinRange
    ? 0
    : dniAge < low
      ? low - dniAge
      : dniAge - high;

  return {
    estimated_age_low: detected.low,
    estimated_age_high: detected.high,
    dni_age: dniAge,
    within_range: withinRange,
    deviation_years: deviation,
  };
}
