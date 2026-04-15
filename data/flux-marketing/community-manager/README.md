# Community-Manager · FLUX

Agente de redes sociales orgánicas. Arma calendario editorial y drafts para Instagram, LinkedIn (empresa), TikTok y Facebook.

> **No es long-form.** Posts cortos, reels, carruseles, stories. El blog largo lo hace `content-creator`.

## Qué hace

- **Calendario editorial mensual** — 4 posts/semana × 4 plataformas, balanceado entre educativo / social proof / producto / cultura
- **Drafts de posts cortos** — captions Instagram, posts LinkedIn empresa, TikTok hooks
- **Reel scripts** — guiones de 15-30 segundos, hook primeros 3 segundos
- **Carrusel designs** — estructura de slides, texto por slide (pide diseño a `disenador-creativo`)
- **Respuestas a comentarios/DMs** — drafts para que Edson apruebe
- **Trend watching** — audios, formatos, temas que están funcionando

## Qué NO hace

- NO publica nada (Edson sube manualmente)
- NO responde en vivo — solo prepara drafts
- NO redacta blogs ni newsletters (eso es `content-creator`)
- NO compra ads (eso es `sem-manager`)

## Formato por plataforma

| Plataforma | Formato | Frecuencia | Tono |
|---|---|---|---|
| Instagram | Reels + carruseles + stories | 4-5/sem | Visual, producto en acción |
| LinkedIn empresa | Posts texto + carruseles | 3/sem | Profesional, casos B2B |
| TikTok | Reels nativos | 2-3/sem | Casual, educativo rápido |
| Facebook | Reposts IG + ofertas | 2/sem | Promocional |

## Flujo

```
Edson: "arma calendario de mayo para Instagram y LinkedIn"
           │
           ▼
     community-manager
           │
           ├─ calendar/2026-05.md        ← calendario mensual
           ├─ drafts/2026-05-*.md        ← posts listos
           └─ assets/2026-05/            ← notas para disenador-creativo
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/community-manager
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `calendario: [mes]` | Calendario editorial del mes |
| `post: [plataforma] [tema]` | Draft de un post específico |
| `reel: [tema]` | Guion de reel 15-30s |
| `carrusel: [tema]` | Estructura de carrusel IG/LinkedIn |
| `responde: [comentario]` | Draft de respuesta |
| `tendencias` | Qué está funcionando esta semana |
| `repurpose: [blog]` | Adapta un blog a formato corto |

## Estructura

```
community-manager/
├── CLAUDE.md
├── agents.md
├── memory.md              ← posts que funcionaron, engagement histórico
├── README.md
├── .claude/settings.json
├── calendar/              ← YYYY-MM.md por mes
├── drafts/                ← drafts listos
├── assets/                ← specs para disenador-creativo
└── responses/             ← drafts de respuestas
```

## Upstream / Downstream

- **Upstream:** content-creator (repurpose de blogs), estratega-oferta (ángulos del mes)
- **Downstream:** disenador-creativo (creativos), Edson (publica)
