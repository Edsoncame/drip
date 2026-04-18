# KYC de Flux — Arquitectura y operación

Sistema de verificación de identidad para clientes en checkout. Captura guiada del DNI con OCR por Claude, match contra los datos del formulario, y validación biométrica selfie+liveness con AWS Rekognition.

## Flujo end-to-end

```
┌─────────────────────┐   1. Captura guiada   ┌─────────────────────┐
│ DniCaptureGuided.tsx│──────────────────────▶│ POST /api/kyc/dni   │
│  (cliente)          │  foto DNI + corr_id   │                     │
└─────────────────────┘                       │ Claude OCR →        │
                                              │ kyc_dni_scans       │
                                              └──────────┬──────────┘
                                                         │
                   ┌─────────────────────────────────────┘
                   ▼
┌────────────────────────┐  2. Match de datos  ┌──────────────────────┐
│ Formulario checkout    │────────────────────▶│ POST /api/kyc/match  │
│  (Name + DNI input)    │                     │ Jaro-Winkler →       │
└────────────────────────┘                     │ pass/review/reject   │
                                               └──────────┬───────────┘
                                                          │
                   ┌──────────────────────────────────────┘
                   ▼
┌─────────────────────┐   3. Liveness + face   ┌───────────────────────┐
│ SelfieLiveness.tsx  │───────────────────────▶│ POST /api/kyc/selfie  │
│  (3 frames)         │  center/left/right     │ Rekognition DetectFaces│
└─────────────────────┘                        │ + CompareFaces →      │
                                               │ kyc_face_matches      │
                                               └──────────┬────────────┘
                                                          │
                   ┌──────────────────────────────────────┘
                   ▼
                                               ┌───────────────────────┐
                                               │ POST /api/kyc/verify  │
                                               │ Decisión final →      │
                                               │ users.kyc_status      │
                                               └───────────────────────┘
```

## Estados de KYC (`users.kyc_status`)

| Estado | Significado |
|---|---|
| `pending` | Aún no empezó la verificación |
| `capturing` | En medio del proceso (DNI o selfie pendiente) |
| `review` | Nombres con similaridad 0.80–0.90 → review manual por operaciones |
| `verified` | Todas las checks OK — cliente puede operar |
| `rejected` | Algún check duro falló (DNI mismatch, face fail, liveness fail) |
| `blocked` | Alcanzó 3 intentos fallidos — solo se desbloquea por soporte |

## Umbrales configurables (env vars)

| Variable | Default | Descripción |
|---|---|---|
| `KYC_NAME_MATCH_MIN` | `0.90` | Jaro-Winkler mínimo para pass automático |
| `KYC_NAME_MATCH_REVIEW` | `0.80` | JW mínimo para review manual (si no pasa MIN) |
| `KYC_FACE_MATCH_MIN` | `85` | Similarity mínima de Rekognition (0-100) |
| `KYC_LIVENESS_YAW_MIN` | `10` | Grados de yaw (rotación cabeza) para validar liveness |
| `NEXT_PUBLIC_KYC_BLUR_THRESHOLD` | `40` | Varianza Laplaciana mínima para auto-capture |

## Credenciales necesarias (Vercel env vars)

**Anthropic** (ya existía en el proyecto):
- `ANTHROPIC_API_KEY`

**AWS Rekognition** (nuevas):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` — recomendado `us-east-1` (precio + latencia óptimos)

**Vercel Blob** (ya existía):
- `BLOB_READ_WRITE_TOKEN` — provisto automáticamente por la integración Blob

## Setup AWS Rekognition (3 minutos)

1. AWS Console → IAM → Users → Add user: `flux-kyc`
2. Access type: Programmatic access (sin console access)
3. Permissions: attach policy **AmazonRekognitionReadOnlyAccess** + **AmazonRekognitionCustomPoliciesAccess** (para DetectFaces + CompareFaces)

   Si querés minimizar scope, policy inline:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["rekognition:DetectFaces", "rekognition:CompareFaces"],
       "Resource": "*"
     }]
   }
   ```
4. Create user → copiá `Access key ID` + `Secret access key`
5. Pegalos en Vercel env vars como arriba

## Costos aproximados

| Paso | Proveedor | Costo por transacción |
|---|---|---|
| OCR DNI | Claude Opus 4.7 | ~$0.06 |
| Face-match | AWS Rekognition | $0.001 (CompareFaces) |
| DetectFaces x3 | AWS Rekognition | $0.003 |
| Blob storage | Vercel Blob | ~$0.00002 (150KB × 3) |
| **Total por KYC completo** | — | **~$0.065** |

A 100 KYCs/mes = $6.50/mes. A 1000/mes = $65. Escalable.

## Rate limits y anti-fraude

- Máx **3 intentos fallidos** por `correlation_id` en cada paso (OCR, match, face-compare).
- Al 4° → respuesta `blocked: true`, ticket a operaciones.
- `correlation_id` se genera una vez al inicio del flujo y persiste en la tabla `kyc_attempts` (audit trail completo).

## Privacidad y retención

- Imágenes se guardan en Vercel Blob con pathnames estructurados:  
  `kyc/<correlation_id>/<kind>-<timestamp>.<ext>`
- `addRandomSuffix: true` hace las URLs inadivinables (~8 chars random).
- **Nunca se exponen URLs públicas al cliente** — solo el admin ve vía un endpoint con auth (a implementar en próxima iteración).
- **Retention**: 180 días por default (`retention_until` en DB). Después se puede correr un cron de purga que borra blobs + nullifica `raw_ocr_json`.
- El texto OCR exacto **nunca se devuelve al cliente** — solo flags: `pass/review/reject` + mensaje genérico.

## Proveedores elegidos — decisiones técnicas

### OCR: Claude Opus 4.7 vía @ai-sdk/anthropic
- **Por qué**: mejor calidad que Tesseract local; structured output nativo; vision muy buena sobre documentos LATAM.
- **Alternativas consideradas**: AWS Textract AnalyzeID ($0.05 por pág — similar), Google Vision ($0.0015, más barato pero peor layouting para DNIs peruanos), Truora (regional, requiere contrato).
- **Trade-off**: Claude es 40× más caro que Google Vision pero el output estructurado + calidad justifica en KYC (no en OCR masivo).

### Face-match: AWS Rekognition
- **Por qué**: API maduro, SDK Node sólido, sin mínimos, score numérico confiable, pay-per-use.
- **Alternativas consideradas**: Azure Face API (similar, más setup), Truora (regional, buen precio pero contrato obligatorio), FaceTec (caro, enfoque enterprise), iProov (best-in-class liveness pero pricing alto).
- **Trade-off**: Rekognition no tiene liveness grado bancario; lo compensamos con challenge de 3 frames + yaw check. Para volumen alto o fraude sofisticado, migrar a AWS Face Liveness o Truora.

### Storage: Vercel Blob
- **Por qué**: ya instalado, zero-config con Vercel, path-based acceso.
- **Trade-off**: solo permite `access: 'public'` en v2 (no signed URLs nativas). Mitigado con pathnames obscurecidos + ACL a nivel de endpoint en el futuro.

## Liveness: qué resiste y qué NO

**Resiste:**
- ✅ Foto impresa (no tiene pose variation)
- ✅ Screenshot estático de foto en pantalla
- ✅ Intentos de usar foto del DNI como selfie

**No resiste** (requiere proveedor dedicado):
- ❌ Video deepfake con movimiento real
- ❌ Máscara impresa 3D de alta calidad
- ❌ Display de video con misma persona moviendo la cabeza

Para Flux con ticket promedio $85-175/mes, el nivel actual es proporcional al riesgo. Si el fraude escala, migrar a AWS Face Liveness (SDK dedicado, detecta depth cues, ~$0.025 por check).

## Testing manual

1. **DNI**: `https://www.fluxperu.com/checkout?slug=macbook-air-13-m4&months=24`
2. Llenar form hasta paso de identity
3. Capturar DNI (auto o manual)
4. Capturar selfie siguiendo challenge
5. Verificar en Stripe Dashboard que el Checkout Session se crea
6. Verificar en DB: `SELECT * FROM kyc_dni_scans ORDER BY created_at DESC LIMIT 1`
7. Verificar en DB: `SELECT * FROM kyc_face_matches ORDER BY created_at DESC LIMIT 1`
8. Verificar `users.kyc_status = 'verified'`

## Debugging

- Logs estructurados con prefijo `[kyc/<paso>]` en Vercel Functions logs
- `correlation_id` queda registrado en todas las filas y logs para trazabilidad
- Tabla `kyc_attempts` tiene audit completo:
  ```sql
  SELECT step, outcome, reason, created_at
  FROM kyc_attempts
  WHERE correlation_id = '...'
  ORDER BY created_at;
  ```

## Roadmap futuro

- [ ] Wiring completo en checkout (reemplazar CameraModal actual por DniCaptureGuided + SelfieLiveness)
- [ ] Panel admin para revisar KYC en estado `review`
- [ ] Cron de purga por `retention_until`
- [ ] Endpoint signed-image con auth para que admin pueda ver evidencia
- [ ] Migración a AWS Face Liveness si el fraude escala
- [ ] Soporte para CE y pasaporte (relajar CHECK constraint)
- [ ] Tests automatizados (MRZ, Jaro-Winkler, normalize)
