/**
 * Drop Validation webhook receiver.
 *
 * Recibe el verdict cuando una session de Drop Validation completa. Verifica
 * HMAC con DROP_VALIDATION_WEBHOOK_SECRET y actualiza el user de Flux con
 * el resultado + datos OCR del DNI (si verified).
 *
 * Configurar en Drop Validation tenant settings:
 *   webhook_url: https://www.fluxperu.com/api/webhooks/drop-validation
 *   webhook_secret: <random 32-byte hex>
 *
 * Env vars:
 *   DROP_VALIDATION_WEBHOOK_SECRET — el secret de arriba (mismo valor)
 *
 * Idempotencia: usamos session_id como dedupe — si el mismo session_id ya
 * tiene kyc_correlation_id en users (que arrancó como capturing y ya fue
 * verificado), respondemos 200 sin re-update.
 */
import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/drop-validation/client';
import { fireSyncToDropchat } from '@/lib/dropchat-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tag = '[webhook/drop-validation]';

interface ScanData {
  dni_number?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  prenombres?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  fecha_emision?: string | null;
  fecha_caducidad?: string | null;
}

interface VerdictPayload {
  status?: 'verified' | 'rejected' | 'review';
  reason?: string;
}

interface WebhookPayload {
  session_id: string;
  tenant_id: string;
  correlation_id: string;
  external_user_id: string | null;
  external_reference: string | null;
  verdict: VerdictPayload;
  scan: ScanData | null;
  completed_at: string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-drop-validation-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn(tag, 'invalid_signature', { signature });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { session_id, external_user_id, verdict, scan, correlation_id } = payload;
  const status = verdict.status;
  if (!status || !['verified', 'rejected', 'review'].includes(status)) {
    return NextResponse.json({ error: 'invalid_verdict_status' }, { status: 400 });
  }

  // external_user_id es el users.id que mandamos al crear la session.
  // Sin él no podemos asociar el verdict a un user.
  if (!external_user_id) {
    console.info(tag, 'no_external_user_id', { session_id });
    return NextResponse.json({ ok: true, note: 'no_user_to_update' });
  }

  // Idempotencia: si ya está marcado verified con este correlation_id, skip.
  const existing = await query<{ kyc_status: string | null; kyc_correlation_id: string | null }>(
    `SELECT kyc_status, kyc_correlation_id FROM users WHERE id = $1 LIMIT 1`,
    [external_user_id],
  );
  const cur = existing.rows[0];
  if (!cur) {
    console.warn(tag, 'user_not_found', { external_user_id });
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
  if (cur.kyc_status === 'verified' && cur.kyc_correlation_id === correlation_id) {
    return NextResponse.json({ ok: true, note: 'already_processed' });
  }

  if (status === 'verified' && scan) {
    const apellidoPat = scan.apellido_paterno ?? null;
    const apellidoMat = scan.apellido_materno ?? null;
    const prenombres = scan.prenombres ?? null;
    const legalName = [apellidoPat, apellidoMat, prenombres]
      .filter((v): v is string => !!v)
      .join(' ')
      .trim() || null;

    await query(
      `UPDATE users SET
         kyc_status = 'verified',
         kyc_correlation_id = $2,
         kyc_verified_at = NOW(),
         identity_verified = true,
         dni_number = COALESCE($3, dni_number),
         legal_name = INITCAP($4),
         legal_apellido_paterno = INITCAP($5),
         legal_apellido_materno = INITCAP($6),
         legal_prenombres = INITCAP($7),
         fecha_nacimiento = COALESCE($8::date, fecha_nacimiento),
         sexo = COALESCE($9, sexo),
         dni_fecha_emision = COALESCE($10::date, dni_fecha_emision),
         dni_fecha_caducidad = COALESCE($11::date, dni_fecha_caducidad),
         updated_at = NOW()
       WHERE id = $1`,
      [
        external_user_id, correlation_id, scan.dni_number,
        legalName, apellidoPat, apellidoMat, prenombres,
        scan.fecha_nacimiento, scan.sexo, scan.fecha_emision, scan.fecha_caducidad,
      ],
    );
  } else {
    // rejected o review — solo actualizamos el status sin tocar legal_name.
    await query(
      `UPDATE users SET
         kyc_status = $2,
         kyc_correlation_id = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [external_user_id, status, correlation_id],
    );
  }

  console.info(tag, 'processed', { session_id, external_user_id, status, correlation_id });

  // Sync a Drop Chat (igual que el flujo legacy /api/kyc/verify hace).
  fireSyncToDropchat(external_user_id).catch((err) => {
    console.warn(tag, 'sync_failed', { user: external_user_id, err: (err as Error).message });
  });

  return NextResponse.json({ ok: true, status });
}
