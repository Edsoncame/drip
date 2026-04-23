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

export async function dispatchWebhook(
  input: WebhookDispatchInput,
): Promise<WebhookDispatchResult> {
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
