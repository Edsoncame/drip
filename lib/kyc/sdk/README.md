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

Tres opciones según qué controle el tenant:

1. **Hosted web** (más rápido, sin SDK nativo):
   - Tenant crea sesión en su backend con tenant API key
   - Redirige al usuario a `https://fluxperu.com/kyc/s/<session_id>?t=<session_token>`
   - Flux muestra la captura, corre el pipeline, postea webhook, devuelve al usuario
2. **iOS / Android SDK nativo**: tenant embebe la captura en su app usando
   `flux-kyc-ios` / `flux-kyc-android`. El SDK llama a los endpoints directo.
3. **Web custom**: tenant hace su propio cliente JS/TS contra estos endpoints
   — útil si quiere la captura embebida en su dominio y controla la UX.

## Flujo completo (curl)

### 0. Seed tenant (una sola vez)

```sh
DATABASE_URL=postgres://… node scripts/seed-kyc-tenant.mjs \
  --id securex --name "Securex" --webhook "https://securex.pe/api/kyc-webhook"
# Copia el api_key que imprime — no se vuelve a mostrar
```

### 1. Crear sesión (backend del tenant)

```sh
curl -X POST https://flux.pe/api/kyc/sdk/sessions \
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
curl -X POST https://flux.pe/api/kyc/sdk/upload \
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
curl -X POST https://flux.pe/api/kyc/sdk/finalize \
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

### 3.5. Webhook timing — qué esperar

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
  verificado" en la pantalla post-finalize. Mostrá en su lugar:
  > "Estamos revisando tu información. Te avisaremos por email cuando
  > esté lista (puede tardar hasta 24h hábiles)."
- El SLA operativo de la review queue es 1 revisión/día en el plan base.
  Para SLA <2h hábiles, contratar plan con reviewer dedicado.

**Detección desde el response de `/finalize`:** mientras la cola está
poblada el `status` de la sesión queda en `'review'` (ver tabla más
abajo). Podés también leer `kyc_sdk_sessions.webhook_fired_at` vía el
endpoint de polling — es `NULL` mientras la review está pendiente.

Detalles operativos (rotación de policies, contrato exacto, SLA por
plan) en [SECURITY.md](./SECURITY.md#webhook-sla-con-manual_review_policy).

### 4. Webhook (recibido por el backend del tenant)

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

### 5. Polling (fallback si el webhook falla, o reconciliación con review queue)

```sh
curl https://flux.pe/api/kyc/sdk/sessions/<SESSION_ID> \
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
- **`allowed_origins[]`**: whitelist de dominios autorizados a usar tu
  `publishable_key` desde JS embed. Sin entradas → embed JS deshabilitado.

## Multi-tenant — por qué está separado de `users`

- Los tenants del SDK (Securex, futuros clientes) tienen sus propios sistemas de
  usuarios. No queremos escribir a `users` de Flux con gente que nunca usó Flux.
- El `correlation_id` y los rows en `kyc_dni_scans` + `kyc_face_matches` sí se
  comparten entre ambos flujos — la pipeline forense y el arbiter operan sobre
  ellos sin distinguir origen.
- Cross-user duplicate detection (mismo DNI en intentos diferentes) sigue
  funcionando globalmente, lo que mejora la precisión cuanto más uso haya.
