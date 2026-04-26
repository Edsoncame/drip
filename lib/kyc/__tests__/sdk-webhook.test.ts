import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { dispatchWebhook } from "../sdk/webhook";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Reemplaza globalThis.fetch con un stub controlado y restaura al terminar.
 * Devuelve un objeto con `calls` (array de [url, init]) y `setHandler` para
 * cambiar la respuesta entre intentos del retry loop.
 */
function installFetchStub(handler: (url: string, init: RequestInit, attempt: number) => Promise<Response> | Response) {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit; attempt: number }> = [];
  let attempt = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    attempt += 1;
    calls.push({ url, init, attempt });
    return await handler(url, init, attempt);
  }) as unknown as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Hostname garantizado a NO resolver (RFC 6761 reserva .invalid).
const INVALID_HOST = "kyc-test-nope.invalid";

// Hostname público que el DNS siempre resuelve a IP pública. Lo usamos sólo
// para que `resolvesToPublicIp` no aborte; el fetch real es interceptado.
const PUBLIC_HOST = "example.com";

// ============================================================================
// Pre-fetch validation — no requiere red
// ============================================================================

test("dispatchWebhook — URL no parseable retorna invalid_url, attempts=0", async () => {
  const stub = installFetchStub(() => {
    throw new Error("fetch should not run");
  });
  try {
    const r = await dispatchWebhook({
      url: "not a url at all",
      secret: "s",
      payload: { x: 1 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 0);
    assert.equal(r.last_status, null);
    assert.equal(r.last_error, "invalid_url");
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — http:// rechazado con not_https, attempts=0", async () => {
  const stub = installFetchStub(() => {
    throw new Error("fetch should not run");
  });
  try {
    const r = await dispatchWebhook({
      url: "http://example.com/hook",
      secret: "s",
      payload: { x: 1 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 0);
    assert.equal(r.last_error, "not_https");
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — file:// y data:// también caen en not_https", async () => {
  const stub = installFetchStub(() => {
    throw new Error("fetch should not run");
  });
  try {
    const r1 = await dispatchWebhook({
      url: "file:///etc/passwd",
      secret: null,
      payload: {},
    });
    assert.equal(r1.last_error, "not_https");
    assert.equal(r1.attempts, 0);

    const r2 = await dispatchWebhook({
      url: "data:text/plain,hi",
      secret: null,
      payload: {},
    });
    assert.equal(r2.last_error, "not_https");
    assert.equal(r2.attempts, 0);
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("SECURITY — dispatchWebhook bloquea hostname que NO resuelve (TLD .invalid)", async () => {
  // Defensa anti-rebinding: si DNS no resuelve, abortar antes del fetch.
  // RFC 6761 §6.4: .invalid garantiza NXDOMAIN, así que es un caso reproducible
  // sin internet (el resolver local lo rechaza inmediatamente).
  const stub = installFetchStub(() => {
    throw new Error("fetch should not run");
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${INVALID_HOST}/hook`,
      secret: "s",
      payload: { x: 1 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 0);
    assert.equal(r.last_error, "dns_resolves_to_private_ip");
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

// ============================================================================
// HMAC signing — verificar formato y corrección del MAC
// ============================================================================

test("dispatchWebhook — header x-flux-kyc-signature presente con formato t=...,v1=hex", async () => {
  let captured: { headers: Record<string, string>; body: string } | null = null;
  const stub = installFetchStub((_url, init) => {
    const headers = init.headers as Record<string, string>;
    captured = { headers, body: init.body as string };
    return jsonResponse(200, { ok: true });
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "test_secret_abc",
      payload: { session_id: "s_1", verdict: { status: "verified" } },
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 1);
    assert.equal(r.last_status, 200);
    assert.ok(captured, "fetch fue invocado");
    const sig = captured!.headers["x-flux-kyc-signature"];
    assert.ok(sig, "header x-flux-kyc-signature presente");
    assert.match(sig, /^t=\d+,v1=[a-f0-9]{64}$/);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — HMAC computado sobre `${t}.${body}` es verificable con el secret", async () => {
  // Reproducimos en el receiver el algoritmo del README.md (Stripe-style)
  // y aseguramos que el receiver-side verify pasa.
  const SECRET = "tenant-webhook-secret-xyz";
  const PAYLOAD = { session_id: "s_42", correlation_id: "c_1", n: 7 };
  let receivedSig = "";
  let receivedBody = "";
  const stub = installFetchStub((_url, init) => {
    const headers = init.headers as Record<string, string>;
    receivedSig = headers["x-flux-kyc-signature"];
    receivedBody = init.body as string;
    return jsonResponse(200);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: SECRET,
      payload: PAYLOAD,
    });
    assert.equal(r.ok, true);

    // Receiver-side verification (replica del pseudocódigo del README)
    const [tPart, v1Part] = receivedSig.split(",");
    const t = tPart.split("=")[1];
    const v1 = v1Part.split("=")[1];
    const expected = createHmac("sha256", SECRET).update(`${t}.${receivedBody}`).digest("hex");
    assert.equal(v1, expected, "HMAC del receiver matchea el del sender");

    // El body que viajó es exactamente JSON.stringify(payload).
    assert.equal(receivedBody, JSON.stringify(PAYLOAD));

    // El timestamp es razonable: ahora ± 2s.
    const tsec = Number(t);
    const nowsec = Math.floor(Date.now() / 1000);
    assert.ok(Math.abs(nowsec - tsec) <= 2, `timestamp dentro de ±2s (got ${tsec}, now ${nowsec})`);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — HMAC con secret diferente NO matchea (anti-forgery)", async () => {
  // Tripwire: si en el futuro alguien cambia el algoritmo de signing por
  // accidente (ej: usa un secret hardcodeado), este test rompe.
  const REAL_SECRET = "real-secret";
  const ATTACKER_SECRET = "attacker-guess";
  let receivedSig = "";
  let receivedBody = "";
  const stub = installFetchStub((_url, init) => {
    const headers = init.headers as Record<string, string>;
    receivedSig = headers["x-flux-kyc-signature"];
    receivedBody = init.body as string;
    return jsonResponse(200);
  });
  try {
    await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: REAL_SECRET,
      payload: { x: 1 },
    });
    const t = receivedSig.split(",")[0].split("=")[1];
    const v1 = receivedSig.split(",")[1].split("=")[1];
    const guessed = createHmac("sha256", ATTACKER_SECRET).update(`${t}.${receivedBody}`).digest("hex");
    assert.notEqual(v1, guessed);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — sin secret NO incluye header x-flux-kyc-signature", async () => {
  let captured: Record<string, string> | null = null;
  const stub = installFetchStub((_url, init) => {
    captured = init.headers as Record<string, string>;
    return jsonResponse(200);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: null,
      payload: { x: 1 },
    });
    assert.equal(r.ok, true);
    assert.ok(captured);
    assert.equal(captured!["x-flux-kyc-signature"], undefined);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — secret string vacío también omite signature", async () => {
  // El check actual es `if (input.secret)` truthy, así que '' (falsy) no firma.
  // Si esto cambia, este test rompe y nos hace pensar el comportamiento.
  let captured: Record<string, string> | null = null;
  const stub = installFetchStub((_url, init) => {
    captured = init.headers as Record<string, string>;
    return jsonResponse(200);
  });
  try {
    await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "",
      payload: { x: 1 },
    });
    assert.equal(captured!["x-flux-kyc-signature"], undefined);
  } finally {
    stub.restore();
  }
});

// ============================================================================
// Headers comunes
// ============================================================================

test("dispatchWebhook — content-type y user-agent presentes", async () => {
  let captured: Record<string, string> | null = null;
  const stub = installFetchStub((_url, init) => {
    captured = init.headers as Record<string, string>;
    return jsonResponse(200);
  });
  try {
    await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: { x: 1 },
    });
    assert.equal(captured!["content-type"], "application/json");
    assert.equal(captured!["user-agent"], "flux-kyc-webhook/1.0");
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — método POST", async () => {
  let method = "";
  const stub = installFetchStub((_url, init) => {
    method = (init.method ?? "").toUpperCase();
    return jsonResponse(200);
  });
  try {
    await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(method, "POST");
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — body es JSON.stringify literal del payload", async () => {
  // Importante porque el receiver re-computa HMAC sobre el body crudo.
  // Si serializamos con keys reordenados, el HMAC no matchea.
  const PAYLOAD = { z: 1, a: 2, nested: { b: [3, 4] } };
  let body = "";
  const stub = installFetchStub((_url, init) => {
    body = init.body as string;
    return jsonResponse(200);
  });
  try {
    await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: null,
      payload: PAYLOAD,
    });
    assert.equal(body, JSON.stringify(PAYLOAD));
    // Verifica que JSON.parse roundtrip da equivalente
    assert.deepEqual(JSON.parse(body), PAYLOAD);
  } finally {
    stub.restore();
  }
});

// ============================================================================
// Status codes — clasificación success / non-success
// ============================================================================

test("dispatchWebhook — 200 es success, attempts=1", async () => {
  const stub = installFetchStub(() => jsonResponse(200));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 1);
    assert.equal(r.last_status, 200);
    assert.equal(r.last_error, null);
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — 201 es success", async () => {
  const stub = installFetchStub(() => jsonResponse(201));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.last_status, 201);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — 204 No Content es success", async () => {
  const stub = installFetchStub(() => new Response(null, { status: 204 }));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.last_status, 204);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — 299 es success (boundary inferior del < 300)", async () => {
  // Tripwire: documenta el rango [200, 300). Si alguien lo cambia a [200, 299]
  // o [200, 200] esto rompe.
  const stub = installFetchStub(() => new Response("", { status: 299 }));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.last_status, 299);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — 300 NO es success (boundary del < 300)", async () => {
  // Una redirect 3xx no se considera entrega exitosa: el receiver no leyó
  // el body. Reintentamos.
  const stub = installFetchStub(() => new Response("", { status: 300 }));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 3);
    assert.equal(r.last_status, 300);
    assert.equal(r.last_error, "HTTP 300");
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — 4xx se reintenta (decisión de diseño actual)", async () => {
  // OBSERVACIÓN: el código no distingue 4xx (cliente) de 5xx (server).
  // Reintenta TODO non-2xx. Esto puede ser ruido si el tenant rechaza
  // signatures por bug suyo. Documentado aquí; si en el futuro decidimos
  // no reintentar 4xx, este test rompe y nos obliga a actualizar
  // README.md sección "Webhook timing".
  const stub = installFetchStub(() => new Response("bad", { status: 400 }));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 3);
    assert.equal(r.last_status, 400);
    assert.equal(stub.calls.length, 3);
  } finally {
    stub.restore();
  }
});

// ============================================================================
// Retry behaviour — happy y failure paths
// (estos tests tardan ~1s + ~2s = ~3s por backoff exponencial; aceptable)
// ============================================================================

test("dispatchWebhook — éxito en attempt 2 después de 1 fallo 500", async () => {
  const stub = installFetchStub((_u, _i, attempt) => {
    if (attempt === 1) return jsonResponse(500);
    return jsonResponse(200);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 2);
    assert.equal(r.last_status, 200);
    assert.equal(r.last_error, null);
    assert.equal(stub.calls.length, 2);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — éxito en attempt 3 después de 2 fallos", async () => {
  const stub = installFetchStub((_u, _i, attempt) => {
    if (attempt < 3) return jsonResponse(503);
    return jsonResponse(200);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 3);
    assert.equal(r.last_status, 200);
    assert.equal(stub.calls.length, 3);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — 3 fallos 500 consecutivos retorna ok=false attempts=3", async () => {
  const stub = installFetchStub(() => jsonResponse(500));
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 3);
    assert.equal(r.last_status, 500);
    assert.equal(r.last_error, "HTTP 500");
    assert.equal(stub.calls.length, 3);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — network error siempre: ok=false, attempts=3, last_status=null", async () => {
  // Cuando fetch lanza (DNS suddenly fail, TLS handshake error, conexión
  // resetea), no hay status code. last_status sigue siendo null hasta que
  // un response llegue.
  const stub = installFetchStub(() => {
    throw new Error("ECONNRESET");
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 3);
    assert.equal(r.last_status, null);
    assert.ok(r.last_error?.includes("ECONNRESET"));
    assert.equal(stub.calls.length, 3);
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — mix: error de red en attempt 1, 200 en attempt 2", async () => {
  const stub = installFetchStub((_u, _i, attempt) => {
    if (attempt === 1) throw new Error("ETIMEDOUT");
    return jsonResponse(200);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 2);
    assert.equal(r.last_status, 200);
    // last_error se setea al fallar y NO se limpia en el success
    // (es información de debug del intento previo). Test documenta
    // el behavior actual:
    // OBSERVACIÓN: si esto cambia (ej: clear last_error en success),
    // este test rompe y refleja el cambio explícito.
    assert.ok(r.last_error?.includes("ETIMEDOUT"));
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — last_error truncado a 200 chars en network error", async () => {
  const longMessage = "x".repeat(500);
  const stub = installFetchStub(() => {
    throw new Error(longMessage);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, false);
    assert.ok(r.last_error);
    assert.ok(r.last_error!.length <= 200, `last_error length ${r.last_error!.length} ≤ 200`);
    assert.equal(r.last_error, "x".repeat(200));
  } finally {
    stub.restore();
  }
});

test("dispatchWebhook — error no-Error (string lanzado) también se trunca a 200", async () => {
  const stub = installFetchStub(() => {
    // Algunas libs lanzan strings en vez de Error
    throw "ERR" + "y".repeat(500);
  });
  try {
    const r = await dispatchWebhook({
      url: `https://${PUBLIC_HOST}/hook`,
      secret: "s",
      payload: {},
    });
    assert.equal(r.ok, false);
    assert.ok(r.last_error);
    assert.ok(r.last_error!.length <= 200);
  } finally {
    stub.restore();
  }
});

// ============================================================================
// Idempotencia / determinismo
// ============================================================================

test("dispatchWebhook — dos calls con mismo input usan timestamp distinto (no replay)", async () => {
  // Si el timestamp fuera fijo, dos calls darían el mismo HMAC y un atacante
  // podría replay el header. Verificamos que cada call tiene un `t` propio.
  const sigs: string[] = [];
  const stub = installFetchStub((_url, init) => {
    const headers = init.headers as Record<string, string>;
    sigs.push(headers["x-flux-kyc-signature"]);
    return jsonResponse(200);
  });
  try {
    await dispatchWebhook({ url: `https://${PUBLIC_HOST}/h`, secret: "s", payload: { n: 1 } });
    // sleep ≥ 1s para garantizar timestamp diferente (resolución segundo)
    await new Promise((r) => setTimeout(r, 1100));
    await dispatchWebhook({ url: `https://${PUBLIC_HOST}/h`, secret: "s", payload: { n: 1 } });
    assert.equal(sigs.length, 2);
    const t1 = Number(sigs[0].split(",")[0].split("=")[1]);
    const t2 = Number(sigs[1].split(",")[0].split("=")[1]);
    assert.notEqual(t1, t2);
    // Y los HMACs también difieren porque el `t.body` es distinto.
    assert.notEqual(sigs[0], sigs[1]);
  } finally {
    stub.restore();
  }
});

// ============================================================================
// URL preservation
// ============================================================================

test("dispatchWebhook — la URL se pasa tal cual a fetch (path + query intactos)", async () => {
  let receivedUrl = "";
  const stub = installFetchStub((url) => {
    receivedUrl = url;
    return jsonResponse(200);
  });
  try {
    const target = `https://${PUBLIC_HOST}/api/kyc-webhook?source=flux&v=1`;
    await dispatchWebhook({ url: target, secret: "s", payload: {} });
    assert.equal(receivedUrl, target);
  } finally {
    stub.restore();
  }
});
