import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { logAttempt } from "@/lib/kyc/db";
import { computeKycVerdict } from "@/lib/kyc/pipeline/verdict";
import { fireSyncToDropchat } from "@/lib/dropchat-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Con las 5 capas forenses (Promise.all con timeout 8s c/u) + arbiter ~3s,
// subimos a 60s. Vercel Fluid Compute con memory=2048 lo soporta nativo.
export const maxDuration = 60;

const tag = "[kyc/verify]";

/**
 * Handler del flujo humano (web + admin). La orquestación vive en
 * `lib/kyc/pipeline/verdict.ts`; este handler solo:
 *   - Parsea el body
 *   - Llama a computeKycVerdict()
 *   - Actualiza la tabla `users` si corresponde (flujo humano Flux)
 *   - Loggea el intento y dispara Drop Chat sync
 *
 * El SDK multi-tenant usa la misma función `computeKycVerdict` desde
 * `/api/kyc/sdk/finalize` pero escribe el verdict a kyc_sdk_sessions
 * en vez de a users.
 */
export async function POST(req: NextRequest) {
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

  const result = await computeKycVerdict({
    correlationId: correlation_id,
    userId,
    nameScore: name_score,
    formName: form_name,
    formDni: form_dni,
  });

  if (result.status === "pending") {
    return NextResponse.json(
      { status: "pending", reason: result.pendingReason ?? result.reason },
      { status: 200 },
    );
  }

  const { status, reason, arbiterUsed, arbiterConfidence, scan, face } = result;

  // Update users si está logueado.
  //
  // Al verificar, copiamos el IDENTIDAD LEGAL (apellidos + prenombres del DNI
  // normalizados con INITCAP) a las columnas `legal_*` de users. Esa es la
  // fuente de verdad para contratos, facturas y reclamos Indecopi.
  // La columna `name` (nombre de uso) sigue siendo lo que el usuario digitó
  // — la respetamos para no sobrescribirle su preferencia de nombre.
  if (userId && scan) {
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
      face_score: face?.score ?? null,
      liveness: face?.liveness_passed ?? null,
      arbiter_used: arbiterUsed,
      arbiter_confidence: arbiterConfidence,
      forensics_enforce: result.enforceFlag,
      forensics_overall: result.forensicsResult?.overall_tampering_risk ?? null,
      template_layout: result.templateResult?.layout_score ?? null,
      age_deviation: result.ageResult?.deviation_years ?? null,
      duplicate_flag: result.duplicatesResult?.dni_reused_by_other_user ?? false,
      sanctions_hit: result.sanctionsResult?.hit ?? false,
      sanctions_risk: result.sanctionsResult?.risk_score ?? null,
    },
  });

  console.log(
    `${tag} corr=${correlation_id} status=${status} reason=${reason} face=${face?.score ?? "-"} name=${name_score} arbiter=${arbiterUsed} enforce=${result.enforceFlag}`,
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
