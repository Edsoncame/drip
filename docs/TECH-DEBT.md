# FLUX — Informe de Deuda Técnica

> **Auditoría:** 20 abr 2026 · agente `Explore` + verificación manual · leer primero `ARCHITECTURE.md`.

Clasificación:

- 🔴 **P0** — Rompe producción / pierde dinero
- 🟠 **P1** — Bug silencioso, no visible al usuario pero afecta datos o notificaciones
- 🟡 **P2** — Deuda / cleanup que dificulta mantenimiento
- ⚪ **P3** — Nice-to-have

---

## 🔴 P0 — No se detectaron issues P0 vigentes

El proyecto **no tiene fugas activas de dinero ni outages**. Las issues críticas previas (RESEND_API_KEY expirada) se resolvieron el 18-abr.

---

## 🟠 P1-1 — Status legacy `'active'` en queries del webhook Stripe

**Archivos y líneas exactas:**

- `app/api/webhooks/stripe/route.ts:387` — `WHERE ... status IN ('active', 'shipped', 'delivered')`
- `app/api/webhooks/stripe/route.ts:488` — idem
- `app/api/cron/generate-payments/route.ts:52` — `WHERE s.status IN ('active', 'delivered')`
- `app/admin/page.tsx:69-70` — `FILTER (WHERE status IN ('delivered','active'))` para MRR calc

**Por qué importa:**
El 18-abr migramos de `status='active'` → `preparing/shipped/delivered/...`. El webhook nuevo siempre crea subs con `'preparing'`. Pero estas queries **no incluyen `'preparing'`** en el filtro:

- Si una subscription `preparing` recibe un `invoice.paid` (cobro recurrente del 2º mes), la query devuelve 0 rows → **el pago no se procesa ni se inserta en `payments`** → aparece cobrado en Stripe pero invisible en `/admin/pagos`.
- MRR calculado en el dashboard está **subestimado** porque no cuenta las que están en `preparing` o `shipped`.

**Fix propuesto:**
1. Reemplazar `'active'` por el set correcto: `('preparing', 'shipped', 'delivered')` — estos son los 3 estados con facturación activa.
2. Dejar `'active'` como fallback solo si `payment_method IS NULL` (legacy MP/Culqi) — documentar como deprecated en comentario.
3. Auditar TODAS las queries con `status IN` en una sola pasada para coherencia.

**Costo estimado:** 20 min + test manual en staging.

---

## 🟠 P1-2 — Emails se silencian sin logging (.catch(() => {}))

**23+ ocurrencias** del patrón `sendEmail({...}).catch(() => {})`:

```
app/api/webhooks/stripe/route.ts:200,320,345,...
app/api/admin/subscriptions/route.ts:93,112
app/api/subscriptions/[id]/cancel/route.ts:73,79
app/api/admin/payments/route.ts:47,68
app/api/rentals/[id]/purchase/route.ts:74,92
app/api/rentals/[id]/return/route.ts:82,100
... (lista completa en reporte agent)
```

**Por qué importa:**
Si Resend falla (rate limit, auth expirada, DKIM roto), el cliente **no recibe** su notificación y nosotros **no nos enteramos**. Esto ya pasó el 18-abr con la RESEND_API_KEY expirada: si no hubiera sido la primera venta y el cliente no hubiera reclamado, no lo hubiéramos detectado.

**Fix propuesto (P1 mínimo):**
Crear un helper `lib/email.ts` que reemplace el pattern:

```ts
// En vez de: sendConfirmationEmail({...}).catch(() => {})
await sendEmailSafe({ fn: () => sendConfirmationEmail(...), context: "checkout_confirmation", subscriptionId });
// sendEmailSafe hace el try/catch Y loggea a tabla `email_failures` + console.error
```

Luego un replace global (sed) de los `.catch(() => {})`.

**Fix propuesto (ideal):**
Queue de emails con retry exponencial (Vercel Queues ya existe — público beta). Más esfuerzo pero resiliente.

**Costo estimado:**
- Helper + replace: 1h
- Queue completa: 3-4h

---

## 🟠 P1-3 — KYC: ruta muerta cuando imagen key no es URL absoluta

**Archivo:** `app/api/kyc/verify/route.ts:96-145`

**Comportamiento actual:**
```ts
if (status === "review") {
  if (dniUrl?.startsWith("http") && selfieUrl?.startsWith("http")) {
    // arbiter corre normal
  } else {
    status = "rejected";  // ← rechaza silenciosamente
  }
}
```

**Por qué importa:**
Si por cualquier razón los uploads guardaron keys **sin prefijo `http://`** (legacy Blob format, migración incompleta, etc.), el arbiter nunca corre y el usuario se queda rechazado sin motivo válido. No hay log, no hay alerta.

**Fix propuesto:**
1. Grep de `imagen_anverso_key` en la DB para ver si hay rows con keys no-URL
2. Si hay, migrar keys → URLs absolutas
3. Cambiar el `else` a loguear warning y reintentar con URL construida desde `BLOB_READ_WRITE_TOKEN`

**Costo estimado:** 30 min de investigación + fix según qué revele el grep.

---

## 🟡 P2-1 — Refactor `AgentsScene.tsx` — EN PROGRESO (22-abr-2026)

**Antes:** 3885 líneas (monolito con 14+ subcomponentes + 23 useState inline)

**Ahora:** 3265 líneas + 5 módulos satellite nuevos

**Fases completadas:**

| Fase | Módulo extraído | Delta | Commit |
|---|---|---|---|
| 1 | `orchestrator-utils.ts` + `audio-utils.ts` | -128 | `f363a59` |
| 2 | `types.ts` | -46 | `2737e43` |
| 3 | `MarkdownLite.tsx` (+ CopyableCode, CopyButton) | -237 | `f716c14` |
| 4 | `chat-visuals.tsx` (ChatBubble, ClusterRing) | -56 | `3616891` |
| 5 | `agent-panels.tsx` (CurrentTaskPanel, StepsPanel) | -153 | `320be49` |

**Total reducido:** 620 líneas (~16%). Typecheck + tests pasando en cada commit.

**Fases pendientes (diferidas a próxima sesión):**

- **Fase 6** — extraer `AgentAvatar` (~235 líneas, lógica motion compleja)
- **Fase 7** — extraer `RecordingPanel` (~108 líneas, Web Speech API)
- **Fase 8** — extraer `BlockerChatCard` (~410 líneas, API calls + estado)
- **Fase 9** — extraer modales: `FinanceModal`, `GalleryModal`, `AgentDetailPanel`, `FileViewerModal` (~785 líneas)
- **Fase 10** — custom hooks: `useAgentState`, `useAutopilot`, `useChat`, `useVoiceRecording`, `useDragDrop`, `useMusic`

**Estado final esperado:** AgentsScene.tsx como glue ~500 líneas + 10-12 módulos satellite. Estimación: 2-3h más trabajo.

**Por qué pausamos acá:** las fases 6-10 tocan componentes con estado interno + API calls. Cada uno requiere verificación cuidadosa contra regresiones en la UI de `/admin/agentes` (feature crítica de operaciones). Mejor hacerlo en sesión dedicada con ventana de tiempo para QA manual del admin.

---

## ~~🟡 P2-2 — Env vars huérfanas~~ (RESUELTO — falso positivo)

**Verificación 22-abr-2026:** ambas variables SÍ se usan:

- `KYC_LIVENESS_YAW_MIN` → `lib/kyc/face.ts:36` (`LIVENESS_YAW_THRESHOLD = Number(process.env.KYC_LIVENESS_YAW_MIN ?? "8")`)
- `NEXT_PUBLIC_KYC_BLUR_THRESHOLD` → `components/kyc/DniCaptureGuided.tsx:22` (`BLUR_THRESHOLD = Number(process.env.NEXT_PUBLIC_KYC_BLUR_THRESHOLD ?? "90")`)

El auditor original no las encontró probablemente porque el grep no cubrió
`components/` o se saltó archivos `.tsx`. **No hay acción pendiente.**

---

## ⚪ P2-3 — `SELECT *` diferido (22-abr-2026)

**Auditoría:** 36 ocurrencias de `SELECT *` en 9 archivos (`lib/strategy-db.ts`, `lib/agents-db.ts`, `lib/agent-blockers.ts`, `lib/finance-providers.ts`, `lib/api-keys.ts`, `app/api/admin/{equipment,pricing,vault}/route.ts`, `app/api/admin/strategy/export-pdf/route.ts`, `app/api/kyc/{match,verify,selfie}/route.ts`).

**Decisión:** diferir el refactor. Razones:

1. **Volumen de datos actual es bajo** — las tablas `marketing_*` tienen <100 filas, `subscriptions` 13 filas. Payload overhead despreciable.
2. **Types genéricos actúan como filter** — `DbStrategy`, `ApiKey`, `Blocker` ya tipan el select.
3. **Riesgo de breaking** — 36 cambios mecánicos sin tests integrales detrás = alta chance de romper alguna feature silenciosamente.
4. **Valor incremental bajo** — el único caso con data potencialmente sensible es `/api/admin/vault` (contiene `value_encrypted` + `iv`), pero es admin y necesita esos campos.

**Cuándo revisitar:** si alguna tabla pasa 10K filas o si se agrega una columna sensible que NO debe salir vía API pública.

**Mitigación actual:** mantener los types explícitos en `query<T>()` — eso ya prevenía el problema cuando lo describimos originalmente.

---

## ~~🟡 P2-4 — Status 'active' legacy~~ (RESUELTO 22-abr-2026)

**Verificación DB producción:** 0 filas con `status='active'`. Solo hay 12 en `delivered` + 1 en `preparing`. El valor `'active'` era puramente histórico del código.

**Nota:** tampoco existe CHECK constraint en la tabla (no se valida a nivel DB). Agregar uno es opcional pero queda fuera del scope de P2-4.

**Acción ejecutada:** removido `'active'` de 8 queries productivas (commits 59fa10a + 0c038d9) y 2 docstrings (f5fd849). Archivos tocados:

- `app/admin/page.tsx`, `app/admin/clientes/page.tsx`
- `app/api/v1/b2b/me/route.ts`, `app/(main)/cuenta/pagos/page.tsx`
- `app/api/webhooks/stripe/route.ts`, `app/api/cron/generate-payments/route.ts`
- `lib/dropchat-sync.ts`, `lib/expansion-engine.ts`, `lib/kpi-queries.ts`

Si en el futuro aparece un INSERT con `'active'`, las queries productivas lo ignorarán — defensa silenciosa de la consistencia del estado.

---

## ~~🟡 P2-5 — Columnas `shipped_at` y `delivered_at`~~ (RESUELTO — no son audit-only)

**Verificación 22-abr-2026:** estas columnas **NO** son audit-only:

- **Write:** `app/api/admin/subscriptions/route.ts:46,50` — seteadas en NOW() cuando status cambia
- **Read:** `app/api/v1/b2b/subscriptions/route.ts:55-86` — expuestas en el contrato público de la **API B2B** a clientes externos

Son parte del contrato público. Los clientes B2B pueden estar parseando estas fechas para tracking. **No tocar ni renombrar** sin versionar la API.

Documentado en ARCHITECTURE.md sección "APIs" como contrato estable.

---

## ⚪ P3-1 — Naming mixto en rutas admin

- `/admin/usuarios` (español) vs `/admin/api-keys` (inglés)
- `/admin/productos` (español) vs `/admin/kyc` (acrónimo)

**Impact:** estético. No fixear a menos que se haga al mismo tiempo que un redesign.

---

## ⚪ P3-2 — 16 archivos con `TODO` / comentarios informativos

Ninguno es código pendiente real. Son docstrings tipo "Subir TODOS los archivos...". Noise, no acción.

---

## ⚪ P3-3 — Tablas que pueden estar vacías

Del `database-schema.md`:
- `marketing_media_matrix`
- `marketing_competitor_benchmarks`

Evaluar si se están llenando via agentes y si el UI de `/admin/estrategia` realmente las muestra. Si vacías >2 meses, considerar droppearlas.

---

## Resumen ejecutivo

| Categoría | Count | Esfuerzo total estimado |
|---|---|---|
| 🔴 P0 | 0 | — |
| 🟠 P1 | 3 | ~5-6h |
| 🟡 P2 | 5 | ~7h |
| ⚪ P3 | 3 | <2h |

**Recomendación:** atacar los 3 P1 esta semana (status queries, email silencing, KYC ruta muerta). Son bugs silenciosos que ya están o pueden estar causando pérdidas de datos invisibles en producción.

Los P2 se pueden abordar en un sprint dedicado de refactoring cuando no haya features pendientes. Los P3 son opt-in.

---

## Issues conocidos que NO son deuda (por contexto)

Documentados para que no los confundamos con bugs:

- **Google Ads API**: aplicación pendiente de aprobación (Basic Access enviado 19-abr). No se puede usar la API hasta que Google responda. ETA: 22-abr.
- **Meta Ads**: falta crear System User token en developers.facebook.com. Dependencia externa del admin.
- **EIN Flux Peru LLC**: pendiente IRS (30-abr a 14-may). Hasta que llegue no se puede abrir Mercury ni emitir corporate card.
- **BIMI / logo en Gmail sender**: no vale la pena (USD 1,500/año). Alternativa gratis: Gravatar con `hola@fluxperu.com`.
