/**
 * Drop Validation HTTP client (server-side).
 *
 * Wrapper sobre api.dropchat.pe/v1/sessions con bearer flux:KEY desde
 * env. Usado por checkout, sdk routes, embed route cuando el feature
 * flag está prendido. Cuando flag = false, el código legacy de
 * /api/kyc/{dni,match,verify}/* sigue corriendo.
 *
 * Diseño explícito: el cliente NO lanza errores en HTTP non-2xx —
 * devuelve `{ ok: false, status, error }` para que el caller decida si
 * fallback al legacy o propagar al user.
 */

import crypto from 'node:crypto';

const API_URL = (process.env.DROP_VALIDATION_API_URL ?? 'https://api.dropchat.pe/v1').replace(/\/$/, '');
const TENANT = process.env.DROP_VALIDATION_TENANT_ID ?? 'flux';
const API_KEY = process.env.DROP_VALIDATION_API_KEY ?? '';
const WEBHOOK_SECRET = process.env.DROP_VALIDATION_WEBHOOK_SECRET ?? '';
const TIMEOUT_MS = 10_000;

export interface CreateSessionInput {
  external_user_id?: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
  webhook_url?: string;
  webhook_secret?: string;
}

export interface DropValidationSession {
  session_id: string;
  session_token: string;
  public_url: string;
  correlation_id: string;
  expires_at: string;
  tenant_id: string;
  capture_config?: unknown;
}

export type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; detail?: string };

function authHeader(): string {
  return `Bearer ${TENANT}:${API_KEY}`;
}

export function isConfigured(): boolean {
  return Boolean(API_KEY);
}

export async function createSession(input: CreateSessionInput): Promise<ClientResult<DropValidationSession>> {
  if (!API_KEY) {
    return { ok: false, status: 0, error: 'not_configured', detail: 'DROP_VALIDATION_API_KEY missing' };
  }

  try {
    const resp = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return {
        ok: false,
        status: resp.status,
        error: 'api_error',
        detail: text.slice(0, 500),
      };
    }

    const data = (await resp.json()) as DropValidationSession;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, status: 0, error: 'network', detail: (err as Error).message };
  }
}

export interface SessionStatus {
  session_id: string;
  status: string;
  verdict: { status?: string; reason?: string } | null;
  correlation_id: string;
  completed_at: string | null;
  expires_at: string;
}

export async function getSessionStatus(sessionId: string, sessionToken: string): Promise<ClientResult<SessionStatus>> {
  try {
    const resp = await fetch(`${API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: 'api_error' };
    }
    const data = (await resp.json()) as SessionStatus;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, status: 0, error: 'network', detail: (err as Error).message };
  }
}

/** Tolerancia para el timestamp del webhook firmado (anti-replay). */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifica la firma HMAC del webhook con el mismo `webhook_secret` que
 * mandamos al crear la session.
 *
 * Drop Validation firma como el SDK del que fue portado:
 *   header `X-Flux-KYC-Signature: t=<unix_ts>,v1=<hex>`
 *   hex = HMAC-SHA256(secret, `${t}.${rawBody}`)
 * y aceptamos `t` dentro de ±5 minutos para cortar replays.
 *
 * Se mantiene el formato original de este receptor por compatibilidad:
 *   header `X-Drop-Validation-Signature: sha256=<hex>`
 *   hex = HMAC-SHA256(secret, rawBody)
 *
 * `nowSeconds` existe para que los tests fijen el reloj.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;
  const header = signatureHeader.trim();

  const timed = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/i.exec(header);
  if (timed) {
    const ts = Number(timed[1]);
    if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;
    return hmacEquals(`${ts}.${rawBody}`, timed[2]);
  }

  const legacy = /^sha256=([a-f0-9]{64})$/i.exec(header);
  if (legacy) return hmacEquals(rawBody, legacy[1]);

  return false;
}

function hmacEquals(message: string, providedHex: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(message, 'utf8')
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(providedHex.toLowerCase(), 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export const config = {
  apiUrl: API_URL,
  tenant: TENANT,
  hasKey: Boolean(API_KEY),
  hasWebhookSecret: Boolean(WEBHOOK_SECRET),
};
