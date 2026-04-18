import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureKycSchema } from "@/lib/kyc/db";
import { deleteKycImage } from "@/lib/kyc/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const tag = "[cron/kyc-purge]";

/**
 * Purga KYC por retention_until.
 *
 * Se ejecuta diariamente 3:00 AM (configurado en vercel.json).
 *
 * Lo que hace:
 *  1. Busca scans y face matches con `retention_until < NOW()`
 *  2. Borra los blobs de Vercel Blob (DNI anverso/reverso, selfie)
 *  3. Nullifica raw_ocr_json y rekognition_response (datos sensibles)
 *  4. Mantiene la fila para audit trail pero sin evidencia
 *
 * Protección contra ejecución manual: si no hay header Vercel cron
 * authorization, solo permitimos localhost o admins con sesión.
 */
export async function GET(req: NextRequest) {
  // Vercel Crons agrega este header en invocaciones legítimas
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isVercelCron && !(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    // Permitir llamadas locales sin secret para debug
    const host = req.headers.get("host") ?? "";
    if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  await ensureKycSchema();
  const now = Date.now();
  let purgedScans = 0;
  let purgedFaces = 0;
  let blobsDeleted = 0;
  const errors: string[] = [];

  // ── Scans expirados ────────────────────────────────────────────────────
  const expiredScans = await query<{
    id: number;
    imagen_anverso_key: string | null;
    imagen_reverso_key: string | null;
  }>(
    `SELECT id, imagen_anverso_key, imagen_reverso_key
     FROM kyc_dni_scans
     WHERE retention_until < NOW()
       AND (raw_ocr_json IS NOT NULL OR imagen_anverso_key IS NOT NULL)
     LIMIT 200`,
  );

  for (const scan of expiredScans.rows) {
    try {
      if (scan.imagen_anverso_key) {
        const url = scan.imagen_anverso_key.startsWith("http")
          ? scan.imagen_anverso_key
          : `https://${scan.imagen_anverso_key}`;
        await deleteKycImage(url);
        blobsDeleted++;
      }
      if (scan.imagen_reverso_key) {
        const url = scan.imagen_reverso_key.startsWith("http")
          ? scan.imagen_reverso_key
          : `https://${scan.imagen_reverso_key}`;
        await deleteKycImage(url);
        blobsDeleted++;
      }
      await query(
        `UPDATE kyc_dni_scans SET
          raw_ocr_json = NULL,
          imagen_anverso_key = NULL,
          imagen_reverso_key = NULL,
          mrz_raw = NULL,
          mrz_parsed = NULL
         WHERE id = $1`,
        [scan.id],
      );
      purgedScans++;
    } catch (err) {
      errors.push(`scan ${scan.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Face matches expirados ─────────────────────────────────────────────
  const expiredFaces = await query<{ id: number; selfie_key: string }>(
    `SELECT id, selfie_key
     FROM kyc_face_matches
     WHERE retention_until < NOW()
       AND (selfie_key IS NOT NULL OR rekognition_response IS NOT NULL)
     LIMIT 200`,
  );

  for (const face of expiredFaces.rows) {
    try {
      if (face.selfie_key) {
        const url = face.selfie_key.startsWith("http")
          ? face.selfie_key
          : `https://${face.selfie_key}`;
        await deleteKycImage(url);
        blobsDeleted++;
      }
      await query(
        `UPDATE kyc_face_matches SET
          selfie_key = '',
          rekognition_response = NULL,
          liveness_detail = NULL
         WHERE id = $1`,
        [face.id],
      );
      purgedFaces++;
    } catch (err) {
      errors.push(`face ${face.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const durationMs = Date.now() - now;
  console.log(
    `${tag} done scans=${purgedScans} faces=${purgedFaces} blobs=${blobsDeleted} errors=${errors.length} duration=${durationMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    purged_scans: purgedScans,
    purged_faces: purgedFaces,
    blobs_deleted: blobsDeleted,
    errors: errors.slice(0, 10),
    duration_ms: durationMs,
  });
}
