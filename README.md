# FLUX

> **Plataforma de alquiler mensual de MacBooks para empresas y profesionales en Lima, Perú.**
> Operada por **Tika Services S.A.C.** (RUC 20605702512).

URL en producción: <https://www.fluxperu.com>

---

## 1. ¿De qué se trata el producto?

FLUX permite a empresas y profesionales **alquilar una MacBook Air o MacBook Pro pagando una cuota mensual fija**, sin tener que comprar el equipo. Los planes van de 8, 16 o 24 meses. Al finalizar el contrato el cliente puede:

- **Devolver** el equipo
- **Renovar** el alquiler
- **Comprar** el equipo por su valor residual (ver fórmula en `lib/pricing-formula.ts`)

El cobro mensual recurrente se hace con **Culqi** (tarjeta de crédito/débito) o por transferencia bancaria con un comprobante que el cliente sube y un administrador valida.

## 2. Stack técnico

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| **Framework** | Next.js 16 (App Router, React Server Components) | Server-side rendering + buen SEO |
| **Lenguaje** | TypeScript | Tipado estricto en todo el repositorio |
| **Estilos** | Tailwind CSS v4 | Utility-first, sin CSS personalizado |
| **Base de datos** | PostgreSQL (Railway) | Hosted, conexión vía `pg` con SSL |
| **Storage de archivos** | Vercel Blob | Imágenes de productos, facturas, comprobantes |
| **Autenticación** | JWT firmado con `jose` (cookies httpOnly) | Sin librerías externas, simple |
| **Pagos** | Culqi (Perú) | Procesador local que acepta tarjetas peruanas |
| **Email transaccional** | Resend | Comprobantes, recordatorios, facturas |
| **Hosting** | Vercel | Deploy continuo desde GitHub `main` |
| **Edge runtime** | `proxy.ts` (antes `middleware.ts`) | Protege rutas `/admin` y `/cuenta` |

> Aunque el equipo trabaja en **HTML/JS/CSS/Java** habitualmente, el código en este repositorio se mantiene **explícito y comentado** para que cualquier desarrollador pueda entenderlo.

## 3. Estructura del repositorio

```
drip/
├── app/                          ← App Router (Next.js)
│   ├── (main)/                   ← Páginas públicas con layout principal
│   │   ├── page.tsx              ← Home
│   │   ├── laptops/              ← Catálogo y detalle de productos
│   │   ├── empresas/             ← Landing B2B
│   │   ├── cuenta/               ← Panel del cliente
│   │   ├── terminos/             ← Legal
│   │   ├── privacidad/
│   │   ├── cancelaciones/
│   │   └── libro-de-reclamaciones/  ← Formulario INDECOPI
│   ├── admin/                    ← Panel de administración
│   │   ├── page.tsx              ← Dashboard de rentas
│   │   ├── clientes/             ← Directorio de clientes
│   │   ├── pagos/                ← Validación de pagos + facturación
│   │   ├── inventario/           ← Equipos físicos (MacBooks)
│   │   ├── finanzas/             ← Pagos a bancos (vista contador)
│   │   ├── productos/            ← CRUD del catálogo público
│   │   ├── precios/              ← Calculadora + tabla de precios
│   │   ├── usuarios/             ← Gestión de admins
│   │   └── vault/                ← Credenciales internas cifradas
│   ├── api/                      ← Route handlers (REST)
│   │   ├── auth/                 ← Login, logout, registro, OAuth
│   │   ├── checkout/             ← Procesa pagos con Culqi
│   │   ├── payments/             ← Gestión de cuotas mensuales
│   │   ├── admin/                ← Endpoints administrativos
│   │   └── webhooks/             ← Callbacks de Culqi
│   ├── checkout/                 ← Flujo de compra
│   ├── auth/                     ← Login / registro / recuperar
│   ├── layout.tsx                ← Layout raíz + metadata global
│   ├── manifest.ts               ← PWA manifest
│   ├── sitemap.ts                ← sitemap.xml automático
│   ├── robots.ts                 ← robots.txt automático
│   ├── icon.png                  ← Favicon (Next.js auto-detect)
│   ├── apple-icon.png            ← Apple touch icon
│   ├── opengraph-image.png       ← OG image (Facebook, LinkedIn, WhatsApp)
│   └── twitter-image.png         ← Twitter Card image
│
├── components/                   ← Componentes reutilizables (server + client)
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── Hero.tsx
│   ├── ProductCard.tsx
│   ├── ProductDetail.tsx
│   ├── JsonLd.tsx                ← Schema.org structured data
│   ├── GoogleAuthButton.tsx      ← Botón OAuth de Google
│   └── ...
│
├── lib/                          ← Lógica de negocio + helpers
│   ├── auth.ts                   ← JWT, sesiones, helpers de admin
│   ├── db.ts                     ← Cliente Postgres (singleton)
│   ├── products.ts               ← Catálogo (lectura desde DB)
│   ├── use-products.ts           ← Hook React para productos en clientes
│   ├── pricing-formula.ts        ← Fórmula de precios (potencia)
│   ├── email.ts                  ← Wrapper de Resend
│   ├── analytics.ts              ← Eventos GTM
│   ├── vault.ts                  ← Cifrado AES para credenciales
│   ├── appleImages.ts            ← Scrapping de imágenes Apple CDN
│   └── contract-pdf.ts           ← Generación de contratos PDF
│
├── public/                       ← Assets estáticos
│   ├── images/
│   │   ├── logoflux.svg          ← Logo principal
│   │   ├── logoflux-white.svg    ← Logo blanco (footer dark)
│   │   └── isotipoflux.svg       ← Solo el isotipo F
│   ├── icon-192.png              ← PWA icon
│   └── icon-512.png              ← PWA icon
│
├── scripts/                      ← Scripts utilitarios (no entran al bundle)
│   ├── generate-admin-tutorial.mjs       ← Genera PDF tutorial admin
│   └── migrate-receipts-to-blob.mjs      ← Migración base64 → Vercel Blob
│
├── proxy.ts                      ← Edge middleware (Next.js 16 lo llama proxy.ts)
├── tailwind.config.ts            ← Config de Tailwind
├── next.config.ts                ← Config de Next.js
└── package.json
```

## 4. Variables de entorno

Listado de variables requeridas. Todas se gestionan en **Vercel → Settings → Environment Variables**.

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `DATABASE_URL` | Conexión Postgres (Railway) | `postgresql://user:pass@host:port/db` |
| `DATABASE_SSL` | Si el host requiere SSL | `true` |
| `JWT_SECRET` | Secreto para firmar las cookies JWT (mínimo 32 chars) | `random-base64-string` |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob (auto-inyectado al conectar el store) | `vercel_blob_rw_xxx` |
| `RESEND_API_KEY` | API key de Resend para email transaccional | `re_xxx` |
| `CULQI_SECRET_KEY` | Llave secreta de Culqi (para cobrar) | `sk_live_xxx` o `sk_test_xxx` |
| `NEXT_PUBLIC_CULQI_PUBLIC_KEY` | Llave pública (frontend) | `pk_live_xxx` o `pk_test_xxx` |
| `ADMIN_EMAILS` | (Legacy) Lista separada por comas — bootstrap del primer super admin | `edsoncame@fluxperu.com` |
| `NEXT_PUBLIC_GTM_ID` | ID de Google Tag Manager | `GTM-XXXXXX` |
| `NEXT_PUBLIC_APP_URL` | URL pública del sitio | `https://www.fluxperu.com` |
| `VAULT_SECRET` | Llave AES para cifrar credenciales del vault | `random-base64-32-bytes` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID (opcional) | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret (opcional) | `GOCSPX-xxx` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Mismo client ID expuesto al cliente | `xxx.apps.googleusercontent.com` |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` | Kill switch para el botón "Continuar con Google" | `true` o vacío |

> **Importante:** después de crear o cambiar un Blob Store en Vercel, hay que **redeployar** el proyecto para que tome el nuevo `BLOB_READ_WRITE_TOKEN`.

## 5. Roles y autenticación

El sistema tiene 3 niveles de acceso:

1. **Anónimo** — puede ver el catálogo público y el flujo de checkout
2. **Cliente registrado** (`is_admin = false`) — puede ver sus rentas, pagos y comprobantes
3. **Administrador** (`is_admin = true`) — accede al panel `/admin`
4. **Super administrador** (`is_super_admin = true`) — además puede crear/eliminar otros admins desde `/admin/usuarios`

El check de admin se hace de dos maneras complementarias:

- **Edge runtime** (`proxy.ts`): lee el JWT y valida el claim `isAdmin` para proteger rutas (`/admin/*`). No puede consultar la base de datos directamente desde Edge.
- **Server runtime** (`lib/auth.ts → requireAdmin`): consulta la tabla `users` por `userId` (NO por email — el email puede cambiar). Devuelve la sesión enriquecida con `isAdmin` y `isSuperAdmin`.

El claim `isAdmin` se incrusta en el JWT en el momento del login (`/api/auth/login`). Si los roles cambian después, el usuario debe **cerrar sesión y volver a entrar** para que su token tenga los claims actualizados.

## 6. Modelo de datos (tablas principales)

| Tabla | Para qué sirve |
| --- | --- |
| `users` | Clientes y administradores. Columnas clave: `email`, `password_hash`, `is_admin`, `is_super_admin`, `phone`, `company`, `ruc`, `dni_number` |
| `subscriptions` | Suscripciones activas (plan + cliente + equipo). Estados: `active`, `paused`, `cancelled`, `delivered`, `completed` |
| `payments` | Cuotas mensuales generadas para cada suscripción. Estados: `upcoming`, `pending`, `reviewing`, `validated`, `overdue` |
| `payment_invoices` | Facturas SUNAT subidas para cada pago (1 pago puede tener N facturas) |
| `equipment` | Inventario físico de MacBooks, con código interno, número de serie, costo de compra y financiamiento |
| `products` | Catálogo público que aparece en `/laptops`. Cada uno tiene `pricing` (jsonb) y `specs` (jsonb) |
| `pricing` | Tabla de precios por modelo y plan (8m, 16m, 24m) |
| `vault_entries` | Credenciales internas cifradas con AES |
| `libro_reclamaciones` | Formularios INDECOPI (Ley 29571) |
| `password_reset_tokens` | Tokens temporales para recuperar contraseña |
| `referrals` | Programa de referidos (en construcción) |

## 7. Instalación y desarrollo local

```bash
# 1. Clonar repo
git clone https://github.com/Edsoncame/drip.git
cd drip

# 2. Instalar dependencias
npm install

# 3. Bajar variables de entorno desde Vercel
vercel link            # selecciona el proyecto "drip"
vercel env pull .env.local --environment=production

# 4. Iniciar dev server
npm run dev            # arranca en http://localhost:3000
```

Comandos útiles:

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción (corre type-check)
npm run start          # sirve el build de producción
npm run lint           # ESLint
```

## 8. Deploy

Cada `git push` a la rama `main` dispara automáticamente:

1. Build en Vercel
2. Type-check + ESLint
3. Deploy a `fluxperu.com`

Para revertir un deploy: **Vercel → Deployments → la deployment estable → Promote to Production**.

## 9. Servicios externos

| Servicio | Para qué | Dónde se administra |
| --- | --- | --- |
| **Vercel** | Hosting + Blob storage + Env vars | `vercel.com/dashboard` |
| **Railway** | PostgreSQL en producción | `railway.app` |
| **Resend** | Email transaccional | `resend.com/dashboard` |
| **Culqi** | Procesamiento de tarjetas | `panel.culqi.com` |
| **Google Tag Manager** | Analytics + tracking | `tagmanager.google.com` |
| **SUNAT SOL** | Facturación electrónica | `e-menu.sunat.gob.pe` |

## 10. Convenciones de código

- **TypeScript estricto.** No `any` salvo casos justificados.
- **Server Components por defecto.** `"use client"` solo cuando se necesita estado, efectos o handlers de eventos del navegador.
- **Imports absolutos** con alias `@/` (ej. `import { query } from "@/lib/db"`).
- **No emojis en código,** salvo en strings de UI dirigidos a usuarios finales.
- **Comentarios en español** cuando expliquen reglas de negocio (ej. cómo se calcula el residual). En inglés cuando sean técnicos genéricos (ej. "guard against race condition").
- **Commits descriptivos** en formato `area: cambio` (ej. `admin pagos: fix invoice upload`). Cada commit debe ser revertible de forma independiente.
- **Sin secretos en el código.** Todo va en variables de entorno.

## 11. Reglas de negocio importantes

- **Primer pago.** La primera cuota de una suscripción se cobra al iniciar el contrato (mes 1 = mismo día de la firma).
- **Cuotas a bancos por compra de equipos.** La primera cuota del banco se paga **el mes siguiente** a la fecha de compra (no el mismo mes). Esto se respeta en `/admin/finanzas`.
- **Calculadora de residual.** `residual = max(10, 100 − 2.8125 × meses_usado)`. Calibrada con anclas 8m=77.5%, 16m=55%, 24m=32.5%.
- **Calculadora de precios mensuales.** Fórmula de potencia `precio = a × costo^b` por plan, calibrada en `lib/pricing-formula.ts`.
- **Múltiples facturas por pago.** Un mismo pago puede tener N facturas SUNAT siempre que la suma sea igual al monto del pago.
- **Cancelación de suscripción.** Solo el cliente puede cancelar dentro del plazo de desistimiento (7 días). Después aplica penalidad del 50% sobre las cuotas restantes.

## 12. Contacto del equipo

- **Edson Campaña** — Super admin / desarrollo / producto
  edsoncame@fluxperu.com
- **Luis Roque Ricse** — Contador
  eroquericse@fluxperu.com

---

© 2026 Tika Services S.A.C. — Lima, Perú
