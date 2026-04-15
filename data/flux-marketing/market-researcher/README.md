# Market-Researcher · FLUX

Agente investigador de mercado pro. Mira hacia afuera: competencia, audiencia, tendencias, oportunidades. Entrega insights con evidencia para que el equipo decida con datos.

> **No es data-analyst** (ese mira métricas internas). Yo miro al mercado.
> **No es estratega-oferta** (ese decide posicionamiento). Yo doy la munición.
> **No es SEO** (ese busca keywords). Yo busco insights que cambian decisiones.

## Qué hace

- **Inteligencia competitiva** — análisis profundo de Leasein, Rent a Mac, etc.
- **Insights de audiencia** — PyMEs, agencias, startups, freelancers peruanos con JTBD
- **Market sizing** — TAM/SAM/SOM por segmento y ciudad
- **Trend reports** — tendencias LATAM/global en leasing de tecnología
- **Survey/interview prep** — drafts de cuestionarios y guías de entrevista

## Qué NO hace

- NO inventa data — si no encontró algo, lo dice
- NO ejecuta surveys reales ni entrevista directamente a clientes
- NO toma decisiones de posicionamiento
- NO redacta copy ni contenido

## Flujo

```
Edson: "analiza a Leasein a fondo — pricing, mensajes, debilidades"
           │
           ▼
    market-researcher
           │
           └─ competitor-analysis/YYYY-MM-DD-leasein.md
                │
                ▼
       estratega-oferta (usa insights para ajustar posicionamiento)
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/market-researcher
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `competidor: [nombre]` | Análisis completo de un competidor |
| `audiencia: [segmento]` | Deep dive de una audiencia con JTBD |
| `sizing: [mercado]` | TAM/SAM/SOM |
| `trend: [tema]` | Reporte de tendencia |
| `survey: [objetivo]` | Draft de cuestionario |
| `scan` | Weekly competitive scan |
| `digest` | Monthly trend digest |

## Formato de outputs

Todos los reportes tienen:
1. **TL;DR** — 3 bullets máximo
2. **Contexto** — qué preguntas investigó
3. **Hallazgos** — con evidencia citada
4. **Implicaciones** — qué debería hacer FLUX
5. **Confianza** — high/medium/low

## Estructura

```
market-researcher/
├── CLAUDE.md
├── agents.md
├── memory.md              ← fuentes, hipótesis validadas, lessons
├── README.md
├── .claude/settings.json
├── competitor-analysis/   ← reportes por competidor
├── audience-insights/     ← deep dives por segmento
├── trend-reports/         ← tendencias
├── market-sizing/         ← TAM/SAM/SOM
└── surveys/               ← drafts de cuestionarios
```

## Upstream / Downstream

- **Upstream:** Edson (pide research), data-analyst (comparte métricas internas para contextualizar)
- **Downstream:** estratega-oferta (usa insights), seo-specialist (detecta oportunidades), sem-manager (valida audiencias para ads)
