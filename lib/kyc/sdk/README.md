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
       │                                │ webhook (si configurado)
       │                                ▼
 Webhook endpoint tenant ◄── POST {session_id, verdict, ...}
                            X-Flux-KYC-Signature: t=TS,v1=HMAC
```

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
  "completed_at": "2026-04-25T14:35:23.123Z"
}
```

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

### 5. Polling (fallback si el webhook falla)

```sh
curl https://flux.pe/api/kyc/sdk/sessions/<SESSION_ID> \
  -H "Authorization: Bearer securex:<API_KEY>"
# → { status, verdict, uploads, created_at, expires_at, completed_at }
```

Acepta también el `session_token` JWT (self-service desde el device).

## Env vars requeridas en Vercel

```
KYC_SDK_SESSION_SECRET=<random 64 chars>  # Firma JWT de sesión — rotar independiente de JWT_SECRET
KYC_SDK_SESSION_TTL_MIN=15                # (default) TTL del JWT en minutos
```

Las env vars del pipeline subyacente ya existen (ANTHROPIC_API_KEY, AWS_*,
BLOB_READ_WRITE_TOKEN, KYC_FORENSICS_ENFORCE, …).

## Status de la sesión

| status      | significado |
|-------------|---|
| pending     | creada, aún sin uploads |
| capturing   | primer upload recibido |
| processing  | finalize en curso (pipeline corriendo) |
| completed   | verdict emitido (verdict JSONB poblado) |
| failed      | pipeline falló (dni OCR bloqueado, selfie no pasó liveness, etc) |
| expired     | calculado al vuelo si `expires_at < NOW()` y aún no completed |

## Multi-tenant — por qué está separado de `users`

- Los tenants del SDK (Securex, futuros clientes) tienen sus propios sistemas de
  usuarios. No queremos escribir a `users` de Flux con gente que nunca usó Flux.
- El `correlation_id` y los rows en `kyc_dni_scans` + `kyc_face_matches` sí se
  comparten entre ambos flujos — la pipeline forense y el arbiter operan sobre
  ellos sin distinguir origen.
- Cross-user duplicate detection (mismo DNI en intentos diferentes) sigue
  funcionando globalmente, lo que mejora la precisión cuanto más uso haya.
