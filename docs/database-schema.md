# Flux — Database schema & API map

> Última auditoría: 2026-04-18

Postgres en Railway (`drip` database). 31 tablas. Este doc es la **fuente de verdad** para saber qué existe, cómo se relaciona, y cómo se va a exponer por API.

---

## 1. Dominios

La BD se organiza en 6 dominios funcionales. Cada dominio corresponde a un namespace de API (`/api/v1/<dominio>`).

| Dominio | Tablas | Propósito | API público futuro |
|---|---|---|---|
| **identity** | `users`, `password_reset_tokens`, `referrals` | Cuentas, auth, referidos | ✅ parcial (auth) |
| **commerce** | `subscriptions`, `payments`, `payment_invoices` | Ciclo de renta + cobros | ✅ (solo admin + owner) |
| **catalog** | `products`, `pricing` | Catálogo de laptops y precios por plan | ✅ público |
| **inventory** | `equipment` | Flota física (40+ campos financieros) | ❌ admin-only |
| **kyc** | `kyc_attempts`, `kyc_dni_scans`, `kyc_face_matches` | Pipeline KYC (OCR + face match + arbiter) | ❌ interno |
| **compliance** | `libro_reclamaciones` | Libro de reclamaciones (Indecopi) | ⚠️ formulario público → admin |
| **marketing** | 14 tablas `marketing_*` | Agentes IA + estrategias + ejecución | ❌ super-admin |
| **ops** | `vault_entries` | Bóveda de credenciales AES-256-GCM | ❌ super-admin |

---

## 2. Tablas — estado actual

### identity

| Tabla | Filas | Relaciones | Estado |
|---|---|---|---|
| `users` | 4 | → `referrals`, `subscriptions`, `payments`, `kyc_*` | ✅ OK. Columnas KYC incorporadas (`kyc_status`, `kyc_correlation_id`, `kyc_verified_at`). |
| `password_reset_tokens` | 0 | `user_id → users` CASCADE | ✅ OK |
| `referrals` | 0 | `referrer_id → users`, `referred_id → users` | ⚠️ Feature activa pero sin datos — la UI `/cuenta/referidos` lee de acá. |

### commerce

| Tabla | Filas | Relaciones | Estado |
|---|---|---|---|
| `subscriptions` | 13 | `user_id → users` CASCADE | ✅ OK. Defaults actualizados (`status='preparing'`, `payment_method='stripe'`). |
| `payments` | 8 | `subscription_id → subs`, `user_id → users` | ✅ OK. |
| `payment_invoices` | 3 | `payment_id → payments` CASCADE | ✅ OK |

### catalog

| Tabla | Filas | Relaciones | Estado |
|---|---|---|---|
| `products` | 4 | standalone | ✅ OK |
| `pricing` | 36 | `modelo/plan` matching products | ⚠️ Sin FK explícita a products — usa strings. |

### inventory

| Tabla | Filas | Relaciones | Estado |
|---|---|---|---|
| `equipment` | 12 | `cliente_actual` text (no FK) | ⚠️ `cliente_actual` debería ser `subscription_id UUID` para FK real. |

### kyc

| Tabla | Filas | Relaciones | Estado |
|---|---|---|---|
| `kyc_attempts` | 13 | `user_id → users` SET NULL | ✅ OK |
| `kyc_dni_scans` | 5 | `user_id → users` SET NULL | ✅ OK |
| `kyc_face_matches` | 4 | `dni_scan_id → scans`, `user_id → users` | ✅ OK |

### compliance

| Tabla | Filas | Relaciones | Estado |
|---|---|---|---|
| `libro_reclamaciones` | 0 | standalone | ✅ OK (vacío esperable) |

### marketing (agentes IA + estrategias)

Todas enganchan con `marketing_strategies` con `strategy_id` CASCADE o SET NULL.

| Tabla | Filas | Estado |
|---|---|---|
| `marketing_agent_runs` | 580 | ✅ OK — limpiado de 54 runs colgados el 2026-04-18 |
| `marketing_agent_files` | 534 | ✅ OK |
| `marketing_blocker_messages` | 238 | ✅ OK |
| `marketing_strategy_tasks` | 41 | ✅ OK |
| `marketing_strategy_budget` | 30 | ✅ OK |
| `marketing_strategy_reports` | 15 | ✅ OK |
| `marketing_sem_plans` | 13 | ✅ OK |
| `marketing_content_calendar` | 13 | ✅ OK |
| `marketing_agent_blockers` | 12 | ✅ OK (4 abiertos pidiendo envs de Meta) |
| `marketing_strategy_objectives` | 12 | ✅ OK |
| `marketing_strategy_kpi_snapshots` | 11 | ✅ OK |
| `marketing_strategy_attachments` | 8 | ✅ OK |
| `marketing_strategy_kpis` | 6 | ✅ OK |
| `marketing_strategies` | 3 | ✅ OK |
| `marketing_strategy_experiments` | 3 | ✅ OK |
| `marketing_media_matrix` | 0 | ⚠️ Tabla vacía — evaluar si se usa |
| `marketing_competitor_benchmarks` | 0 | ⚠️ Tabla vacía — evaluar si se usa |

### ops

| Tabla | Filas | Estado |
|---|---|---|
| `vault_entries` | 11 | ✅ OK (AES-256-GCM para credenciales) |

---

## 3. Issues pendientes (decisiones del dueño)

### 3.1 Denormalización `subscriptions` ↔ `users` (RIESGO MEDIO)

`subscriptions` tiene: `customer_name`, `customer_email`, `customer_phone`, `customer_company`, `customer_ruc`, `dni_number`.

Todo ya existe en `users`. La duplicación se justifica si:
- El cliente pagó como **guest** y la cuenta se creó después (hoy pasa: webhook auto-crea user).
- Los datos del cliente al momento del pago tienen que preservarse aunque `users.*` cambie.

**Propuesta:** mantener duplicación por razones contables (los datos de facturación deben ser inmutables post-pago), pero renombrar a `billing_*` para dejar claro el propósito:
```
customer_name → billing_name
customer_email → billing_email
...
```

### 3.2 `equipment.cliente_actual` sin FK (RIESGO BAJO)

Hoy es texto libre (ej: `"EDSON"`, `"VANESSA"`). Debería ser `subscription_id UUID NULL REFERENCES subscriptions(id)`.

**Acción:** migración con mapping manual (la flota es 12 equipos).

### 3.3 Columnas `mp_*` legacy (bajo impacto)

`subscriptions.mp_subscription_id` — nombre viene de MercadoPago (migrado a Culqi, ahora Stripe). El campo guarda IDs de cualquiera.

**Propuesta:** renombrar a `external_subscription_id` en una migración. Cambiar código que lo lee.

### 3.4 Tablas de marketing sin uso

- `marketing_media_matrix` (0 filas)
- `marketing_competitor_benchmarks` (0 filas)

**Acción:** chequear si el código las escribe alguna vez. Si no, `DROP TABLE`.

### 3.5 Libro de reclamaciones

`libro_reclamaciones` existe pero no hay formulario público que lo popule. Indecopi exige que cualquier consumidor pueda registrarse.

**Acción:** construir `/reclamaciones` (public form) → INSERT en esta tabla. Pendiente.

---

## 4. API map propuesto (`/api/v1/*`)

Futuro — no implementado todavía. Arquitectura: **REST stateless + API key para B2B, JWT para usuarios**.

### 4.1 Público (sin auth)

```
GET  /api/v1/catalog/products           → lista productos activos
GET  /api/v1/catalog/products/:slug     → detalle producto
GET  /api/v1/catalog/pricing            → tabla de precios por modelo/plan
POST /api/v1/compliance/complaints      → nuevo reclamo (rate-limited)
```

### 4.2 Usuario autenticado (JWT)

```
GET  /api/v1/users/me                   → perfil propio
PATCH /api/v1/users/me                  → actualizar perfil
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/register
POST /api/v1/auth/password/reset

GET  /api/v1/subscriptions              → mis subs
GET  /api/v1/subscriptions/:id          → detalle sub (solo propia)
POST /api/v1/subscriptions/:id/return   → solicitar devolución
POST /api/v1/subscriptions/:id/purchase → solicitar compra

GET  /api/v1/payments                   → mis cobros
POST /api/v1/payments/:id/receipt       → subir comprobante (offline)
GET  /api/v1/payments/:id/invoice       → factura

GET  /api/v1/referrals                  → mis referidos + código
```

### 4.3 Admin (JWT con `is_admin`)

```
GET  /api/v1/admin/subscriptions        → todas las rentas (paginado, filtros)
PATCH /api/v1/admin/subscriptions/:id   → cambiar status, tracking, note
GET  /api/v1/admin/payments             → pagos (pending/validated)
POST /api/v1/admin/payments/:id/validate
POST /api/v1/admin/payments/:id/invoice
GET  /api/v1/admin/users                → clientes (CRM)
PATCH /api/v1/admin/users/:id           → verificar ID, flags
GET  /api/v1/admin/equipment            → inventario
CRUD /api/v1/admin/equipment/*
CRUD /api/v1/admin/products/*
CRUD /api/v1/admin/pricing/*
GET  /api/v1/admin/kyc/:correlation_id  → evidencia KYC (scan, match, attempts)
```

### 4.4 Super-admin (`is_super_admin`)

```
CRUD /api/v1/super/vault                → credenciales
CRUD /api/v1/super/marketing/*          → estrategias, agentes, runs
```

### 4.5 Webhooks (sin auth, firma HMAC)

```
POST /api/webhooks/stripe
POST /api/webhooks/culqi (legacy)
```

### 4.6 Integraciones B2B (API key por cliente)

Futuro — para que clientes corporativos consulten estado de sus rentas programáticamente:
```
GET  /api/v1/b2b/subscriptions          → todas sus rentas
GET  /api/v1/b2b/invoices               → facturas
```

Requiere:
- Tabla nueva `api_keys (key_hash, user_id, scope[], rate_limit, created_at)`
- Middleware que valida la key + scope
- Rate limiter (ya tenemos Runtime Cache de Vercel para eso)

---

## 5. Reglas para contribuir

1. **Siempre** agregar índices a FKs (Postgres no los crea automáticamente).
2. **Siempre** `ON DELETE CASCADE` cuando el hijo no tiene sentido sin el padre.
3. `updated_at` con trigger automático (ya hay uno genérico: `touch_updated_at()`).
4. **Nombres de tablas en inglés** (excepto `libro_reclamaciones` por contexto legal peruano).
5. **Nombres de columnas en español** en tablas con dominio local peruano (`equipment.*`, `libro_reclamaciones.*`). Resto en inglés.
6. Nuevos enums de estado → documentar en este archivo.
7. Migraciones → script en `scripts/migrations/YYYY-MM-DD-descripcion.sql`.
