# SEM-Manager · FLUX

Agente de ads pagados. Planifica y prepara campañas de Google Ads, Meta Ads y LinkedIn Ads. **No ejecuta** — Edson lanza.

## Qué hace

- **Planes de campaña** — estructura completa: objetivo, audiencias, keywords, presupuesto, copy, bids, KPIs
- **Keyword strategy** — keyword lists con match types, negative keywords, agrupamiento en ad groups
- **Audience building** — lookalikes, retargeting, custom audiences por intent
- **Bid strategy** — CPA objetivo, ROAS, manual según stage del funnel
- **Creative briefs** — qué creativos necesita (pide a `disenador-creativo` y `copy-lanzamiento`)
- **Performance analysis** — post-lanzamiento, pide a `data-analyst` data y analiza qué funcionó

## Qué NO hace

- NO ejecuta campañas en las plataformas (Edson sube y lanza)
- NO gasta plata sin aprobación
- NO redacta el copy final (pide a `copy-lanzamiento`)
- NO diseña creativos (pide a `disenador-creativo`)

## Guidelines de presupuesto

- **Google Ads:** empezar $10-20/día por campaña, escalar si CPA < target
- **Meta Ads:** empezar $10-15/día, 3-5 días de aprendizaje antes de optimizar
- **LinkedIn Ads:** mínimo $20-30/día (más caro), solo para B2B alto ticket
- **Nunca más de $50/día total** sin test previo y aprobación de Edson

## Reglas

- **Siempre** definir baseline antes de lanzar
- **Siempre** negative keywords (bloquear "gratis", "trabajo", "usado", "segunda mano")
- **Siempre** UTMs trackeables
- **Siempre** conversion tracking funcionando antes de gastar

## Flujo

```
Edson: "plan de campaña Google Ads para keyword 'alquiler macbook lima'"
           │
           ▼
       sem-manager
           │
           ├─ keywords/YYYY-MM-DD-[campaign].md
           ├─ audiences/YYYY-MM-DD-[campaign].md
           └─ campaigns/YYYY-MM-DD-[campaign].md   ← plan completo
                     │
                     ▼
        Edson revisa → ajusta → sube a Google/Meta/LinkedIn
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/sem-manager
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `plan: [canal] [objetivo]` | Plan de campaña completo |
| `keywords: [tema]` | Keyword strategy con match types |
| `audiencia: [tipo]` | Define audiencia target |
| `analiza: [archivo]` | Analiza performance de campaña lanzada |
| `negative: [keyword]` | Lista de negative keywords |
| `budget: [monto]` | Reparte presupuesto entre canales |

## Estructura

```
sem-manager/
├── CLAUDE.md
├── agents.md
├── memory.md              ← qué funcionó, CPAs históricos, lessons
├── README.md
├── .claude/settings.json
├── campaigns/             ← planes completos
├── keywords/              ← keyword lists
├── audiences/             ← audiencias
└── reports/               ← análisis post-lanzamiento
```

## Upstream / Downstream

- **Upstream:** estratega-oferta (posicionamiento), seo-specialist (keyword research compartido), data-analyst (performance data)
- **Downstream:** copy-lanzamiento (pide ad copy), disenador-creativo (pide creativos), Edson (ejecuta)
