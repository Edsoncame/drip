import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ensureKycSchema,
  logAttempt,
  countAttemptsForStep,
  type DbKycDniScan,
} from "@/lib/kyc/db";
import { matchIdentity } from "@/lib/kyc/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const tag = "[kyc/match]";
const MAX_ATTEMPTS = 3;

export async function POST(req: NextRequest) {
  await ensureKycSchema();
  const session = await getSession();
  const userId = session?.userId ?? null;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { scan_id, correlation_id, dni_number, full_name } = body as {
    scan_id?: number;
    correlation_id?: string;
    dni_number?: string;
    full_name?: string;
  };

  if (!scan_id || !correlation_id || !dni_number || !full_name) {
    return NextResponse.json(
      { error: "scan_id, correlation_id, dni_number, full_name requeridos" },
      { status: 400 },
    );
  }

  const failed = await countAttemptsForStep(correlation_id, "match");
  if (failed >= MAX_ATTEMPTS) {
    await logAttempt({
      userId,
      correlationId: correlation_id,
      step: "match",
      outcome: "blocked",
      reason: "max_attempts",
    });
    return NextResponse.json(
      {
        error:
          "Alcanzaste el máximo de intentos de verificación. Contactanos por WhatsApp.",
        blocked: true,
      },
      { status: 429 },
    );
  }

  const scanRes = await query<DbKycDniScan>(
    `SELECT * FROM kyc_dni_scans WHERE id = $1 AND correlation_id = $2`,
    [scan_id, correlation_id],
  );
  if (scanRes.rows.length === 0) {
    return NextResponse.json({ error: "Scan no encontrado" }, { status: 404 });
  }
  const scan = scanRes.rows[0];

  const result = matchIdentity({
    form: { dni_number, full_name },
    ocr: {
      dni_number: scan.dni_number ?? "",
      apellido_paterno: scan.apellido_paterno ?? "",
      apellido_materno: scan.apellido_materno ?? "",
      prenombres: scan.prenombres ?? "",
    },
  });

  await logAttempt({
    userId,
    correlationId: correlation_id,
    step: "match",
    outcome:
      result.outcome === "pass"
        ? "ok"
        : result.outcome === "review"
          ? "review"
          : "fail",
    reason: result.reason,
    payload: { name_score: result.name_score },
  });

  console.log(
    `${tag} corr=${correlation_id} outcome=${result.outcome} dni=${result.dni_match} name_score=${result.name_score.toFixed(3)}`,
  );

  return NextResponse.json({
    outcome: result.outcome,
    name_score: Number(result.name_score.toFixed(3)),
    message: result.rejection_message ?? null,
  });
}
