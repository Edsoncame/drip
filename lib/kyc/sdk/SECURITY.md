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
| `session_token` JWT (cliente) | atacante sube imágenes / finaliza en nombre del user | BAJO (TTL 15min) | media |

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

## Disclosure de vulnerabilidades

Si descubrís un vector:

1. NO abras issue público en el repo `Edsoncame/drip`.
2. Mandá mail a `security@flux.pe` (o DM por Signal al fundador).
3. SLA interno: ack <24h, patch <7 días si CVSS ≥7.

## Checklist pre-producción (por cada tenant nuevo)

- [ ] Seeder corrido, api_key entregado por canal seguro
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
