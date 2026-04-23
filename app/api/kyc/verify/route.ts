import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ensureKycSchema,
  logAttempt,
  type DbKycDniScan,
  type DbKycFaceMatch,
  type KycStatus,
} from "@/lib/kyc/db";
import { arbitrateKyc, type ArbiterForensicsSignals } from "@/lib/kyc/arbiter";
import { analyzeDniForensics, type ForensicsResult } from "@/lib/kyc/forensics";
import { matchDniTemplate, type TemplateMatchResult } from "@/lib/kyc/template";
import {
  checkAgeConsistency,
  type AgeConsistencyResult,
} from "@/lib/kyc/age-consistency";
import { checkDuplicates, type DuplicateCheckResult } from "@/lib/kyc/duplicates";
import { ensureSanctionsSchema } from "@/lib/kyc/sanctions/schema";
import { checkSanctions } from "@/lib/kyc/sanctions/match";
import type { SanctionsCheckResult } from "@/lib/kyc/sanctions/types";
import { fireSyncToDropchat } from "@/lib/dropchat-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Con las 4 capas forenses (Promise.all con timeout 8s c/u) + arbiter ~3s,
// subimos a 60s. Vercel Fluid Compute con memory=2048 lo soporta nativo.
export const maxDuration = 60;

const tag = "[kyc/verify]";

/** Fetch un blob público (imagen_anverso_key o selfie_key) y retorna Buffer. */
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

/** Promise con timeout hard — si excede el deadline, rechaza con timeout error. */
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

const LAYER_TIMEOUT_MS = 8000;

/**
 * Corre las 4 capas forenses en paralelo con timeouts individuales.
 * Si una falla o excede timeout, retorna null en su slot — el verify
 * no bloquea y los JSONB de cache quedan sin esa capa (se puede
 * recomputar en re-verify).
 */
async function runForensicsLayers(args: {
  dniBuffer: Buffer | null;
  selfieBuffer: Buffer | null;
  dniDob: string | null;
  dupParams: { correlation_id: string; user_id: string | null; dni_number: string | null };
  sanctionsParams: {
    correlation_id: string;
    dni_number: string | null;
    full_name: string | null;
    date_of_birth: string | null;
  };
}): Promise<{
  forensics: ForensicsResult | null;
  template: TemplateMatchResult | null;
  age: AgeConsistencyResult | null;
  duplicates: DuplicateCheckResult | null;
  sanctions: SanctionsCheckResult | null;
}> {
  const [forensics, template, age, duplicates, sanctions] = await Promise.all([
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
    withTimeout(
      checkSanctions(args.sanctionsParams, async (sql, params) => query(sql, params)),
      LAYER_TIMEOUT_MS,
      "sanctions",
    ).catch((err) => {
      console.error(`${tag} sanctions layer failed:`, err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  return { forensics, template, age, duplicates, sanctions };
}

/**
 * Orquestador — lee los resultados de OCR + match + face compare y decide
 * el estado final de KYC. Actualiza users.kyc_status y devuelve el veredicto.
 *
 * Política actual (sin estado `review`):
 *   verified: DNI leído + match nombres >= 0.90 + face score >= 85 + liveness ok
 *   rejected: cualquier mismatch duro (face no coincide, liveness falló,
 *             nombre muy distinto, etc.)
 *
 * Casos borderline (nombre 0.80-0.90 o face score medio) — en vez de dejarlos
 * en `review` esperando humano, los pasamos por un arbiter con Claude Opus
 * que mira DNI + selfie + datos y decide verified o rejected. El usuario
 * siempre recibe un veredicto claro en tiempo real.
 *
 * Fase 4 del pipeline forense (P2-1): corren en paralelo 4 capas nuevas
 * (forensics, template, age, duplicates). Sus resultados se cachean en
 * columnas JSONB de kyc_dni_scans. Si KYC_FORENSICS_ENFORCE=true, las
 * señales aplican reglas antes del arbiter (auto-reject en casos claros
 * de fraude, fuerzan arbiter en borderline). En modo observación
 * (KYC_FORENSICS_ENFORCE=false, default), calculan y persisten pero NO
 * alteran el veredicto — solo loguean + guardan para análisis.
 */
export async function POST(req: NextRequest) {
  await ensureKycSchema();
  const session = await getSession();
  const userId = session?.userId ?? null;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { correlation_id, name_score, form_name, form_dni } = body as {
    correlation_id?: string;
    name_score?: number;
    form_name?: string;
    form_dni?: string;
  };

  if (!correlation_id) {
    return NextResponse.json({ error: "correlation_id requerido" }, { status: 400 });
  }

  const scanRes = await query<DbKycDniScan>(
    `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlation_id],
  );
  const faceRes = await query<DbKycFaceMatch>(
    `SELECT * FROM kyc_face_matches WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlation_id],
  );

  const scan = scanRes.rows[0];
  const face = faceRes.rows[0];

  if (!scan) {
    return NextResponse.json(
      { status: "pending", reason: "no_scan" },
      { status: 200 },
    );
  }
  if (!face) {
    return NextResponse.json(
      { status: "pending", reason: "no_selfie" },
      { status: 200 },
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Fase 4 — pipeline forense: descargar imágenes y correr las 4 capas en
  // paralelo con timeout individual. Resultados se cachean en las columnas
  // JSONB de kyc_dni_scans para no recomputar en re-verifys.
  // ════════════════════════════════════════════════════════════════════════
  const dniUrl = scan.imagen_anverso_key;
  const selfieUrl = face.selfie_key;

  const hasAbsoluteUrls =
    dniUrl?.startsWith("http") && selfieUrl?.startsWith("http");

  // Si ya hay cache, usarla (reintentos no recomputan las capas costosas)
  type ScanCache = DbKycDniScan & {
    forensics_json?: ForensicsResult | null;
    template_json?: TemplateMatchResult | null;
    age_consistency_json?: AgeConsistencyResult | null;
    duplicates_json?: DuplicateCheckResult | null;
    sanctions_json?: SanctionsCheckResult | null;
  };
  const cached = scan as ScanCache;

  let forensicsResult: ForensicsResult | null = cached.forensics_json ?? null;
  let templateResult: TemplateMatchResult | null = cached.template_json ?? null;
  let ageResult: AgeConsistencyResult | null = cached.age_consistency_json ?? null;
  let duplicatesResult: DuplicateCheckResult | null = cached.duplicates_json ?? null;
  let sanctionsResult: SanctionsCheckResult | null = cached.sanctions_json ?? null;

  const needsCompute =
    !forensicsResult ||
    !templateResult ||
    !ageResult ||
    !duplicatesResult ||
    !sanctionsResult;

  if (hasAbsoluteUrls && needsCompute && dniUrl && selfieUrl) {
    await ensureSanctionsSchema();
    const [dniBuf, selfieBuf] = await Promise.all([
      fetchBuffer(dniUrl),
      fetchBuffer(selfieUrl),
    ]);
    const fullNameFromScan = [scan.apellido_paterno, scan.apellido_materno, scan.prenombres]
      .filter((v): v is string => !!v)
      .join(" ") || form_name || null;
    const dobFromScan = scan.fecha_nacimiento
      ? String(scan.fecha_nacimiento).slice(0, 10)
      : null;
    const layers = await runForensicsLayers({
      dniBuffer: dniBuf,
      selfieBuffer: selfieBuf,
      dniDob: dobFromScan,
      dupParams: {
        correlation_id,
        user_id: userId,
        dni_number: scan.dni_number,
      },
      sanctionsParams: {
        correlation_id,
        dni_number: scan.dni_number,
        full_name: fullNameFromScan,
        date_of_birth: dobFromScan,
      },
    });
    forensicsResult = layers.forensics ?? forensicsResult;
    templateResult = layers.template ?? templateResult;
    ageResult = layers.age ?? ageResult;
    duplicatesResult = layers.duplicates ?? duplicatesResult;
    sanctionsResult = layers.sanctions ?? sanctionsResult;

    // Persistir cache — update idempotente de las columnas JSONB
    await query(
      `UPDATE kyc_dni_scans SET
        forensics_json = COALESCE($2::jsonb, forensics_json),
        template_json = COALESCE($3::jsonb, template_json),
        age_consistency_json = COALESCE($4::jsonb, age_consistency_json),
        duplicates_json = COALESCE($5::jsonb, duplicates_json),
        sanctions_json = COALESCE($6::jsonb, sanctions_json)
       WHERE id = $1`,
      [
        scan.id,
        forensicsResult ? JSON.stringify(forensicsResult) : null,
        templateResult ? JSON.stringify(templateResult) : null,
        ageResult ? JSON.stringify(ageResult) : null,
        duplicatesResult ? JSON.stringify(duplicatesResult) : null,
        sanctionsResult ? JSON.stringify(sanctionsResult) : null,
      ],
    );
  }

  // Paso 1 — Decisión clásica por umbrales
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
  } else if (typeof name_score === "number" && name_score < 0.8) {
    status = "rejected";
    reason = "name_no_match";
  } else if (typeof name_score === "number" && name_score < 0.9) {
    // Paso 2 — Caso borderline → arbiter IA
    status = "review"; // temporal, el arbiter lo resuelve
    reason = "name_similarity_borderline";
  } else {
    status = "verified";
    reason = "all_checks_passed";
  }

  // ════════════════════════════════════════════════════════════════════════
  // Fase 4 — aplicar reglas forenses SOLO si KYC_FORENSICS_ENFORCE=true
  // ════════════════════════════════════════════════════════════════════════
  const enforce = process.env.KYC_FORENSICS_ENFORCE === "true";
  const sanctionsEnforce = process.env.KYC_SANCTIONS_ENFORCE === "true";
  const REJECT_THRESHOLD = Number(process.env.KYC_FORENSICS_REJECT_THRESHOLD ?? 0.75);
  const ARBITER_THRESHOLD = Number(process.env.KYC_FORENSICS_ARBITER_THRESHOLD ?? 0.4);
  const TEMPLATE_MIN = Number(process.env.KYC_TEMPLATE_MIN_SCORE ?? 0.6);
  const AGE_DEVIATION_LIMIT = 5;
  // Sanctions reject threshold: un hit doc_exact siempre es >= 1.0 × severity.
  // Con default 0.85 cortamos TERRORISM/SANCTION/AML doc_exact y name_fuzzy
  // ≥0.95 contra TERRORISM, pero dejamos PEP (max 0.5) para que pase al
  // arbiter, no auto-reject.
  const SANCTIONS_REJECT = Number(process.env.KYC_SANCTIONS_REJECT_THRESHOLD ?? 0.85);

  // Sanctions se evalúa SIEMPRE cuando hit con risk alto — prioridad regulatoria.
  if (
    sanctionsEnforce &&
    status !== "rejected" &&
    sanctionsResult?.hit &&
    sanctionsResult.risk_score >= SANCTIONS_REJECT
  ) {
    const top = sanctionsResult.hits[0];
    status = "rejected";
    reason = `sanctions: ${top.source}/${top.list_type} (${top.match_type} ${top.match_score.toFixed(2)})`;
    console.log(`${tag} ENFORCE auto-reject by sanctions corr=${correlation_id}`);
  }

  if (enforce && status !== "rejected") {
    // Auto-reject por fraude obvio
    if (duplicatesResult?.dni_reused_by_other_user) {
      status = "rejected";
      reason = `duplicates: dni_number usado por ${duplicatesResult.other_user_ids.length} otro(s) user(s)`;
      console.log(`${tag} ENFORCE auto-reject by duplicates corr=${correlation_id}`);
    } else if (
      forensicsResult &&
      forensicsResult.overall_tampering_risk > REJECT_THRESHOLD
    ) {
      status = "rejected";
      reason = `forensics: overall_tampering_risk=${forensicsResult.overall_tampering_risk.toFixed(3)} > ${REJECT_THRESHOLD}`;
      console.log(`${tag} ENFORCE auto-reject by forensics corr=${correlation_id}`);
    } else {
      // Forzar arbiter si hay señales moderadas
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
        // Degradar a review para que el arbiter inspeccione
        status = "review";
        reason = "forensics_signals_concerning";
        console.log(
          `${tag} ENFORCE force arbiter corr=${correlation_id} fx=${forensicsConcerning ? "y" : "n"} tpl=${templateConcerning ? "y" : "n"} age=${ageConcerning ? "y" : "n"}`,
        );
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Si quedamos en review (por nombre borderline o forensics concerning),
  // consultamos al arbiter — con las señales cuantitativas en el payload.
  // ════════════════════════════════════════════════════════════════════════
  if (status === "review") {
    try {
      if (hasAbsoluteUrls) {
        const signals: ArbiterForensicsSignals = {
          forensics: forensicsResult ?? undefined,
          template: templateResult ?? undefined,
          age_consistency: ageResult ?? undefined,
          duplicates: duplicatesResult ?? undefined,
          sanctions: sanctionsResult
            ? {
                hit: sanctionsResult.hit,
                risk_score: sanctionsResult.risk_score,
                hits: sanctionsResult.hits.slice(0, 5).map((h) => ({
                  source: h.source,
                  list_type: h.list_type,
                  full_name: h.full_name,
                  match_type: h.match_type,
                  match_score: h.match_score,
                })),
              }
            : undefined,
        };
        const verdict = await arbitrateKyc({
          formName: form_name ?? "",
          formDniNumber: form_dni ?? "",
          scanApellidoPaterno: scan.apellido_paterno,
          scanApellidoMaterno: scan.apellido_materno,
          scanPrenombres: scan.prenombres,
          scanDniNumber: scan.dni_number,
          nameScore: typeof name_score === "number" ? name_score : 0,
          faceScore: parseFloat(String(face.score)) || 0,
          livenessPassed: face.liveness_passed,
          dniImageUrl: dniUrl!,
          selfieImageUrl: selfieUrl!,
          ...signals,
        });
        arbiterUsed = true;
        arbiterConfidence = verdict.confidence;
        status = verdict.verdict;
        reason = `arbiter: ${verdict.reason}`;
        console.log(
          `${tag} arbiter corr=${correlation_id} verdict=${verdict.verdict} confidence=${verdict.confidence.toFixed(2)} checks=${JSON.stringify(verdict.checks)}`,
        );
      } else {
        console.error(
          `${tag} ARBITER_SKIPPED corr=${correlation_id} non-URL keys ` +
            `dniUrl=${dniUrl?.slice(0, 30)}... selfieUrl=${selfieUrl?.slice(0, 30)}...`,
        );
        status = "rejected";
        reason = "borderline_no_arbiter";
      }
    } catch (err) {
      console.error(`${tag} arbiter error corr=${correlation_id}`, err);
      status = "rejected";
      reason = `arbiter_error: ${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`;
    }
  }

  // Update users si está logueado.
  //
  // Al verificar, copiamos el IDENTIDAD LEGAL (apellidos + prenombres del DNI
  // normalizados con INITCAP) a las columnas `legal_*` de users. Esa es la
  // fuente de verdad para contratos, facturas y reclamos Indecopi.
  // La columna `name` (nombre de uso) sigue siendo lo que el usuario digitó
  // — la respetamos para no sobrescribirle su preferencia de nombre.
  if (userId) {
    const apellidoPat = scan.apellido_paterno ?? null;
    const apellidoMat = scan.apellido_materno ?? null;
    const prenombres  = scan.prenombres ?? null;
    const legalName   = [apellidoPat, apellidoMat, prenombres]
      .filter((v): v is string => !!v)
      .join(" ")
      .trim() || null;

    await query(
      `UPDATE users SET
        kyc_status = $2,
        kyc_correlation_id = $3,
        kyc_verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE kyc_verified_at END,
        identity_verified = CASE WHEN $2 = 'verified' THEN true ELSE identity_verified END,
        dni_number = COALESCE($4, dni_number),
        legal_name = CASE WHEN $2 = 'verified' THEN INITCAP($5) ELSE legal_name END,
        legal_apellido_paterno = CASE WHEN $2 = 'verified' THEN INITCAP($6) ELSE legal_apellido_paterno END,
        legal_apellido_materno = CASE WHEN $2 = 'verified' THEN INITCAP($7) ELSE legal_apellido_materno END,
        legal_prenombres = CASE WHEN $2 = 'verified' THEN INITCAP($8) ELSE legal_prenombres END,
        fecha_nacimiento = CASE WHEN $2 = 'verified' THEN COALESCE($9::date, fecha_nacimiento) ELSE fecha_nacimiento END,
        sexo = CASE WHEN $2 = 'verified' THEN COALESCE($10, sexo) ELSE sexo END,
        dni_fecha_emision = CASE WHEN $2 = 'verified' THEN COALESCE($11::date, dni_fecha_emision) ELSE dni_fecha_emision END,
        dni_fecha_caducidad = CASE WHEN $2 = 'verified' THEN COALESCE($12::date, dni_fecha_caducidad) ELSE dni_fecha_caducidad END,
        updated_at = NOW()
       WHERE id = $1`,
      [
        userId, status, correlation_id, scan.dni_number,
        legalName, apellidoPat, apellidoMat, prenombres,
        scan.fecha_nacimiento, scan.sexo, scan.fecha_emision, scan.fecha_caducidad,
      ],
    );
  }

  await logAttempt({
    userId,
    correlationId: correlation_id,
    step: "verify",
    outcome: status === "verified" ? "ok" : "fail",
    reason,
    payload: {
      name_score,
      face_score: face.score,
      liveness: face.liveness_passed,
      arbiter_used: arbiterUsed,
      arbiter_confidence: arbiterConfidence,
      forensics_enforce: enforce,
      forensics_overall: forensicsResult?.overall_tampering_risk ?? null,
      template_layout: templateResult?.layout_score ?? null,
      age_deviation: ageResult?.deviation_years ?? null,
      duplicate_flag: duplicatesResult?.dni_reused_by_other_user ?? false,
      sanctions_hit: sanctionsResult?.hit ?? false,
      sanctions_risk: sanctionsResult?.risk_score ?? null,
    },
  });

  console.log(
    `${tag} corr=${correlation_id} status=${status} reason=${reason} face=${face.score} name=${name_score} arbiter=${arbiterUsed} enforce=${enforce}`,
  );

  // Drop Chat sync real-time — legal_name y kyc_status cambiaron
  if (userId && status === "verified") fireSyncToDropchat(userId);

  return NextResponse.json({
    status,
    reason,
    correlation_id,
    identity_verified: status === "verified",
    arbiter_used: arbiterUsed,
  });
}
