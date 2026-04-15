# Data-Analyst · FLUX

Agente de datos. Consolida métricas de todas las fuentes (Search Console, GA4, Meta Ads, Google Ads, Culqi, PostgreSQL) y entrega reportes.

> **Solo lectura.** Nunca ejecuta mutaciones en la DB (DELETE/DROP/UPDATE bloqueados).

## Qué hace

- **Reportes semanales y mensuales** — MRR, LTV, CAC, churn, funnel, cohorts
- **Anomaly detection** — detecta caídas/picos raros (tráfico, conversión, ads)
- **Attribution modeling** — qué canal trae qué leads, last-click 30d
- **LTV/CAC por canal** — dónde estamos ganando, dónde perdiendo plata
- **SQL ad-hoc** — responde preguntas específicas con queries sobre Postgres
- **Dashboards snapshots** — números clave en un solo lugar

## Qué NO hace

- NO modifica la DB nunca (DELETE / DROP / UPDATE / INSERT bloqueados)
- NO ejecuta campañas ni toma decisiones comerciales
- NO publica reportes externos — drafts para Edson

## Fuentes de datos

| Fuente | Status | Qué tiene |
|---|---|---|
| Google Search Console | ✓ activo | Impresiones, clicks, posiciones, queries |
| GTM + GA4 | ✓ parcial | Pageviews, eventos básicos (faltan ecommerce events) |
| Meta Pixel | ⚠ pendiente | Instalar y configurar eventos |
| Google Ads | ✓ activo | Campañas, keywords, conversiones |
| Culqi | ✓ activo | Pagos, reembolsos, disputas |
| PostgreSQL FLUX | ✓ activo | users, subscriptions, payments, equipment, products |

## Métricas clave

- **MRR** (monthly recurring revenue)
- **LTV** por cohorte de adquisición
- **CAC** por canal (Google / Meta / SEO / directo / referidos)
- **Funnel:** visita → signup → cotización → pago → entrega
- **Churn rate** mensual
- **NPS** si aplica

## Flujo

```
Edson: "reporte semanal"
           │
           ▼
      data-analyst
           │
           ├─ queries/YYYY-MM-DD-*.sql
           ├─ reports/weekly/YYYY-WW.md
           └─ anomalies/YYYY-MM-DD-*.md   ← si detectó algo raro
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/data-analyst
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `semanal` | Reporte de la semana pasada |
| `mensual` | Reporte del mes pasado |
| `query: [pregunta]` | Query ad-hoc a Postgres |
| `ltv-cac` | Cálculo LTV/CAC por canal |
| `funnel` | Estado del funnel completo |
| `anomalias` | Revisa últimos 7 días en busca de anomalías |
| `cohort: [mes]` | Análisis de cohorte |

## Estructura

```
data-analyst/
├── CLAUDE.md
├── agents.md
├── memory.md              ← baselines, definiciones de métricas, fórmulas
├── README.md
├── .claude/settings.json
├── queries/               ← SQL ad-hoc
├── reports/
│   ├── weekly/            ← YYYY-WW.md
│   └── monthly/           ← YYYY-MM.md
└── anomalies/             ← alertas de anomalías
```

## Upstream / Downstream

- **Upstream:** todas las fuentes de datos
- **Downstream:** seo-specialist (data de tráfico), sem-manager (performance), estratega-oferta (validación de hipótesis), Edson (decisiones)
