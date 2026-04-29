# KYC SDK — server-side

API multi-tenant que alimenta los SDKs nativos iOS / Android / WebView de
verificación de identidad. Reusa toda la pipeline de Flux (`lib/kyc/pipeline/*`)
pero escribe el verdict en `kyc_sdk_sessions` en vez de en `users`.

## Arquitectura

```
 tenant (Securex)              Flux (este repo)                 AWS / Claude
 ─────────────────             ───────────────────              ──────────────
  SDK nativo Swift/Kotlin
       │
       │ 1. POST /sessions ──── [Auth: tenant_id:api_key]
       │                                │
       │                         kyc_tenants bcrypt.compare
       │                                │
       │   ← {session_id, session_token JWT, capture_config}
       │
       │ 2. POST /upload (x N) ─ [Auth: Bearer session_token]
       │                         Vercel Blob
       │                         metadata.uploads merge
       │
       │ 3. POST /finalize ───── [Auth: Bearer session_token]
       │                         ingestDni    ────► Claude OCR
       │                         ingestSelfie ────► Rekognition CompareFaces
       │                         computeKycVerdict ────► arbiter (si borderline)
       │                                │
       │   ← {verdict}                  │
       │                                │ webhook (si manual_review_policy='never')
       │                                │ ó queda en status='review' esperando
       │                                │ resolución humana en /tenant/review
       │                                ▼
 Webhook endpoint tenant ◄── POST {session_id, verdict, ...}
                            X-Flux-KYC-Signature: t=TS,v1=HMAC
```

## Formas de integración

Tres opciones según qué controle el tenant. **Si dudás, empezá con la A.**

| # | Modo | Effort tenant | Auth | Cuándo usar |
|---|---|---|---|---|
| **A** | **Embed JS drop-in** | 3 líneas HTML | `publishable_key` (no secreta) + `allowed_origins[]` | Web del tenant (la opción más rápida — pattern Stripe Elements) |
| B | Hosted web flow | 1 endpoint + redirect | `api_key` (server-side) | Backend del tenant, sin tocar UI: redirige al usuario a `flux.pe/kyc/s/...` |
| C | API custom (server-to-server) | SDK propio o curl | `api_key` (server-side) | iOS/Android nativo, web custom embebido en dominio del tenant, o flow programático |

> ✅ **El modo A es el camino feliz para 80% de tenants web.** No expone
> secretos al browser; la seguridad está en el whitelist de
> `allowed_origins[]` que verifica el endpoint `/api/kyc/embed/session`.

---

## Modo A — Embed JS drop-in (recomendado)

### Setup (una sola vez, en `/tenant/settings`)

1. Generá tu `publishable_key` (formato `pk_<tenant_id>_<48hex>`).
2. Agregá los dominios desde donde vas a invocar el embed a
   `allowed_origins[]`. Cada variante cuenta: `https://securex.pe`,
   `https://www.securex.pe`, `https://app.securex.pe`. **Sin entradas en
   esta lista, el embed JS está deshabilitado.**
3. Copiá tu `pk_...` — es seguro pegarla en HTML público.

### Integración (HTML del tenant)

```html
<!-- 1. Cargá el bundle (cache-busted en CDN, async, ~3KB gzip) -->
<script src="https://www.fluxperu.com/kyc-embed.js" async></script>

<!-- 2. Botón con tu publishable key -->
<button
  data-flux-kyc="pk_securex_abc123def456..."
  data-external-user-id="user_42"
  data-external-reference="onboarding-2026-04"
  data-on-complete="onKycComplete">
  Verificar mi identidad
</button>

<!-- 3. Callback global (opcional — también podés escuchar el CustomEvent) -->
<script>
  function onKycComplete(verdict) {
    console.log("KYC terminó", verdict);
    // verdict = { status: "verified" | "rejected", reason, face_score, ... }
    // ⚠️ Si tu manual_review_policy != 'never', este verdict puede ser
    // PROVISIONAL — confiá en el webhook, no acá. Ver sección "Webhook timing".
    if (verdict.status === "verified") window.location.href = "/welcome";
  }
</script>
```

`FluxKYCEmbed.autoInit()` corre solo al `DOMContentLoaded` y escanea
`[data-flux-kyc]`. Si insertás botones dinámicamente (React/Vue/SPA),
llamá manualmente:

```js
window.FluxKYCEmbed.autoInit(document.getElementById("react-mount"));
```

### Uso programático (alternativa al markup)

Útil si querés disparar el flow desde un click handler propio (ej: tras
validar un form):

```js
window.FluxKYCEmbed.open({
  pk: "pk_securex_abc123...",
  externalUserId: "user_42",
  externalReference: "onboarding-2026-04",
  metadata: { plan: "premium", source: "signup" },
  onComplete: (verdict) => {
    // El user terminó el flow. Mostrar UI de éxito o pendiente.
  },
  onCancel: () => {
    // El user cerró el modal sin terminar.
  },
});
```

### Eventos DOM disponibles (alternativa a callbacks)

El elemento con `data-flux-kyc` dispara CustomEvents que burbujean:

```js
document.addEventListener("flux-kyc:complete", (ev) => {
  console.log("verdict", ev.detail.verdict);
});

document.addEventListener("flux-kyc:cancel", () => {
  // user cerró el modal
});

document.addEventListener("flux-kyc:error", (ev) => {
  console.error("falló", ev.detail.error);
  // Errores típicos:
  //   "origin_not_allowed" → tu dominio no está en allowed_origins
  //   "invalid pk"         → publishable_key revocada o inválida
  //   "HTTP 429"           → rate limit (raro)
});
```

### Cómo funciona internamente (para curiosos / debug)

1. Click → `POST https://www.fluxperu.com/api/kyc/embed/session` con
   `Authorization: Bearer pk_...` y `Origin: https://tu-dominio.com`.
2. Flux verifica que `pk` exista, tenant esté activo, y que el `Origin`
   esté en `kyc_tenants.allowed_origins`. Si no → 403.
3. Crea una `kyc_sdk_sessions` y devuelve `{ session_id, session_token,
   capture_config }`.
4. El bundle abre un iframe con `https://www.fluxperu.com/kyc/s/<id>?t=<token>&embed=1`.
5. Dentro del iframe corre el flow hosted (captura DNI + selfie + liveness).
6. Al completar: `window.parent.postMessage({ type: 'flux-kyc:complete',
   verdict }, 'https://tu-dominio.com')`.
7. El bundle valida `event.origin === 'https://www.fluxperu.com'`,
   cierra el modal, llama tu `onComplete`.
8. **En paralelo**, Flux dispara el webhook a tu backend (idéntico a los
   modos B/C). El webhook es la fuente de verdad — el `onComplete` JS
   es UX, no auth.

### Errores típicos

| Síntoma | Causa | Fix |
|---|---|---|
| `origin_not_allowed` 403 | Tu dominio no está en `allowed_origins[]`. Case-sensitive. | Agregá la variante exacta (con scheme + port si aplica) en `/tenant/settings`. |
| `invalid pk` 401 | pk típeada mal, revocada, o tenant inactivo. | Regenerá la pk en settings. |
| Modal abre y queda en negro | El iframe no pudo cargar `/kyc/s/...`. Suele ser CSP del tenant. | Permití `frame-src https://www.fluxperu.com` en tu CSP. |
| `onComplete` nunca dispara | Listener de `postMessage` no se registró (el bundle se cargó después del click). | Cargá el `<script>` al final del `<head>` o usá `defer`. |
| Funciona en local, falla en prod | `http://localhost:3000` está en allowed_origins pero `https://prod.com` no. | Recordá: cada variante (scheme/host/port) cuenta como entrada distinta. |

---

## Modo B — Hosted web flow (sin SDK)

Útil si tu app es server-rendered y no querés JS en el front. El backend
del tenant crea la sesión con su `api_key` (secreto) y redirige al user.

### Backend del tenant

```sh
curl -X POST https://www.fluxperu.com/api/kyc/sdk/sessions \
  -H "Authorization: Bearer securex:<API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "securex-user-123",
    "webhook_url": "https://securex.pe/api/kyc-webhook",
    "webhook_secret": "<random>"
  }'
# → { session_id, session_token, correlation_id, expires_at, capture_config }
```

Después redirige al user a:

```
https://www.fluxperu.com/kyc/s/<session_id>?t=<session_token>
```

Flux corre el flow en su dominio, postea el webhook al `webhook_url`, y al
terminar redirige a tu `return_url` (configurable en `/tenant/settings`).

---

## Modo C — API custom (server-to-server)

Para apps móviles nativas (iOS/Android) o web que quiera la captura
embebida en su propio dominio. El tenant implementa los 3 endpoints él
mismo: crear sesión, subir imágenes, finalizar.

### 0. Seed tenant (una sola vez)

```sh
DATABASE_URL=postgres://… node scripts/seed-kyc-tenant.mjs \
  --id securex --name "Securex" --webhook "https://securex.pe/api/kyc-webhook"
# Copia el api_key que imprime — no se vuelve a mostrar
```

### 1. Crear sesión (backend del tenant)

```sh
curl -X POST https://www.fluxperu.com/api/kyc/sdk/sessions \
  -H "Authorization: Bearer securex:<API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "securex-user-123",
    "webhook_url": "https://securex.pe/api/kyc-webhook",
    "webhook_secret": "<random>"
  }'
# → { session_id, session_token, correlation_id, expires_at, capture_config }
```

El backend del tenant le pasa `session_token` al SDK nativo en el device.

### 2. Subir imágenes (SDK nativo)

```sh
# Anverso DNI
curl -X POST https://www.fluxperu.com/api/kyc/sdk/upload \
  -H "Authorization: Bearer <SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "kind": "dni_front", "image": "<base64>" }'

# Reverso DNI (opcional)
curl -X POST … -d '{ "kind": "dni_back", "image": "<base64>" }'

# Selfie + 2 frames de liveness (frame_index 0 = central/oficial)
curl -X POST … -d '{ "kind": "selfie", "frame_index": 0, "image": "<base64>" }'
curl -X POST … -d '{ "kind": "liveness_frame", "frame_index": 1, "image": "<base64>" }'
curl -X POST … -d '{ "kind": "liveness_frame", "frame_index": 2, "image": "<base64>" }'
```

Límite 10 MB por frame. La sesión pasa a `status=capturing` en el primer upload.

### 3. Finalizar (SDK nativo)

```sh
curl -X POST https://www.fluxperu.com/api/kyc/sdk/finalize \
  -H "Authorization: Bearer <SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "form_name": "Juan Perez Garcia",
    "form_dni": "12345678"
  }'
# → { verdict: { status, reason, face_score, forensics_overall, ... } }
```

`form_name` + `form_dni` son opcionales; si no vienen, se saltea el name-match
y el verdict se basa en face match + forensics.

> ⚠️ **El verdict que devuelve `/finalize` puede ser provisional.**
> Si configuraste `manual_review_policy != 'never'` en tu tenant, el
> response del finalize trae el verdict del pipeline pero el **webhook
> no se dispara hasta que un reviewer humano resuelve la cola** (paso
> 3.5 abajo). No uses la respuesta de `/finalize` para decidir si el
> usuario está verificado en esos casos — confiá solo en el webhook.

---

## Webhook timing — qué esperar (aplica a los 3 modos)

Configurás `manual_review_policy` en el dashboard `/tenant/settings`. Tres modos:

| Policy | Cuándo entra a review | Latencia típica del webhook |
|---|---|---|
| `never` (default) | nunca | < 1 min después de `/finalize` (síncrono con pipeline) |
| `low_confidence` | si arbiter confidence < 0.7 | < 1 min en ~80% de casos · horas/días en el ~20% que va a cola |
| `all_borderline` | cualquier verdict que el pipeline marque como `review` | horas/días en cualquier flow no trivialmente claro |

**Implicancias para tu UX:**

- Si tu flow es **bloqueante** (ej: onboarding fintech donde el usuario
  no puede operar hasta verificarse), elegí `policy='never'`. El verdict
  del arbiter Claude Opus es vinculante y llega al toque.
- Si elegís `low_confidence` o `all_borderline`, **NO** muestres "✅
  verificado" en la pantalla post-finalize ni en el `onComplete` del
  embed JS. Mostrá en su lugar:
  > "Estamos revisando tu información. Te avisaremos por email cuando
  > esté lista (puede tardar hasta 24h hábiles)."
- El SLA operativo de la review queue es 1 revisión/día en el plan base.
  Para SLA <2h hábiles, contratar plan con reviewer dedicado.

**Detección desde el response de `/finalize` o el `onComplete` del embed:**
mientras la cola está poblada, el `status` de la sesión queda en `'review'`
(ver tabla más abajo). También podés leer `kyc_sdk_sessions.webhook_fired_at`
vía el endpoint de polling — es `NULL` mientras la review está pendiente.

Detalles operativos (rotación de policies, contrato exacto, SLA por
plan) en [SECURITY.md](./SECURITY.md#webhook-sla-con-manual_review_policy).

---

## Webhook (recibido por el backend del tenant)

```
POST https://securex.pe/api/kyc-webhook
X-Flux-KYC-Signature: t=1714042123,v1=ab12cd34…
Content-Type: application/json

{
  "session_id": "…",
  "tenant_id": "securex",
  "correlation_id": "sdk_…",
  "external_user_id": "securex-user-123",
  "verdict": { "status": "verified", "reason": "all_checks_passed", "face_score": 92.3, … },
  "completed_at": "2026-04-25T14:35:23.123Z",
  "manual_review": true   // presente solo si pasó por la review queue
}
```

`verdict.status` es el campo que decide:
- `"verified"` → user pasó (sea por arbiter automático o aprobación manual)
- `"rejected"` → user falló (sea por arbiter automático o rechazo manual)
- `"review"` → ⚠️ **nunca llega vía webhook**. Si la session quedó en review,
  el webhook se retiene hasta resolución; nunca recibís un webhook con
  `verdict.status === "review"`.

Verificación del HMAC (pseudocódigo):

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const sig = req.headers["x-flux-kyc-signature"];
const [tPart, v1Part] = sig.split(",");
const t = tPart.split("=")[1];
const v1 = v1Part.split("=")[1];
const expected = createHmac("sha256", WEBHOOK_SECRET)
  .update(`${t}.${rawBody}`)
  .digest("hex");
if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"))) throw new Error("bad signature");
// Rechazar si Date.now()/1000 - Number(t) > 300 para evitar replay
```

## Polling (fallback si el webhook falla, o reconciliación con review queue)

```sh
curl https://www.fluxperu.com/api/kyc/sdk/sessions/<SESSION_ID> \
  -H "Authorization: Bearer securex:<API_KEY>"
# → { status, verdict, uploads, created_at, expires_at, completed_at, webhook_fired_at }
```

Acepta también el `session_token` JWT (self-service desde el device).

**Cuándo pollear:**

- **Reconciliación nocturna**: barrer sesiones de las últimas 24h donde
  `webhook_fired_at IS NULL` para detectar webhooks que tu endpoint
  rechazó (firewall, downtime, HMAC roto). Flux reintenta hasta 5×
  pero después abandona.
- **Review queue activa**: si configuraste `manual_review_policy !=
  'never'`, polleá las sesiones en `status='review'` cada 30-60min
  como fallback en caso de que el webhook de aprobación se pierda.
- **Debug**: cuando un user reporta "no me llegó el email de
  verificación", pollear da el `verdict` final aunque no hayas
  recibido el webhook.

Lógica recomendada:

```ts
const r = await fetch(`${FLUX}/api/kyc/sdk/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${tenantId}:${apiKey}` } });
const { status, verdict, webhook_fired_at } = await r.json();

if (status === "completed" && webhook_fired_at) {
  // Webhook YA llegó — esto es solo verificación
} else if (status === "completed" && !webhook_fired_at) {
  // Verdict listo pero el webhook nunca disparó (5 retries fallaron).
  // Tratar como si el webhook hubiera llegado: actualizar tu DB con verdict.
} else if (status === "review") {
  // Esperando revisión humana. No hagas nada todavía.
} else if (status === "expired" || status === "failed") {
  // Pedir al user que rehaga la verificación.
}
```

## Env vars requeridas en Vercel

```
KYC_SDK_SESSION_SECRET=<random 64 chars>  # Firma JWT de sesión — rotar independiente de JWT_SECRET
KYC_SDK_SESSION_TTL_MIN=15                # (default) TTL del JWT en minutos
```

Las env vars del pipeline subyacente ya existen (ANTHROPIC_API_KEY, AWS_*,
BLOB_READ_WRITE_TOKEN, KYC_FORENSICS_ENFORCE, …).

## Status de la sesión

| status      | significado | webhook_fired_at | verdict poblado |
|-------------|---|---|---|
| pending     | creada, aún sin uploads | NULL | NULL |
| capturing   | primer upload recibido | NULL | NULL |
| processing  | finalize en curso (pipeline corriendo) | NULL | NULL |
| review      | pipeline terminó, esperando revisión humana en `/tenant/review` (solo si tu `manual_review_policy != 'never'`) | NULL | sí (verdict provisional) |
| completed   | flow terminado: webhook disparado o se decidió no disparar | timestamp · NULL si no había webhook_url | sí (verdict final con `verdict.status` ∈ {verified, rejected}) |
| failed      | pipeline falló (dni OCR bloqueado, selfie no pasó liveness, etc) | NULL | parcial (con motivo del fail) |
| expired     | calculado al vuelo si `expires_at < NOW()` y aún no completed | NULL | NULL |

Nota: tras la resolución manual de una sesión en `review`, `status` pasa
a `completed` (NO existe `status='verified'` ni `status='rejected'` —
esos son valores de `verdict.status` dentro del JSONB).

## Configurar `manual_review_policy` y branding

Desde el dashboard del tenant `/tenant/settings`:

- **`manual_review_policy`**: `never` | `low_confidence` | `all_borderline`
  (default `never`). Cambiarlo afecta a sesiones futuras; las que ya
  están en `review` siguen ahí hasta que las apruebes/rechaces.
- **Branding**: logo, color primario, welcome_message para el hosted flow
  (`/kyc/s/<session_id>`).
- **`publishable_key`** + **`allowed_origins[]`**: necesarios para el
  modo Embed JS. La pk es regenerable; cada vez que la rotás, los
  embeds con la pk vieja empiezan a fallar con `invalid pk`. Ver
  [SECURITY.md](./SECURITY.md#rotación-de-publishable_key) para el
  procedimiento de rotación segura.

## Multi-tenant — por qué está separado de `users`

- Los tenants del SDK (Securex, futuros clientes) tienen sus propios sistemas de
  usuarios. No queremos escribir a `users` de Flux con gente que nunca usó Flux.
- El `correlation_id` y los rows en `kyc_dni_scans` + `kyc_face_matches` sí se
  comparten entre ambos flujos — la pipeline forense y el arbiter operan sobre
  ellos sin distinguir origen.
- Cross-user duplicate detection (mismo DNI en intentos diferentes) sigue
  funcionando globalmente, lo que mejora la precisión cuanto más uso haya.
