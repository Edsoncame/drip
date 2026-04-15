# Lead-Qualifier · FLUX

Agente de calificación de leads B2B. Procesa leads del formulario `fluxperu.com/empresas#cotizar`, valida RUC vía SUNAT, aplica scoring BANT, clasifica, y redacta drafts de respuesta.

> **Nunca envía mensajes reales.** Los drafts los envía Edson.

## Qué hace

- **Lee lead** del formulario (DB o CSV de export)
- **Valida RUC** con `https://api.apis.net.pe/v1/ruc?numero=[ruc]` — estado, condición, razón social
- **Enriquece** con info pública (LinkedIn empresa si aplica)
- **Aplica scoring BANT** (0-100) adaptado a FLUX
- **Clasifica**: Hot (70-100) / Warm (40-69) / Cool (20-39) / Descartado (0-19)
- **Redacta draft de respuesta personalizado** según clasificación
- **Guarda** en `leads/[clase]/YYYY-MM-DD-[ruc].md`

## Qué NO hace

- NO envía mensajes reales al lead
- NO promete precios no publicados ni descuentos sin aprobación
- NO clasifica como Warm o Hot sin validar RUC primero
- NO actualiza la DB ni toca CRM real

## Framework de scoring (0-100)

| Factor | Peso |
|---|---|
| Tamaño del deal (# equipos) | 30 |
| Autoridad (rol) | 20 |
| Urgencia | 20 |
| Validez de empresa (RUC activa y habida) | 15 |
| Fit con producto (PyME / startup / agencia) | 15 |

## Acción por clase

| Clase | Score | Acción |
|---|---|---|
| 🔥 Hot (SQL) | 70-100 | Alerta owner, respuesta <2h, propuesta preliminar |
| 🟡 Warm (MQL) | 40-69 | Respuesta <24h con cotización completa |
| 🔵 Cool | 20-39 | Respuesta <48h con info general, nurturing |
| ⚫ Descartado | 0-19 | FAQ o no responder (spam) |

## Flujo

```
Lead nuevo en formulario B2B
           │
           ▼
      lead-qualifier
           │
           ├─ valida RUC (apis.net.pe)
           ├─ aplica scoring BANT
           ├─ redacta draft
           └─ guarda en leads/[hot|warm|cool|discarded]/YYYY-MM-DD-[ruc].md
                     │
                     ▼
              Edson revisa → envía → CRM
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/lead-qualifier
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `procesa: [lead]` | Procesa un lead (puede ser JSON, texto o URL) |
| `batch: [archivo]` | Procesa CSV/JSON de múltiples leads |
| `reprocesa: [ruc]` | Reprocesa un lead ya clasificado |
| `hot` | Lista leads Hot pendientes |
| `stats` | Stats de la semana: cuántos Hot/Warm/Cool/Descartados |

## Estructura

```
lead-qualifier/
├── CLAUDE.md
├── agents.md
├── memory.md              ← lo que funcionó en drafts, qué rol convierte más
├── README.md
├── .claude/settings.json
└── leads/
    ├── hot/               ← YYYY-MM-DD-[ruc].md
    ├── warm/
    ├── cool/
    └── discarded/
```

## Upstream / Downstream

- **Upstream:** formulario B2B, data-analyst (export de leads)
- **Downstream:** Edson (envía respuestas), data-analyst (tracking de conversión)
