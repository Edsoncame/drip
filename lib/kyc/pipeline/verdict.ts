/**
 * Pipeline de verdict KYC — pura orquestación, sin dependencias de request.
 *
 * Reusada por `/api/kyc/verify` (flujo humano web) y `/api/kyc/sdk/finalize`
 * (flujo SDK nativo). Toda la lógica que antes vivía inline en verify route
 * fue extraída acá: lectura del scan + face del DB, 4 capas forenses con
 * cache JSONB, reglas de enforce, y arbiter IA en borderline.
 *
 * Lo que NO hace (decisión deliberada):
 *   - No actualiza `users` — cada caller decide (flujo humano sí, SDK usa
 *     kyc_sdk_sessions en su lugar).
 *   - No logea a kyc_attempts — caller lo hace con el outcome conveniente.
 *   - No dispara side effects (Drop Chat sync, webhooks) — caller decide.
 *
 * Esto permite que el SDK multi-tenant no escriba en la tabla users de Flux
 * sino en kyc_sdk_sessions.verdict.
 */

import { query } from "../../db";
import {
  ensureKycSchema,
  type DbKycDniScan,
  type DbKycFaceMatch,
  type KycStatus,
} from "../db";
import { arbitrateKyc, type ArbiterForensicsSignals } from "../arbiter";
import { analyzeDniForensics, type ForensicsResult } from "../forensics";
import { matchDniTemplate, type TemplateMatchResult } from "../template";
import {
  checkAgeConsistency,
  type AgeConsistencyResult,
} from "../age-consistency";
import { checkDuplicates, type DuplicateCheckResult } from "../duplicates";

const tag = "[kyc/pipeline/verdict]";
const LAYER_TIMEOUT_MS = 8000;

export type VerdictStatus = KycStatus | "pending";

export interface ComputeVerdictInput {
  correlationId: string;
  userId: string | null;
  nameScore?: number;
  formName?: string;
  formDni?: string;
}

export interface ComputeVerdictOutput {
  status: VerdictStatus;
  reason: string;
  /** Solo cuando status === 'pending': qué falta (no_scan | no_selfie). */
  pendingReason?: "no_scan" | "no_selfie";
  arbiterUsed: boolean;
  arbiterConfidence: number | null;
  scan: DbKycDniScan | null;
  face: DbKycFaceMatch | null;
  forensicsResult: ForensicsResult | null;
  templateResult: TemplateMatchResult | null;
  ageResult: AgeConsistencyResult | null;
  duplicatesResult: DuplicateCheckResult | null;
  enforceFlag: boolean;
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error(`${tag} fetchBuffer failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function runForensicsLayers(args: {
  dniBuffer: Buffer | null;
  selfieBuffer: Buffer | null;
  dniDob: string | null;
  dupParams: { correlation_id: string; user_id: string | null; dni_number: string | null };
}): Promise<{
  forensics: ForensicsResult | null;
  template: TemplateMatchResult | null;
  age: AgeConsistencyResult | null;
  duplicates: DuplicateCheckResult | null;
}> {
  const [forensics, template, age, duplicates] = await Promise.all([
    args.dniBuffer
      ? withTimeout(analyzeDniForensics(args.dniBuffer), LAYER_TIMEOUT_MS, "forensics").catch(
          (err) => {
            console.error(`${tag} forensics layer failed:`, err instanceof Error ? err.message : err);
            return null;
          },
        )
      : Promise.resolve(null),
    args.dniBuffer
      ? withTimeout(matchDniTemplate(args.dniBuffer, "front"), LAYER_TIMEOUT_MS, "template").catch(
          (err) => {
            console.error(`${tag} template layer failed:`, err instanceof Error ? err.message : err);
            return null;
          },
        )
      : Promise.resolve(null),
    args.selfieBuffer && args.dniDob
      ? withTimeout(
          checkAgeConsistency(args.selfieBuffer, args.dniDob),
          LAYER_TIMEOUT_MS,
          "age",
        ).catch((err) => {
          console.error(`${tag} age layer failed:`, err instanceof Error ? err.message : err);
          return null;
        })
      : Promise.resolve(null),
    withTimeout(
      checkDuplicates(args.dupParams, async (sql, params) => query(sql, params)),
      LAYER_TIMEOUT_MS,
      "duplicates",
    ).catch((err) => {
      console.error(`${tag} duplicates layer failed:`, err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  return { forensics, template, age, duplicates };
}

export async function computeKycVerdict(
  input: ComputeVerdictInput,
): Promise<ComputeVerdictOutput> {
  await ensureKycSchema();
  const { correlationId, userId, nameScore, formName, formDni } = input;

  const scanRes = await query<DbKycDniScan>(
    `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlationId],
  );
  const faceRes = await query<DbKycFaceMatch>(
    `SELECT * FROM kyc_face_matches WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlationId],
  );
  const scan = scanRes.rows[0] ?? null;
  const face = faceRes.rows[0] ?? null;

  const enforceFlag = process.env.KYC_FORENSICS_ENFORCE === "true";

  if (!scan) {
    return {
      status: "pending",
      reason: "no_scan",
      pendingReason: "no_scan",
      arbiterUsed: false,
      arbiterConfidence: null,
      scan: null,
      face,
      forensicsResult: null,
      templateResult: null,
      ageResult: null,
      duplicatesResult: null,
      enforceFlag,
    };
  }
  if (!face) {
    return {
      status: "pending",
      reason: "no_selfie",
      pendingReason: "no_selfie",
      arbiterUsed: false,
      arbiterConfidence: null,
      scan,
      face: null,
      forensicsResult: null,
      templateResult: null,
      ageResult: null,
      duplicatesResult: null,
      enforceFlag,
    };
  }

  const dniUrl = scan.imagen_anverso_key;
  const selfieUrl = face.selfie_key;
  const hasAbsoluteUrls =
    dniUrl?.startsWith("http") && selfieUrl?.startsWith("http");

  type ScanCache = DbKycDniScan & {
    forensics_json?: ForensicsResult | null;
    template_json?: TemplateMatchResult | null;
    age_consistency_json?: AgeConsistencyResult | null;
    duplicates_json?: DuplicateCheckResult | null;
  };
  const cached = scan as ScanCache;

  let forensicsResult: ForensicsResult | null = cached.forensics_json ?? null;
  let templateResult: TemplateMatchResult | null = cached.template_json ?? null;
  let ageResult: AgeConsistencyResult | null = cached.age_consistency_json ?? null;
  let duplicatesResult: DuplicateCheckResult | null = cached.duplicates_json ?? null;

  const needsCompute =
    !forensicsResult || !templateResult || !ageResult || !duplicatesResult;

  if (hasAbsoluteUrls && needsCompute && dniUrl && selfieUrl) {
    const [dniBuf, selfieBuf] = await Promise.all([
      fetchBuffer(dniUrl),
      fetchBuffer(selfieUrl),
    ]);
    const layers = await runForensicsLayers({
      dniBuffer: dniBuf,
      selfieBuffer: selfieBuf,
      dniDob: scan.fecha_nacimiento ? String(scan.fecha_nacimiento).slice(0, 10) : null,
      dupParams: {
        correlation_id: correlationId,
        user_id: userId,
        dni_number: scan.dni_number,
      },
    });
    forensicsResult = layers.forensics ?? forensicsResult;
    templateResult = layers.template ?? templateResult;
    ageResult = layers.age ?? ageResult;
    duplicatesResult = layers.duplicates ?? duplicatesResult;

    await query(
      `UPDATE kyc_dni_scans SET
        forensics_json = COALESCE($2::jsonb, forensics_json),
        template_json = COALESCE($3::jsonb, template_json),
        age_consistency_json = COALESCE($4::jsonb, age_consistency_json),
        duplicates_json = COALESCE($5::jsonb, duplicates_json)
       WHERE id = $1`,
      [
        scan.id,
        forensicsResult ? JSON.stringify(forensicsResult) : null,
        templateResult ? JSON.stringify(templateResult) : null,
        ageResult ? JSON.stringify(ageResult) : null,
        duplicatesResult ? JSON.stringify(duplicatesResult) : null,
      ],
    );
  }

  let status: KycStatus = "rejected";
  let reason = "";
  let arbiterUsed = false;
  let arbiterConfidence: number | null = null;

  if (!face.liveness_passed) {
    status = "rejected";
    reason = "liveness_failed";
  } else if (!face.passed) {
    status = "rejected";
    reason = "face_no_match";
  } else if (typeof nameScore === "number" && nameScore < 0.8) {
    status = "rejected";
    reason = "name_no_match";
  } else if (typeof nameScore === "number" && nameScore < 0.9) {
    status = "review";
    reason = "name_similarity_borderline";
  } else {
    status = "verified";
    reason = "all_checks_passed";
  }

  const REJECT_THRESHOLD = Number(process.env.KYC_FORENSICS_REJECT_THRESHOLD ?? 0.75);
  const ARBITER_THRESHOLD = Number(process.env.KYC_FORENSICS_ARBITER_THRESHOLD ?? 0.4);
  const TEMPLATE_MIN = Number(process.env.KYC_TEMPLATE_MIN_SCORE ?? 0.6);
  const AGE_DEVIATION_LIMIT = 5;

  if (enforceFlag && status !== "rejected") {
    if (duplicatesResult?.dni_reused_by_other_user) {
      status = "rejected";
      reason = `duplicates: dni_number usado por ${duplicatesResult.other_user_ids.length} otro(s) user(s)`;
      console.log(`${tag} ENFORCE auto-reject by duplicates corr=${correlationId}`);
    } else if (
      forensicsResult &&
      forensicsResult.overall_tampering_risk > REJECT_THRESHOLD
    ) {
      status = "rejected";
      reason = `forensics: overall_tampering_risk=${forensicsResult.overall_tampering_risk.toFixed(3)} > ${REJECT_THRESHOLD}`;
      console.log(`${tag} ENFORCE auto-reject by forensics corr=${correlationId}`);
    } else {
      const forensicsConcerning =
        forensicsResult && forensicsResult.overall_tampering_risk > ARBITER_THRESHOLD;
      const templateConcerning =
        templateResult && templateResult.layout_score < TEMPLATE_MIN;
      const ageConcerning =
        ageResult && ageResult.deviation_years > AGE_DEVIATION_LIMIT;

      if (
        (forensicsConcerning || templateConcerning || ageConcerning) &&
        status === "verified"
      ) {
        status = "review";
        reason = "forensics_signals_concerning";
        console.log(
          `${tag} ENFORCE force arbiter corr=${correlationId} fx=${forensicsConcerning ? "y" : "n"} tpl=${templateConcerning ? "y" : "n"} age=${ageConcerning ? "y" : "n"}`,
        );
      }
    }
  }

  if (status === "review") {
    try {
      if (hasAbsoluteUrls && dniUrl && selfieUrl) {
        const signals: ArbiterForensicsSignals = {
          forensics: forensicsResult ?? undefined,
          template: templateResult ?? undefined,
          age_consistency: ageResult ?? undefined,
          duplicates: duplicatesResult ?? undefined,
        };
        const verdict = await arbitrateKyc({
          formName: formName ?? "",
          formDniNumber: formDni ?? "",
          scanApellidoPaterno: scan.apellido_paterno,
          scanApellidoMaterno: scan.apellido_materno,
          scanPrenombres: scan.prenombres,
          scanDniNumber: scan.dni_number,
          nameScore: typeof nameScore === "number" ? nameScore : 0,
          faceScore: parseFloat(String(face.score)) || 0,
          livenessPassed: face.liveness_passed,
          dniImageUrl: dniUrl,
          selfieImageUrl: selfieUrl,
          ...signals,
        });
        arbiterUsed = true;
        arbiterConfidence = verdict.confidence;
        status = verdict.verdict;
        reason = `arbiter: ${verdict.reason}`;
        console.log(
          `${tag} arbiter corr=${correlationId} verdict=${verdict.verdict} confidence=${verdict.confidence.toFixed(2)} checks=${JSON.stringify(verdict.checks)}`,
        );
      } else {
        console.error(
          `${tag} ARBITER_SKIPPED corr=${correlationId} non-URL keys ` +
            `dniUrl=${dniUrl?.slice(0, 30)}... selfieUrl=${selfieUrl?.slice(0, 30)}...`,
        );
        status = "rejected";
        reason = "borderline_no_arbiter";
      }
    } catch (err) {
      console.error(`${tag} arbiter error corr=${correlationId}`, err);
      status = "rejected";
      reason = `arbiter_error: ${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`;
    }
  }

  return {
    status,
    reason,
    arbiterUsed,
    arbiterConfidence,
    scan,
    face,
    forensicsResult,
    templateResult,
    ageResult,
    duplicatesResult,
    enforceFlag,
  };
}
