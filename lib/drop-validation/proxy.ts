/**
 * Proxies de los 4 endpoints del flujo humano checkout hacia Drop Validation API.
 *
 * Mantiene compatibilidad de response shape con los routes legacy
 * (`/api/kyc/{dni,selfie,match,verify}`) para que el browser code en
 * checkout/page.tsx no necesite cambios — el switch es 100% server-side
 * via env var USE_DROP_VALIDATION_CHECKOUT.
 *
 * Comportamiento:
 *   - dni: crea session externa si no existe (cached por correlation_id),
 *     upload imagen via /v1/sessions/:id/upload kind=dni_front. Devuelve
 *     scan_id ficticio (-1) — el frontend lo guarda pero no lo usa para
 *     más nada bajo este modo.
 *   - selfie: upload kind=selfie/liveness_frame. Devuelve score ficticio
 *     (1.0) — Drop Validation hace match real en finalize.
 *   - match: NO hace match local; devuelve outcome='pass' para que el
 *     submit avance. Drop Validation hace el match real en finalize.
 *   - verify: llama a /v1/sessions/:id/finalize con form_name + form_dni.
 *     Devuelve verdict. Hace UPDATE users con scan data del response
 *     (mismo shape que el webhook payload, idempotente).
 */
import { NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { createSession, isConfigured } from './client';
import { getMappedSession, storeMappedSession } from './session-map';

const API_URL = (process.env.DROP_VALIDATION_API_URL ?? 'https://api.dropchat.pe/v1').replace(/\/$/, '');
const PUBLIC_WEBHOOK_URL = process.env.DROP_VALIDATION_WEBHOOK_URL_PUBLIC
  ?? 'https://www.fluxperu.com/api/webhooks/drop-validation';
const WEBHOOK_SECRET = process.env.DROP_VALIDATION_WEBHOOK_SECRET ?? '';

export function isCheckoutProxyEnabled(): boolean {
  return process.env.USE_DROP_VALIDATION_CHECKOUT === 'true' && isConfigured();
}

export function isSdkProxyEnabled(): boolean {
  return process.env.USE_DROP_VALIDATION_SDK === 'true' && isConfigured();
}

/**
 * Forward genérico al API externo conservando el mismo path/method/headers/body.
 * Usado por los routes legacy /api/kyc/sdk/* y /api/kyc/embed/session cuando
 * el feature flag SDK está prendido.
 */
export async function forwardToExternal(input: {
  externalPath: string;
  method: 'GET' | 'POST';
  authorization?: string | null;
  contentType?: string | null;
  body?: string;
  origin?: string | null;
}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (input.authorization) headers.Authorization = input.authorization;
  if (input.contentType) headers['Content-Type'] = input.contentType;
  if (input.origin) headers.Origin = input.origin;

  const resp = await fetch(`${API_URL}${input.externalPath}`, {
    method: input.method,
    headers,
    body: input.body,
    signal: AbortSignal.timeout(30_000),
  });

  const respBody = await resp.text();
  return new Response(respBody, {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') ?? 'application/json' },
  });
}

async function getOrCreateSession(correlationId: string, userId: string | null) {
  const existing = await getMappedSession(correlationId);
  if (existing) return existing;

  const created = await createSession({
    external_user_id: userId ? String(userId) : undefined,
    external_reference: correlationId,
    metadata: { source: 'flux_checkout', flux_correlation: correlationId },
    webhook_url: PUBLIC_WEBHOOK_URL,
    webhook_secret: WEBHOOK_SECRET || undefined,
  });
  if (!created.ok) {
    throw new Error(`drop_validation_create_session_failed: ${created.error} ${created.detail ?? ''}`);
  }
  await storeMappedSession({
    correlationId,
    externalSessionId: created.data.session_id,
    sessionToken: created.data.session_token,
    expiresAt: new Date(created.data.expires_at),
    userId,
  });
  return {
    correlation_id: correlationId,
    external_session_id: created.data.session_id,
    session_token: created.data.session_token,
    expires_at: new Date(created.data.expires_at),
    user_id: userId,
  };
}

async function uploadToExternal(
  sessionId: string,
  sessionToken: string,
  kind: 'dni_front' | 'dni_back' | 'selfie' | 'liveness_frame',
  imageBuffer: Buffer,
  contentType: string,
  frameIndex?: number,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const body: Record<string, unknown> = {
    kind,
    image: imageBuffer.toString('base64'),
    content_type: contentType,
  };
  if (typeof frameIndex === 'number') body.frame_index = frameIndex;

  const resp = await fetch(`${API_URL}/sessions/${encodeURIComponent(sessionId)}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, error: text.slice(0, 300) };
  }
  return { ok: true };
}

export async function proxyDniUpload(input: {
  correlationId: string;
  userId: string | null;
  imageBuffer: Buffer;
  contentType: string;
}) {
  const mapped = await getOrCreateSession(input.correlationId, input.userId);
  const r = await uploadToExternal(mapped.external_session_id, mapped.session_token,
    'dni_front', input.imageBuffer, input.contentType);
  if (!r.ok) {
    return NextResponse.json(
      { error: 'No pudimos procesar el DNI. Vuelve a capturarlo con buena luz.', category: 'upload_failed', debug: { external_status: r.status, external_error: r.error } },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    scan_id: -1,
    correlation_id: input.correlationId,
    note: 'drop_validation_external',
  });
}

export async function proxySelfieUpload(input: {
  correlationId: string;
  userId: string | null;
  imageBuffer: Buffer;
  contentType: string;
  frameIndex?: number;
}) {
  const mapped = await getMappedSession(input.correlationId);
  if (!mapped) {
    return NextResponse.json({ error: 'Capturá primero el DNI para iniciar la verificación.' }, { status: 409 });
  }
  const kind = typeof input.frameIndex === 'number' ? 'liveness_frame' : 'selfie';
  const r = await uploadToExternal(mapped.external_session_id, mapped.session_token,
    kind, input.imageBuffer, input.contentType, input.frameIndex);
  if (!r.ok) {
    return NextResponse.json({ error: 'No pudimos guardar la selfie. Reintentá.' }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    score: 100,
    passed: true,
    liveness_passed: true,
    note: 'drop_validation_external',
  });
}

export async function proxyMatch(input: { correlationId: string; full_name?: string; dni_number?: string }) {
  const mapped = await getMappedSession(input.correlationId);
  if (!mapped) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 409 });
  }
  // Drop Validation hace el match dentro de finalize; acá devolvemos pass
  // optimista. Si hay mismatch real, finalize devolverá rejected y el verify
  // route lo propagará al user con un mensaje claro.
  return NextResponse.json({
    outcome: 'pass',
    name_score: 1.0,
    note: 'drop_validation_external_deferred_to_finalize',
  });
}

export async function proxyVerify(input: {
  correlationId: string;
  formName?: string;
  formDni?: string;
  userId: string | null;
}) {
  const mapped = await getMappedSession(input.correlationId);
  if (!mapped) {
    return NextResponse.json({ status: 'pending', reason: 'session_not_found' });
  }

  const resp = await fetch(`${API_URL}/sessions/${encodeURIComponent(mapped.external_session_id)}/finalize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mapped.session_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ form_name: input.formName, form_dni: input.formDni }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json(
      { status: 'rejected', reason: 'external_error', debug: text.slice(0, 300) },
      { status: 200 },
    );
  }
  const data = (await resp.json()) as {
    verdict?: { status?: string; reason?: string };
    correlation_id?: string;
    pending_review?: boolean;
  };
  const verdict = data.verdict;
  const status = verdict?.status ?? 'rejected';
  const reason = verdict?.reason;

  // El UPDATE users lo hace el webhook (idempotente). Acá solo respondemos
  // al frontend para que avance/no avance. Si el webhook todavía no llegó
  // pero el user avanza, el siguiente paso del checkout no debería bloquear
  // (no se reverifica en cada paso).
  return NextResponse.json({ status, reason });
}
