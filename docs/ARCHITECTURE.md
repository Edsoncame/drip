# FLUX — Arquitectura del Proyecto

> **Para quién es este documento:** Cualquier desarrollador que llega nuevo al proyecto y necesita entender cómo funciona el todo en 20 minutos. Última actualización: **20 abr 2026**.

---

## Qué es FLUX

FLUX es una plataforma web de **alquiler mensual de MacBooks** en Lima, Perú. El modelo de negocio es subscription-based: el cliente alquila una MacBook por 8, 16 o 24 meses, paga mensualmente con tarjeta, y al vencer el contrato puede **devolver, comprar o seguir rentando**.

- **Dominio:** `https://www.fluxperu.com`
- **Entidad legal PE:** Tika Services S.A.C. (RUC 20605702512)
- **Entidad legal US:** Flux Peru LLC (Delaware, Stripe Atlas)
- **Admin principal:** `edsoncame@fluxperu.com`
- **Repo:** `Edsoncame/drip` (GitHub) → deploy automático en Vercel

---

## Stack técnico

### Framework y runtime

| Categoría | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 16.2.3** (App Router) | Runtime Node.js (no Edge), excepto `proxy.ts` |
| UI | React 19.2.4 + TypeScript 5 (strict) | |
| Styling | Tailwind CSS v4 + Framer Motion 12 | PostCSS v4 |
| Imagenes | `next/image` + Apple CDN + Vercel Blob | |

### Datos y auth

| Categoría | Tecnología | Notas |
|---|---|---|
| Base de datos | **PostgreSQL** en Railway | Cliente `pg` directo, **sin ORM** |
| Schemas | `ensureSchema()` idempotente por dominio | Ver `lib/*-db.ts` |
| Auth | JWT HS256 (`jose`) en cookie httpOnly `flux_session` | Edge-verifiable |
| Passwords | bcryptjs | |
| OAuth | Google (para login + Google Ads API) | |

### Pagos y email

| Categoría | Tecnología | Notas |
|---|---|---|
| Pagos | **Stripe** (API `2026-03-25.dahlia`) | USD, Checkout Sessions + Subscriptions |
| Legacy | ~~Culqi~~ | **eliminado** del código (solo metadata legacy en DB) |
| Email | **Resend** (`hola@fluxperu.com`) | Templates HTML hardcodeados en `lib/email.ts` |
| Storage | Vercel Blob | DNI scans, selfies, recibos, imágenes de productos |

### IA y KYC

| Categoría | Tecnología | Notas |
|---|---|---|
| LLM | Anthropic Claude (Opus 4.7 + Sonnet 4.6 + Haiku 4.5) | Via `@ai-sdk/anthropic` + Vercel AI SDK |
| OCR DNI | Claude Vision | `lib/kyc/ocr.ts` |
| Face match | AWS Rekognition | `lib/kyc/face.ts`, `lib/kyc/match.ts` |
| Arbiter KYC | Claude Opus vision | `lib/kyc/arbiter.ts` — resuelve casos borderline |

### Integraciones externas

- **Google Ads API** (pendiente Basic Access, aplicación enviada 19-abr-2026)
- **Google Search Console** (operativo con service account)
- **Google Analytics 4** (property `533276065`, operativo)
- **Meta Ads** (pendiente System User token)
- **Dropchat** (sync de catálogo para WhatsApp)
- **SUNAT** (validación RUC en vivo)
- **SimpleMDM** (bloqueo remoto de equipos, externo)

---

## Estructura del repositorio

```
~/Projects/flux/web/
├── app/                          # Next.js App Router (173 archivos TS/TSX)
│   ├── (main)/                   # Grupo: pages públicas + cuenta (navbar/footer)
│   ├── admin/                    # Dashboard admin (14 subrutas)
│   ├── api/                      # 82 endpoints REST
│   ├── auth/                     # Login, registro, password reset
│   ├── checkout/                 # Flujo de pago (3 pasos)
│   ├── layout.tsx                # Root layout + GTM
│   ├── robots.ts                 # SEO
│   └── sitemap.ts                # SEO
│
├── components/                   # 22 componentes compartidos
│   ├── kyc/                      # DniCaptureGuided, SelfieLiveness
│   ├── checkout/                 # AddressAutocomplete (Google Maps)
│   └── *.tsx                     # Navbar, Footer, Hero, ProductCard, etc.
│
├── lib/                          # 50 módulos de negocio
│   ├── kyc/                      # OCR, face match, arbiter, blob
│   ├── db.ts                     # Postgres pool
│   ├── auth.ts                   # JWT + sesiones
│   ├── stripe.ts                 # Cliente Stripe
│   ├── email.ts                  # Resend wrapper
│   └── ...                       # (ver sección "Módulos lib/")
│
├── public/                       # Assets estáticos
│   ├── images/                   # Logos, isotipo, imágenes de productos
│   ├── icon-192.png              # PWA icon
│   └── icon-512.png              # PWA icon
│
├── scripts/                      # 10 utilitarios Node.js / Bash
├── data/flux-marketing/          # Workspace de agentes IA (rsync desde repo externo)
├── docs/                         # Documentación
│   ├── ARCHITECTURE.md           # ⬅ este archivo
│   ├── TECH-DEBT.md              # Informe de deuda técnica
│   └── database-schema.md        # Schema DB canónico
│
├── proxy.ts                      # Edge middleware (auth + admin gates)
├── next.config.ts                # Config Next (image hosts, file tracing)
├── vercel.json                   # 10 cron jobs
└── .env.example                  # 41 variables de entorno documentadas
```

---

## Flujos principales (end-to-end)

### 1. Onboarding y compra (checkout)

```
Usuario visita /laptops/[slug]
  ↓ click "Rentar por $X/mes"
/checkout
  ↓ Step 1 — Plan: selector cantidad + AppleCare+ toggle
  ↓ Step 2 — Datos + KYC:
    ├─ Persona o Empresa (+ validación RUC SUNAT en vivo)
    ├─ DNI number + foto DNI + selfie con DNI
    └─ Dirección (Lima, 41 distritos)
  ↓ Step 3 — Pago (Stripe Checkout)
POST /api/checkout → crea Stripe session
  ↓ Stripe cobra primer mes
POST /api/webhooks/stripe (checkout.session.completed)
  ↓ crea user (si guest) → crea subscription (status='preparing')
  ↓ hidrata KYC desde kyc_dni_scans + kyc_face_matches
  ↓ inserta primer payment (status='validated')
  ↓ envía email de confirmación
/checkout/success
```

**Archivos clave:**
- `app/checkout/page.tsx` — UI de 3 pasos
- `app/api/checkout/route.ts` — crea Stripe session
- `app/api/webhooks/stripe/route.ts` — handler post-pago
- `lib/kyc/arbiter.ts` — decisión final KYC borderline

### 2. KYC (Know Your Customer)

```
Cliente en Step 2 del checkout
  ↓ foto DNI frente
POST /api/kyc/dni → Claude Vision OCR → guarda en kyc_dni_scans
  ↓ selfie
POST /api/kyc/selfie → AWS Rekognition liveness → kyc_face_matches
  ↓ name match (Levenshtein)
POST /api/kyc/match → score vs DNI parseado
  ↓
POST /api/kyc/verify → decisión:
  ├─ aprobar si name_sim >= 0.90 Y face_score >= 85
  ├─ rechazar si name_sim < 0.80 O face_score < 70
  └─ arbiter (Claude Opus) si borderline
       → verified O rejected (nunca 'review' en producción)
```

**Archivos clave:** `app/api/kyc/*/route.ts`, `lib/kyc/*`

### 3. Ciclo de vida de una suscripción

Estados (`subscriptions.status`):

| # | Estado | Cuándo | Cliente ve | Admin ve |
|---|---|---|---|---|
| 1 | `preparing` | Pagado + KYC ok | "Preparando tu Mac" | "Alistar equipo" |
| 2 | `shipped` | Despachado | "En camino" | "Motorizado en ruta" |
| 3 | `delivered` | Entregado y firmado | "Entregado" | "Activo en cliente" |
| 4 | `paused` | Morosidad/acuerdo | "Pausado" | "Revisar morosidad" |
| 5 | `cancelled` | Cancelado pre-entrega | "Cancelado" | "Cancelado" |
| 6 | `completed` | Contrato cerrado | "Completado" | "Cerrado" |

> **Nota:** existe además `active` como valor **legacy** (pre-migración del 18-abr-2026). La migración ya corrió, pero hay queries que aún lo referencian — ver `docs/TECH-DEBT.md` sección 3.

### 4. End-of-contract (3 caminos)

Al vencer `subscriptions.ends_at`, el cliente ve en `/cuenta/rentas`:

1. **Devolver** (`end_action='return'`) → coordinar recojo/entrega → factory reset + cerrar
2. **Comprar** (`end_action='purchase'`) → precio residual USD → coordinar pago, quitar MDM
3. **Seguir rentando** (`end_action='auto_extend'`) → webhook extiende `ends_at +1 mes`

Límites máximos de extensión:

| Plan original | Máximo total | Después |
|---|---|---|
| 8 meses | 16 meses | Compra o devuelve |
| 16 meses | 24 meses | Compra o devuelve |
| 24 meses | 30 meses | Compra o devuelve |

### 5. Agentes de marketing (14 agentes IA)

```
/admin/agentes → AgentsScene.tsx (3D-style pixel UI)
  ↓ usuario delega tarea al Orquestador
POST /api/admin/agents/chat → runAgent() en lib/agent-runner.ts
  ↓ Orquestador (Claude Opus) analiza contexto
  ↓ delega con tool `delegate_to_agent` (handoff depth < 4)
  ├─ seo-specialist → GSC tools
  ├─ sem-manager → Meta Ads + Google Ads tools (bloqueado hasta aprobación)
  ├─ data-analyst → GA4 tools
  ├─ programador-fullstack → GitHub tools
  └─ ... (14 total)
  ↓ cada agente escribe archivos en data/flux-marketing/<agent>/
  ↓ marketing_agent_files + marketing_agent_runs (tracking DB)
```

**Autopilot:** cron cada 10 min (`*/10 * * * *`) corre top 3 agentes elegibles en paralelo con cap de gasto `DAILY_AUTOPILOT_COST_CAP_USD` (default $20/día).

### 6. Dispatching y operaciones

```
Admin en /admin
  ↓ ve tabla con rentas en `preparing`
  ↓ prepara equipo físico (AppleCare+, SimpleMDM MDM setup)
  ↓ click "📦 Despachar"
    ├─ si shipping → input tracking number → email "Tu Mac está en camino"
    └─ si pickup → email "Tu Mac está lista para recoger"
  ↓ status → shipped
Admin entrega equipo + cliente firma
  ↓ click "✅ Entregado"
  ↓ status → delivered
Cobro automático mensual (Stripe invoice.paid webhook)
  ↓ inserta payment + extiende ends_at
```

---

## Módulos `lib/` (50 archivos) — mapa por dominio

### Database & Auth

| Archivo | Responsabilidad |
|---|---|
| `db.ts` | Pool de Postgres, `query<T>()` helper |
| `auth.ts` | JWT, `requireAdmin()`, `requireSuperAdmin()`, `getSession()` |
| `api-keys.ts` | API keys B2B (SHA-256, scopes, rate limit) |
| `vault.ts` | AES-256-GCM para credenciales en `vault_entries` |

### KYC (`lib/kyc/`)

| Archivo | Responsabilidad |
|---|---|
| `ocr.ts` | Claude Vision para parsear DNI (apellidos, número, MRZ) |
| `mrz.ts` | Parser MRZ (con tests en `__tests__/`) |
| `match.ts` | Levenshtein name comparison |
| `face.ts` | AWS Rekognition liveness + face compare |
| `blob.ts` | Upload/download de imágenes privadas en Vercel Blob |
| `arbiter.ts` | Claude Opus vision para casos borderline — veredicto final siempre `verified` o `rejected` |
| `db.ts` | Tablas `kyc_dni_scans`, `kyc_face_matches`, `kyc_attempts` + `ensureKycSchema()` |

### Commerce

| Archivo | Responsabilidad |
|---|---|
| `stripe.ts` | Cliente Stripe + `validateWebhook()` |
| `products.ts` | CRUD catálogo (`products` table) |
| `pricing-formula.ts` | Cálculo dinámico precio según modelo/plan/AppleCare |
| `contract-pdf.ts` | Generación PDF contrato de renta con `pdf-lib` |
| `shipping/lima-rates.ts` | Tarifa de flete por distrito |
| `referrals.ts` | Códigos de referido |
| `appleImages.ts` | Scraper de Apple Store para imágenes de producto |

### Marketing agents

| Archivo | Responsabilidad |
|---|---|
| `agents.ts` | `AGENTS_ROOT`, `AgentId` union, filesystem resolver |
| `flux-agents.ts` | Metadata de los 14 agentes + ToolLoopAgent del AI SDK |
| `agent-runner.ts` | Executor — model selection, tool calls, token tracking |
| `agent-autopilot.ts` | Scheduler + cost guard |
| `agent-models.ts` | Claude Opus/Sonnet/Haiku selection + pricing map |
| `agent-tools.ts` | Tools compartidas (file, web_fetch, web_search) |
| `agent-handoffs.ts` | `delegate_to_agent` tool + depth tracking |
| `agent-blockers.ts` | Auto-detección de env vars faltantes + chat para resolver |
| `flux-infra-context.ts` | Contexto FLUX inyectado en system prompt |
| `agents-db.ts` | Tablas `marketing_agent_files`, `marketing_agent_runs` |

### Strategy management

| Archivo | Responsabilidad |
|---|---|
| `strategy-db.ts` | 13 tablas `marketing_strategy_*` |
| `strategy-pdf.ts` | Export PDF |
| `strategy-tools.ts` | Tools para agentes (update KPIs, benchmarks) |

### Integraciones externas

| Archivo | Responsabilidad |
|---|---|
| `google-ads.ts` + `google-ads-tools.ts` | Google Ads API (pendiente Basic Access) |
| `gsc.ts` | Google Search Console (operativo) |
| `meta-ads.ts` | Meta Ads API (pendiente System User token) |
| `dropchat-sync.ts` + `dropchat-catalog.ts` | Dropchat integration |
| `finance-providers.ts` + `finance-pullers.ts` | Agregación de burn rate desde múltiples fuentes |

### Email y analytics

| Archivo | Responsabilidad |
|---|---|
| `email.ts` | Resend wrapper + 13 templates HTML |
| `analytics.ts` | GA4 event tracking server-side |
| `ga4.ts` | GA4 Data API client |

---

## Rutas frontend (mapa rápido)

### Públicas (navbar + footer)

- `/` — home
- `/laptops` — catálogo
- `/laptops/[slug]` — detalle de producto
- `/laptops/comparar` — comparador
- `/como-funciona`, `/empresas`, `/blog`, `/blog/[slug]`
- `/ayuda`, `/contacto`, `/privacidad`, `/terminos`
- `/reclamaciones`, `/libro-de-reclamaciones`
- ~10 landing pages SEO por ubicación: `/alquiler-macbook-miraflores`, `/alquiler-macbook-san-isidro`, etc.
- ~3 landing pages SEO por contexto: `/leasing-laptops-peru`, `/macbook-mensual-peru`

### Auth (sin layout de marketing)

- `/auth/login`, `/auth/registro`, `/auth/recuperar`, `/auth/nueva-password`, `/auth/cambiar-password`

### Cuenta (usuario logueado)

- `/cuenta` — dashboard
- `/cuenta/rentas` — suscripciones + end-of-contract actions
- `/cuenta/pagos` — historial de pagos + recibos
- `/cuenta/referidos` — código de referido

### Checkout

- `/checkout`, `/checkout/success`

### Admin (auth + `is_admin=true`)

- `/admin` — dashboard principal con KPIs
- `/admin/usuarios`, `/admin/clientes` — CRM
- `/admin/rentas`, `/admin/pagos`, `/admin/kyc`
- `/admin/inventario`, `/admin/productos`, `/admin/precios`
- `/admin/estrategia` — marketing strategies
- `/admin/agentes` — 14 agentes IA
- `/admin/reclamaciones` — Indecopi
- `/admin/api-keys` — B2B access
- `/admin/finanzas` — burn rate, Google/Meta spend
- `/admin/vault` — credenciales cifradas (super-admin only)

---

## APIs (82 endpoints — resumen por sección)

| Sección | Prefijo | Endpoints | Auth |
|---|---|---|---|
| Auth | `/api/auth/*` | 9 | Pública / JWT |
| KYC | `/api/kyc/*` | 4 | Pública (correlation_id) |
| Checkout | `/api/checkout` | 1 | Pública |
| Subscriptions | `/api/subscriptions/*`, `/api/rentals/*` | 5 | JWT |
| Webhooks | `/api/webhooks/stripe` | 1 | HMAC |
| Productos | `/api/products/*`, `/api/apple-images` | 3 | Pública |
| Admin | `/api/admin/*` | ~40 | `requireAdmin()` |
| Agentes | `/api/admin/agents/*` | 12 | Admin |
| Cron | `/api/cron/*` | 10 | `CRON_SECRET` |
| B2B | `/api/v1/b2b/*` | ~5 | API key + scope |
| Utils | `/api/upload`, `/api/geocode`, `/api/verify-ruc`, `/api/stock`, ... | ~10 | Mixto |

**Convención:** todos los endpoints admin empiezan con `/api/admin/` y usan `await requireAdmin()` al inicio del handler.

---

## Cron jobs (vercel.json)

| Schedule | Endpoint | Qué hace |
|---|---|---|
| `0 6 * * *` | `/api/cron/generate-payments` | Genera invoices Stripe para suscripciones activas |
| `0 14 * * *` | `/api/cron/payment-reminders` | Reminders de pago pendiente |
| `*/10 * * * *` | `/api/cron/agents?job=autopilot&max=2` | Autopilot agentes (max 2 en paralelo) |
| `0 14 * * 1` | `.../agents?job=weekly-seo-scan` | SEO scan semanal (lun) |
| `0 15 * * 1` | `.../agents?job=weekly-compet-scan` | Análisis competencia (lun) |
| `0 15 * * 5` | `.../agents?job=weekly-content-cal` | Content calendar (vie) |
| `0 13 1 * *` | `.../agents?job=monthly-data-report` | Reporte mensual (1º) |
| `0 3 * * *` | `/api/cron/kyc-purge` | Purgar imágenes KYC según `retention_until` |
| `0 8 * * *` | `/api/cron/finance` | Pull finanzas (Google Ads, Meta, Stripe) |
| `0 4 * * *` | `/api/cron/dropchat-sync` | Sync inventario → Dropchat |

---

## Base de datos — schema (33 tablas)

Fuente canónica: **`docs/database-schema.md`** (leer ese para detalle de columnas + constraints).

### 8 dominios

| Dominio | Tablas |
|---|---|
| **identity** | `users`, `password_reset_tokens`, `referrals`, `api_keys`, `api_key_usage` |
| **commerce** | `subscriptions`, `payments`, `payment_invoices` |
| **catalog** | `products`, `pricing` |
| **inventory** | `equipment` |
| **kyc** | `kyc_attempts`, `kyc_dni_scans`, `kyc_face_matches`, `kyc_events` |
| **compliance** | `libro_reclamaciones` |
| **marketing** | 14 tablas `marketing_*` (strategies, objectives, kpis, tasks, experiments, content_calendar, sem_plans, budget, reports, benchmarks, media_matrix, agent_runs, agent_files, blockers) |
| **ops** | `vault_entries` |

### Tablas críticas a recordar

- **`users`** (PK `id` UUID): `email` unique, `password_hash`, `kyc_status`, `is_admin`, `is_super_admin`, `referral_code`, `dni_number`
- **`subscriptions`** (PK `id` UUID): `user_id`, `product_slug`, `months`, `monthly_price`, `status` (6 valores activos + `active` legacy), `mp_subscription_id` (Stripe sub id, nombre legacy), `payment_method` ('stripe' en prod), `delivery_*`, `dni_*`, `end_action`
- **`payments`** (PK `id` UUID): `subscription_id`, `amount`, `status`, `payment_method`, `period_label`, `stripe_payment_id`, `receipt_url`
- **`equipment`** (PK `serial`): 50+ campos (modelo, chip, ram, ssd, estado_actual, cliente_actual, financiamiento, valores contables)
- **`kyc_dni_scans`**: OCR output + `correlation_id` + `retention_until` (GDPR)
- **`marketing_agent_runs`**: `agent_id`, `task`, `status`, `cost_usd`, `input/output_tokens`

### Convenciones schema

- UUID PKs para entidades de negocio (users, subscriptions, payments)
- BIGSERIAL para logs y evidencia (kyc_*, marketing_agent_*)
- `CASCADE` on delete cuando la entidad hija no tiene sentido sin la padre
- `SET NULL` para referencias opcionales (equipment → subscription)
- Timestamps siempre `TIMESTAMPTZ` (no `TIMESTAMP`)
- Retention fields (`retention_until`) en datos sensibles (KYC, GDPR)

---

## Variables de entorno (41 totales)

Ver `.env.example` para la lista completa. Agrupadas:

- **DB:** `DATABASE_URL`
- **Auth:** `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
- **Storage:** `BLOB_READ_WRITE_TOKEN`
- **AI:** `ANTHROPIC_API_KEY`
- **AWS:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- **Email:** `RESEND_API_KEY`
- **KYC thresholds** (todos con defaults): `KYC_NAME_MATCH_MIN/REVIEW`, `KYC_FACE_MATCH_MIN`, `KYC_LIVENESS_YAW_MIN`, `NEXT_PUBLIC_KYC_BLUR_THRESHOLD`
- **Marketing:** `META_ADS_*` (5 vars), `GOOGLE_ADS_*` (5 vars), `GOOGLE_SEARCH_CONSOLE_CREDENTIALS`, `GSC_SITE_URL`, `GA4_PROPERTY_ID`
- **Dropchat:** `DROPCHAT_API_KEY`, `DROPCHAT_API_URL`
- **Vault:** `VAULT_SECRET`
- **App:** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GTM_ID`, `ADMIN_EMAILS`, `AGENTS_ROOT`
- **Autopilot:** `DAILY_AUTOPILOT_COST_CAP_USD`

---

## Seguridad — convenciones establecidas

✅ **Lo que está bien:**

- Todos los endpoints `/api/admin/*` usan `await requireAdmin()`
- Queries SQL usan **parameterized statements** (`$1, $2, ...`), sin concatenación
- Sin secrets hardcodeados en el código
- `dangerouslySetInnerHTML` solo para JSON-LD estructurado (safe via `JSON.stringify`)
- API keys B2B se almacenan como **SHA-256 hash**, nunca el plaintext
- Vault usa AES-256-GCM con IV per entry
- JWT firmado HS256 con secret de 32+ bytes
- Cookies `httpOnly` + `secure` en prod

⚠️ **Áreas a vigilar (ver `TECH-DEBT.md`):**

- Emails fallan silenciosamente (`.catch(() => {})` en ~23 lugares)
- Algunas queries de subscriptions aún tienen `status IN ('active', ...)` legacy
- Rate limiting de API keys se **registra** pero no se **enforza**

---

## Deploy

1. Push a `main` en GitHub → Vercel auto-deploy (~60s build)
2. Preview deploys por PR (Vercel)
3. Env vars: Settings → Environment Variables en Vercel
4. Monitoring: `/api/audit/google-apis` como health endpoint para Google integrations

---

## Siguientes pasos al leer esto

1. Leer `docs/database-schema.md` para detalles de columnas
2. Leer `docs/TECH-DEBT.md` para issues conocidos y prioridades
3. Correr local: `npm install && npm run dev` (requiere `.env.local` con vars críticas)
4. Ver el admin dashboard en `http://localhost:3000/admin` (loguearse con `edsoncame@fluxperu.com`)
