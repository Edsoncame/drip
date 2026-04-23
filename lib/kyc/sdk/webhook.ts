/**
 * Webhook saliente para el SDK: firma HMAC-SHA256 y POST con retry corto.
 *
 * Header X-Flux-KYC-Signature: t=<unix_ts>,v1=<hex_hmac>
 * El HMAC se calcula sobre `${t}.${body}` con el webhook_secret del tenant.
 * Mismo patrón que Stripe / GitHub webhooks — protege contra replay porque
 * el timestamp es parte del MAC y el receiver puede rechazar payloads viejos.
 *
 * Retry: 3 intentos con backoff exponencial (1s, 2s, 4s). Si fallan los 3
 * el caller sigue su flujo; el GET /sessions/:id queda como fallback de
 * polling para el tenant.
 */

import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isPrivateOrLoopbackIp } from "./webhook-url";

export interface WebhookDispatchInput {
  url: string;
  secret: string | null;
  payload: Record<string, unknown>;
}

export interface WebhookDispatchResult {
  ok: boolean;
  attempts: number;
  last_status: number | null;
  last_error: string | null;
}

const MAX_ATTEMPTS = 3;

function sign(timestamp: number, body: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resuelve el hostname via DNS y verifica que ninguna IP devuelta sea
 * privada / loopback / link-local. Defensa contra DNS rebinding: aunque
 * `isValidWebhookUrl` bloqueó dominios obvios en session-create, un
 * dominio controlado por atacante podría apuntar a 127.0.0.1 a la hora
 * del POST. Pre-resolvemos y abortamos si la IP es interna.
 *
 * Nota TOCTOU: entre este lookup y el fetch real hay una ventana corta
 * donde el DNS podría cambiar. Para cerrarla del todo habría que usar
 * un undici Agent con connect hook (deferido a v2).
 */
async function resolvesToPublicIp(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    for (const a of addresses) {
      if (isPrivateOrLoopbackIp(a.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function dispatchWebhook(
  input: WebhookDispatchInput,
): Promise<WebhookDispatchResult> {
  // Defensa en profundidad: re-chequear la URL antes de mandar. Aunque
  // session-create ya validó, el tenant podría haber editado la metadata
  // fuera de banda (o un bug futuro podría saltarse la validación).
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url);
  } catch {
    return { ok: false, attempts: 0, last_status: null, last_error: "invalid_url" };
  }
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, attempts: 0, last_status: null, last_error: "not_https" };
  }
  if (!(await resolvesToPublicIp(parsedUrl.hostname))) {
    return {
      ok: false,
      attempts: 0,
      last_status: null,
      last_error: "dns_resolves_to_private_ip",
    };
  }

  const body = JSON.stringify(input.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "flux-kyc-webhook/1.0",
  };
  if (input.secret) {
    headers["x-flux-kyc-signature"] = `t=${timestamp},v1=${sign(timestamp, body, input.secret)}`;
  }

  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(input.url, {
        method: "POST",
        headers,
        body,
      });
      lastStatus = res.status;
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, attempts: attempt, last_status: res.status, last_error: null };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }

  return {
    ok: false,
    attempts: MAX_ATTEMPTS,
    last_status: lastStatus,
    last_error: lastError,
  };
}
