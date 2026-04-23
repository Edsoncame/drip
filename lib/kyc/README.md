# KYC Pipeline — Flux

> Verificación de identidad end-to-end. Clasifica cada intento en
> `verified`, `rejected` o deja que el arbiter IA lo resuelva. Nunca se
> queda en `review` — el user siempre recibe veredicto inmediato.

---

## 1. Visión general

El pipeline opera sobre 3 inputs que el cliente sube durante el checkout:

1. **DNI anverso** — foto del frente del documento
2. **DNI reverso** — foto del dorso (con MRZ)
3. **Selfie con DNI** — selfie del titular sosteniendo su DNI, con liveness

Pasa por 2 grandes fases:

### Fase A — Pipeline clásico (determinístico, rápido, siempre activo)

| Paso | Módulo | Qué hace |
|---|---|---|
| OCR DNI | `lib/kyc/ocr.ts` | Claude Vision extrae apellidos, prenombres, DNI number, MRZ, fechas |
| MRZ parse | `lib/kyc/mrz.ts` | Parser TD1 + check digits ICAO 9303 para validar MRZ |
| Name match | `lib/kyc/match.ts` | Jaro-Winkler normalizado (tildes/Ñ insensible) entre form y DNI |
| Face match | `lib/kyc/face.ts` | AWS Rekognition CompareFaces + liveness por head yaw |

**Salida:** `name_score` (0-1), `face_score` (0-100), `liveness_passed` (bool).

### Fase B — Pipeline forense (Fase 4 del P2-1, agregada 22-abr-2026)

4 capas **cuantitativas** que corren en paralelo contra el DNI + selfie:

| Capa | Módulo | Señal | Detecta |
|---|---|---|---|
| ELA + copy-move + photo-edge + noise | `lib/kyc/forensics.ts` | `overall_tampering_risk` 0-1 | Manipulación digital de la imagen |
| Template NCC | `lib/kyc/template.ts` | `layout_score` 0-1 + issues | Layout no coincide con DNI peruano real |
| Age consistency | `lib/kyc/age-consistency.ts` | `deviation_years` 0-N | Rostro en selfie vs edad del DNI |
| Cross-user duplicates | `lib/kyc/duplicates.ts` | `dni_reused_by_other_user` bool | DNI reutilizado por otro user_id |

**Salida:** JSON scores cacheados en columnas JSONB de `kyc_dni_scans`:
`forensics_json`, `template_json`, `age_consistency_json`, `duplicates_json`.

### Fase C — Arbiter IA (`lib/kyc/arbiter.ts`)

Para casos borderline (name_score 0.8-0.9, forensics concerning, etc.),
Claude Opus con vision recibe:
- Las 2 imágenes (DNI + selfie)
- Los scores de Fase A
- Los 4 signals cuantitativos de Fase B (si existen)

Y emite un veredicto final (`verified` | `rejected`) con confidence + reason.

---

## 2. Flujo end-to-end en `/api/kyc/verify/route.ts`

```
1. Leer kyc_dni_scans + kyc_face_matches por correlation_id
2. Si hay caché JSONB, usarla; sino:
   Descargar imagen_anverso_key + selfie_key desde Blob
   Promise.all con timeout 8s c/u:
     - analyzeDniForensics()
     - matchDniTemplate('front')
     - checkAgeConsistency() si hay DOB
     - checkDuplicates() por dni_number
   Persistir resultados en columnas JSONB
3. Aplicar umbrales clásicos (face, liveness, name)
4. Si KYC_FORENSICS_ENFORCE=true aplicar reglas forenses (ver §5)
5. Si quedó en 'review' → arbiter con Claude Opus (con signals en payload)
6. UPDATE users.kyc_status + kyc_verified_at + legal_name/apellidos
7. logAttempt con audit completo
8. Retornar { status, reason, correlation_id, identity_verified, arbiter_used }
```

---

## 3. Estados posibles

`users.kyc_status` acepta: `pending | capturing | review | verified | rejected | blocked`.

En producción el código **nunca deja `review`** — el arbiter siempre lo
resuelve a `verified` o `rejected`. El estado `review` solo existe como
constraint de DB para compatibilidad.

---

## 4. Variables de entorno

```sh
# Fase A — clásico
KYC_NAME_MATCH_MIN=0.90      # auto-pass por nombre
KYC_NAME_MATCH_REVIEW=0.80   # debajo = rechazo duro
KYC_FACE_MATCH_MIN=85        # % AWS Rekognition
KYC_LIVENESS_YAW_MIN=10      # grados head yaw

# Fase B — forense
KYC_FORENSICS_ENFORCE=false            # modo observación por default
KYC_FORENSICS_REJECT_THRESHOLD=0.75    # overall_risk ≥ este → auto-reject
KYC_FORENSICS_ARBITER_THRESHOLD=0.4    # overall_risk ≥ este → fuerza arbiter
KYC_TEMPLATE_MIN_SCORE=0.6             # layout < este → fuerza arbiter
KYC_AGE_TOLERANCE_YEARS=3              # rango AGE_RANGE Rekognition
KYC_SELFIE_DUPLICATE_CHECK=off         # stub, no collection AWS

# UI
NEXT_PUBLIC_KYC_BLUR_THRESHOLD=40

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

---

## 5. Reglas de decisión

### Modo observación (`KYC_FORENSICS_ENFORCE=false`, default)

Solo aplican las reglas clásicas:

| Condición | Resultado |
|---|---|
| `!liveness_passed` | rejected |
| `!face.passed` (score < `KYC_FACE_MATCH_MIN`) | rejected |
| `name_score < 0.80` | rejected |
| `name_score 0.80–0.90` | → arbiter (con signals si están cached) |
| Todo OK | verified |

Las 4 capas forenses **siguen corriendo** y guardando en JSONB para análisis,
pero **no alteran el veredicto**.

### Modo enforcing (`KYC_FORENSICS_ENFORCE=true`)

Antes de verified, se aplican estas reglas:

| Condición | Resultado |
|---|---|
| `duplicates.dni_reused_by_other_user` | auto-reject |
| `forensics.overall_tampering_risk > 0.75` | auto-reject |
| `forensics.overall > 0.4` OR `template.layout < 0.6` OR `age.deviation > 5` | → arbiter |
| Todo OK | verified |

El arbiter ve los scores en su prompt y ajusta su veredicto.

---

## 6. Fixtures reales pendientes

Para activar los signals de `template.ts` + los adversariales "DNI real" de
`forensics.ts`, colocá estos archivos (anonimizados, con permiso):

```
lib/kyc/__fixtures__/
├── dni-template-front.png   # DNI peruano auténtico anverso (calibración template)
├── dni-template-back.png    # reverso con MRZ
├── dni-real-front.jpg       # activa test 'DNI auténtico risk < 0.2'
└── dni-tampered-front.jpg   # activa test 'DNI con foto montada risk > 0.6'
```

Sin esos fixtures, los tests relacionados están en `.skip()` y `matchDniTemplate`
retorna `layout_score: 0.5 neutral + issue "pending calibration"`.

---

## 7. Cómo operar

### Activar modo enforcing en producción

1. Verificar que hay al menos 100 KYCs procesados en **modo observación** con
   sus JSONB poblados (`SELECT COUNT(*) FROM kyc_dni_scans WHERE forensics_json IS NOT NULL`).
2. Analizar la distribución de `overall_tampering_risk` en datos limpios
   (usuarios que se sabe son legítimos). Esperamos:
   - P95 < 0.4, P99 < 0.6
3. Si la distribución parece saludable, setear `KYC_FORENSICS_ENFORCE=true`
   en Vercel env y redeploy.
4. Monitorear la tasa de `auto-rejected by forensics` y `auto-rejected by
   duplicates` en los logs `[kyc/verify] ENFORCE auto-reject by ...`.

### Rollback rápido

```
vercel env rm KYC_FORENSICS_ENFORCE production
vercel env add KYC_FORENSICS_ENFORCE production  # valor: false
```

### Debug de un KYC específico

```sql
SELECT
  correlation_id,
  dni_number,
  forensics_json,
  template_json,
  age_consistency_json,
  duplicates_json
FROM kyc_dni_scans
WHERE correlation_id = 'xxx'
ORDER BY created_at DESC LIMIT 1;
```

---

## 8. Costos

| Componente | Costo/KYC |
|---|---|
| Claude Vision OCR | ~$0.003 |
| AWS Rekognition (3 calls) | ~$0.003 |
| Vercel Blob (3 imgs, retention 30d) | ~$0.0001 |
| Forensics (sharp, JS puro, sin red) | $0 |
| Template matching (sharp, JS puro) | $0 |
| Arbiter (solo ~15% de casos) | ~$0.05 si se activa |
| **Total típico** | **<$0.01** |
| **Con arbiter** | **~$0.06** |

---

## 9. Tests

`npm test` corre:
- `mrz.test.ts` — parseo MRZ ICAO 9303
- `match.test.ts` — Jaro-Winkler + normalización
- `forensics.test.ts` — ELA, copy-move, photo-edge, noise (adversariales programáticos)
- `template.test.ts` — API surface + pending fallback
- `age-consistency.test.ts` — mock Rekognition
- `duplicates.test.ts` — mock pg queries

Fixtures reales producen tests adicionales marcados `.skip()` hasta que
existan los archivos en `__fixtures__/`.
