/**
 * Contexto de infraestructura compartido por TODOS los agentes de FLUX.
 *
 * Se inyecta en el system prompt del runner (flux-agents.ts) y en el
 * blocker chat para que cualquier agente sepa dónde están las cosas,
 * qué tecnologías usamos, y cómo guiar al user si necesita hacer algo
 * en Vercel, Railway, GitHub, Meta, Google, etc.
 */

export const FLUX_INFRA_CONTEXT = `
# INFRAESTRUCTURA DE FLUX — lo que todo agente debe saber

## Stack tecnológico
- **Frontend + Backend**: Next.js 16 (App Router, React 19, TypeScript) desplegado en **Vercel**
- **Base de datos**: PostgreSQL en **Railway** (host: mainline.proxy.rlwy.net)
- **Dominio**: fluxperu.com (DNS en Vercel)
- **Repositorio**: GitHub → github.com/Edsoncame/drip (branch main, auto-deploy a Vercel)
- **Storage**: Vercel Blob (imágenes de productos, adjuntos)
- **Email**: Resend (dominio hola@fluxperu.com)
- **Pagos**: Stripe (tarjetas PE + Yape), Stripe en proceso (Flux Peru LLC vía Atlas)
- **AI**: Claude Sonnet 4.6 vía @ai-sdk/anthropic (BYOK direct provider)

## Dónde se configuran las variables de entorno
**TODAS las env vars van en Vercel** (NO en Railway, NO en .env.local de producción):
1. Ir a https://vercel.com → proyecto **drip** (o "goteo" si aparece así)
2. Settings → **Environment Variables** (sidebar izquierdo → "Variables ambientales")
3. Agregar la variable con Name + Value → Environments: "All Environments" → Save
4. **IMPORTANTE**: después de agregar una variable hay que hacer **Redeploy** del último deployment para que tome efecto (Deployments → último → ⋯ → Redeploy)

## Plataformas y sus URLs de admin

| Servicio | URL de admin | Para qué |
|---|---|---|
| **Vercel** | https://vercel.com/edsoncames-projects/drip | Deploy, env vars, crons, logs, dominios |
| **Railway** | https://railway.app (proyecto drip) | PostgreSQL, connection string |
| **GitHub** | https://github.com/Edsoncame/drip | Código fuente, commits, PRs |
| **Google Analytics** | https://analytics.google.com (propiedad Flux Perú) | Tráfico, eventos, tiempo real |
| **Google Search Console** | https://search.google.com/search-console | Indexación, keywords, posiciones |
| **Meta Business** | https://business.facebook.com | Ads, Pixel, páginas FB/IG |
| **Anthropic** | https://console.anthropic.com | API keys de Claude |
| **Resend** | https://resend.com/domains | Email transaccional |
| **Stripe** | https://dashboard.stripe.com | Pagos USD, Checkout Sessions, webhooks |
| **Stripe Atlas** | https://dashboard.stripe.com → Atlas | LLC Flux Peru Delaware |

## Variables de entorno actuales (env vars en Vercel)

### Configuradas ✅
- \`ANTHROPIC_API_KEY\` — API key de Claude para que los agentes funcionen
- \`DATABASE_URL\` — conexión PostgreSQL en Railway
- \`CULQI_SECRET_KEY\` / \`NEXT_PUBLIC_CULQI_PUBLIC_KEY\` — pagos Stripe
- \`RESEND_API_KEY\` — emails transaccionales
- \`BLOB_READ_WRITE_TOKEN\` — Vercel Blob storage
- \`JWT_SECRET\` — autenticación admin
- \`GOOGLE_CLIENT_ID\` / \`GOOGLE_CLIENT_SECRET\` — Google OAuth
- \`NEXT_PUBLIC_GTM_ID\` — Google Tag Manager
- \`NEXT_PUBLIC_GA4_ID\` = G-LVY85E8HGQ — Google Analytics 4
- \`VAULT_SECRET\` — encriptación de datos sensibles
- \`CRON_SECRET\` — autenticación de Vercel crons
- \`ADMIN_EMAILS\` — lista de emails admin

### Pendientes de configurar ⚠️
- \`GITHUB_TOKEN\` — para que el programador edite código vía API
- \`META_ADS_ACCESS_TOKEN\` — para SEM (Meta Ads API)
- \`GOOGLE_ADS_DEVELOPER_TOKEN\` — para SEM (Google Ads API)
- \`GA4_API_SECRET\` — para data-analyst (Measurement Protocol server-side)
- \`GOOGLE_SEARCH_CONSOLE_CREDENTIALS\` — para SEO (Search Console API)
- \`META_GRAPH_ACCESS_TOKEN\` — para community manager (publicar IG/FB)

## Info de contacto de FLUX
- **WhatsApp**: +51 900 164 769
- **Email**: hola@fluxperu.com
- **Web**: https://fluxperu.com
- **RUC**: 20605702512 (Tika Services S.A.C.)
- **LLC USA**: Flux Peru, LLC (Delaware, en constitución vía Stripe Atlas)

## Cómo guiar al user cuando necesita configurar algo
Cuando Edson te pregunta cómo hacer algo o dónde configurar:
1. **Sé específico** — no digas "andá a settings", decí "Vercel → drip → Settings → Environment Variables"
2. **Incluí el link** directo si lo tenés
3. **Mencioná el Redeploy** — siempre recordale que después de cambiar una env var hay que redeployar
4. **Si es de la DB** → Railway (pero rara vez necesita tocar Railway directamente)
5. **Si es de código** → GitHub o el programador-fullstack lo puede hacer
6. **Si es de marketing/ads** → Meta Business Manager o Google Ads
`;
