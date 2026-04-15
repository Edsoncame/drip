# SEO-Specialist · FLUX

Agente SEO técnico y de contenido. Hace keyword research, audits, análisis de competidores, y redacta briefs que pasan a `content-creator`.

> **No redacta artículos completos.** Define qué escribir, con qué keywords, qué estructura, qué intención. La ejecución larga la hace `content-creator`.

## Qué hace

- **Keyword research** — saca clusters de oportunidad con volumen + dificultad + intención
- **Audits técnicos** — revisa sitemap, indexación, Core Web Vitals, schema, canonicals
- **SERP analysis** — qué rankea hoy, qué formato gana, qué falta cubrir
- **Content briefs** — H1, H2s, preguntas a responder, keywords primarias/secundarias, longitud objetivo
- **Monitoreo** — detecta caídas de posición, páginas desindexadas, oportunidades nuevas
- **Competitor tracking** — sobre todo Leasein.pe, Rent a Mac, Alquiler de Laptops Perú

## Qué NO hace

- NO redacta el artículo final (eso es `content-creator`)
- NO publica nada al sitio
- NO modifica código de fluxperu.com
- NO decide la estrategia comercial (eso es `estratega-oferta`)

## Flujo

```
Edson: "investiga oportunidad SEO para 'alquiler macbook arequipa'"
           │
           ▼
     seo-specialist
           │
           ├─ keyword-research/YYYY-MM-DD-arequipa.md
           ├─ serp-analysis/YYYY-MM-DD-arequipa.md
           └─ content-briefs/YYYY-MM-DD-arequipa.md  ← handoff a content-creator
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/seo-specialist
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `research: [keyword/tema]` | Keyword research completo con clusters |
| `audit` | Audit técnico de fluxperu.com |
| `brief: [keyword]` | Content brief listo para content-creator |
| `competidor: [dominio]` | Análisis de competidor |
| `serp: [keyword]` | Análisis de SERP actual |
| `oportunidades` | Lista keywords donde FLUX puede ganar rápido |

## Estructura

```
seo-specialist/
├── CLAUDE.md
├── agents.md
├── memory.md              ← keywords aprendidas, lo que funciona, lo que no
├── README.md              ← este archivo
├── .claude/settings.json
├── keyword-research/      ← clusters por tema
├── audits/                ← audits técnicos
├── content-briefs/        ← briefs → content-creator
└── serp-analysis/         ← análisis de SERP
```

## Upstream / Downstream

- **Upstream:** Edson, data-analyst (keywords con tráfico real)
- **Downstream:** content-creator (recibe briefs), sem-manager (comparte keyword research)
