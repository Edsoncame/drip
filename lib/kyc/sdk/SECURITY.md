# FluxKYC SDK — Security runbook

Operativa de seguridad del SDK multi-tenant. Leer antes de pasar a
producción con un cliente nuevo.

## Modelo de amenaza

| Asset | Si se pierde/leakea | Impacto | Probabilidad |
|---|---|---|---|
| `KYC_SDK_SESSION_SECRET` | atacante mintea JWT para cualquier session_id existente | ALTO | baja (solo en Vercel env) |
| `kyc_tenants.api_key` (texto plano del tenant) | atacante crea sesiones ilimitadas a nombre del tenant | MEDIO | media |
| `kyc_tenants.api_key_hash` (DB) | atacante NO puede reconstruir (bcrypt cost 12) | NINGUNO | — |
| `kyc_sdk_sessions.webhook_secret` (DB) | atacante falsifica webhooks creíbles | BAJO | baja |
| `kyc_tenants.publishable_key` | atacante intenta crear sesiones desde su propio sitio — bloqueado por `allowed_origins` | BAJO si la whitelist es correcta / ALTO si la whitelist tiene `*` o entradas laxas | media (es público por diseño) |
| `session_token` JWT (cliente) | atacante sube imágenes / finaliza en nombre del user | BAJO (TTL 15min) | media |

### Por qué `publishable_key` no es secreto

Pattern Stripe (pk_live_…). Va embebida en HTML público:

```html
<script src="https://www.fluxperu.com/kyc-embed.js"
        data-pk="pk_securex_a1b2…"
        data-correlation-id="user-123"></script>
```

La defensa real es la verificación de `Origin` HTTP header en
`POST /api/kyc/embed/session` contra `kyc_tenants.allowed_origins[]`.
Sin un origen permitido, la pk sola no permite crear sesiones.

**Reglas de matching de origin** (ver `lib/kyc/sdk/publishable-key.ts`):

| Regla | Comportamiento | Ejemplo |
|---|---|---|
| Match exacto de scheme + host + port | obligatorio | `https://securex.pe` ≠ `http://securex.pe` |
| Subdominios | NO heredan | `https://securex.pe` no permite `https://app.securex.pe` |
| Wildcard `*` | NO soportado | el tenant debe enumerar cada origen |
| Trailing slash | normalizado | `https://securex.pe/` ≡ `https://securex.pe` |
| Whitespace | trimeado | `  https://securex.pe  ` ≡ `https://securex.pe` |
| Case del scheme/host | case-sensitive (Gap #10 conocido) | browsers reales mandan lowercase, no es regresión hoy |
| Origin literal `"null"` (sandbox iframes) | rechazado | data:/file: schemes y srcdoc iframes no pueden usar el SDK |

El tenant debe agregar manualmente cada variante que quiera permitir.
Si necesita `www` y apex, ambos. Si necesita staging y prod, ambos.

## Webhook SLA con `manual_review_policy`

A partir del feature `manual_review_queue` (commit `f754588`) el tenant
puede configurar:

```sql
manual_review_policy IN ('never', 'low_confidence', 'all_borderline')
```

Cuando la policy NO es `'never'`, el webhook NO se dispara apenas el
pipeline emite verdict — espera a que un reviewer humano apruebe o
rechace en `/tenant/review`.

**Contrato con el tenant:**

- `kyc_sdk_sessions.status` puede quedar en `'review'` por horas o días.
- `kyc_sdk_sessions.webhook_fired_at` es `NULL` durante todo ese tiempo.
- El webhook llega solo cuando un reviewer:
  - **Aprueba** → status `verified`, webhook con verdict positivo.
  - **Rechaza** → status `rejected`, webhook con verdict negativo y `reviewed_notes`.
- El tenant NO debe construir UX que asuma latencia <1min cuando elige
  `low_confidence` o `all_borderline`. Debe:
  - mostrar al usuario final "verificación en curso, te avisamos por
    email cuando esté lista", **o**
  - pollear `GET /api/kyc/sdk/sessions/:id` cada N minutos como
    fallback (mismo endpoint que sirve para reconciliación).

**Recomendación:** para flows con UX bloqueante (ej: onboarding de
fintech donde el usuario no puede operar hasta verificarse), elegir
`manual_review_policy='never'` y aceptar el verdict automático del
arbiter Claude Opus. La review queue es para tenants con tolerancia a
latencia que prefieren bajar el false-accept rate.

**SLA operativo de la review queue:** Edson revisa cola al menos 1×/día.
Para SLA <2h hábiles, el tenant debe contratar el plan con reviewer
dedicado (TBD pricing).

## Rotación de `KYC_SDK_SESSION_SECRET`

Cuándo rotar: leak sospechado, ex-empleado con acceso a Vercel, o anual
como higiene.

```bash
# 1. Generar nuevo secret
NEW=$(openssl rand -hex 32)

# 2. Setear en Vercel (production + preview)
echo "$NEW" | vercel env add KYC_SDK_SESSION_SECRET production --sensitive
echo "$NEW" | vercel env add KYC_SDK_SESSION_SECRET preview --sensitive

# 3. Redeploy para que entre en vigor
vercel --prod

# 4. Efecto: TODOS los session_token activos quedan inválidos al instante.
#    Cualquier SDK native client en medio de un flow tirará
#    FluxKYCError.Unauthorized → tu app le pide al backend emitir uno nuevo.
```

No hace falta avisar a los tenants — el SDK maneja el error y ellos
pueden reintentar. El downtime efectivo es cero.

## Rotación del api_key de un tenant

Cuándo rotar: el tenant reporta leak, o el empleado responsable rota.

```bash
DATABASE_URL=$(vercel env pull ...) node scripts/seed-kyc-tenant.mjs \
  --id securex --name "Securex" --webhook "https://..."
# El script hace UPSERT: el row existente se mantiene (misma id) pero
# api_key_hash se reemplaza. El api_key viejo deja de funcionar al instante.
# Guardá el nuevo api_key que imprime y compartilo con el tenant por
# canal seguro (1Password, ProtonMail, nunca Slack/email plano).
```

## Rotación del `publishable_key` de un tenant

Cuándo rotar: el tenant cambia de dominio, sospecha que alguien clonó
su sitio para hacer phishing usando su pk, o quiere invalidar widgets
viejos en cache de CDN.

```sql
-- Manualmente vía SQL (no hay endpoint admin todavía)
UPDATE kyc_tenants
SET publishable_key = 'pk_' || id || '_' || encode(gen_random_bytes(24), 'hex')
WHERE id = 'securex';
```

**Efecto:**

- Sessions **futuras** desde el HTML viejo del tenant fallan con
  `pk_invalid` apenas hagan POST a `/api/kyc/embed/session`.
- Sessions **activas** (con `session_token` JWT ya emitido) NO se
  invalidan — el JWT es self-contained y vive su TTL de 15min. Esto
  es un trade-off consciente: la rotación inmediata requeriría una
  blacklist en DB que consultaríamos en cada request.

**Mitigación natural del riesgo:** TTL JWT 15min. Si el atacante ya
tiene un session_token, puede subir hasta 20 imágenes en los próximos
15 minutos como mucho. Para revocar un session_token específico antes
de TTL, hoy la única vía es rotar `KYC_SDK_SESSION_SECRET` (impacta
todos los tenants — no recomendado para single-tenant compromise).

**Roadmap (Gap #5):** endpoint admin `POST /api/admin/kyc/tenants/:id/rotate-pk`
que devuelva la nueva pk + invalide active session_tokens vía blacklist.
Pendiente, sin ETA — hoy mitigado por TTL corto.

## Disclosure de vulnerabilidades

Si descubrís un vector:

1. NO abras issue público en el repo `Edsoncame/drip`.
2. Mandá mail a `security@flux.pe` (o DM por Signal al fundador).
3. SLA interno: ack <24h, patch <7 días si CVSS ≥7.

## Checklist pre-producción (por cada tenant nuevo)

- [ ] Seeder corrido, api_key entregado por canal seguro
- [ ] `allowed_origins` configurado con TODOS los dominios del tenant
      (apex + www + staging si aplica) — exact match, sin wildcards
- [ ] Tenant probó el embed JS desde cada origen y confirma que funciona
- [ ] Tenant intentó hitear desde un origen NO whitelisteado y confirma
      que recibe `403 origin_not_allowed`
- [ ] Si `manual_review_policy != 'never'`, el tenant aceptó por escrito
      el SLA de horas/días y configuró su UX para no asumir latencia <1min
- [ ] Tenant confirmó que validará HMAC del webhook con
      `timingSafeEqual` — ver curl example en README.md
- [ ] Tenant confirmó que rechaza webhooks con `t` de hace >300s
      (anti-replay)
- [ ] Smoke test end-to-end: session create → upload × 5 → finalize →
      webhook recibido y HMAC válido
- [ ] Revisar cap de uploads por sesión (MAX_UPLOADS_PER_SESSION=20) y
      decidir si el tenant necesita ajustar

## Gaps conocidos y roadmap

- **iBeta Level 2 certification** del liveness: el algoritmo de liveness
  casero (ML Kit / Vision + 3-frame yaw) NO está certificado. Para
  ofrecer SLA a fintechs reguladas hay que certificar en laboratorio
  iBeta. Presupuesto estimado: ~USD 20k-40k + ~2 meses.
- **DNS rebinding TOCTOU**: mitigamos con pre-resolución DNS antes del
  fetch. Ventana TOCTOU entre lookup y connect es ~10ms. Cierre total
  requiere undici Agent con connect hook — deferred a v2.
- **bcrypt cost 12**: ~250ms por `authenticateTenant`. Si pasamos de
  ~1k tenants conviene cachear el hash en memoria por tenant_id
  (cache LRU 1000 entries, TTL 5min).
- **Rate limit global por IP**: hoy solo hay rate limit por-sesión.
  Un atacante con muchos api_keys podría generar sesiones ilimitadas.
  Si llega un caso así, agregar rate limit con Upstash Redis.
- **Audit log firmado**: `kyc_attempts` guarda outcomes pero no tiene
  chain-of-custody criptográfica. Para clientes AML/regulados se
  necesita logs append-only firmados (Hash-chain + HMAC).
- **Gap #5 — revoke flow de publishable_key**: hoy solo vía SQL manual,
  sin invalidación de session_tokens activos. Mitigado por TTL JWT 15min.
- **Gap #6 — SLA webhook con manual review**: documentado arriba pero
  el README.md del tenant no lo enfatiza lo suficiente. Mejorar copy.
- **Gap #10 — origin matching case-sensitive**: `isOriginAllowed` no
  hace `.toLowerCase()`. RFC 6454 dice que origin es case-insensitive
  en scheme/host, pero browsers reales mandan lowercase, así que no es
  regresión hoy. Test escrito como tripwire (`sdk-publishable-key.test.ts`).
- **Gap #2/#3 — crons de cleanup y refresh sanctions**: bloqueados por
  slots Hobby llenos (2/2). Workaround: piggyback en `expansion-refresh`.
