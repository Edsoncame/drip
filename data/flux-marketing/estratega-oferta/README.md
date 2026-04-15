# Estratega-Oferta · FLUX

Agente estratégico de posicionamiento y oferta para FLUX.

> **No es un redactor ni un diseñador.** Es el agente que piensa qué decir y por qué, antes de que otros escriban, diseñen o lancen campañas.

---

## Qué hace este agente

- Define **posicionamiento** (dónde vive FLUX en la mente del cliente)
- Define **promesa principal** y jerarquía de promesas secundarias
- Genera **ángulos de oferta** diferentes para distintos perfiles de audiencia
- Mapea **objeciones** reales de clientes y cómo responderlas
- Prioriza **qué mensaje** debe liderar en cada canal o segmento
- Recomienda **qué testear** para validar hipótesis estratégicas
- Analiza **competidores** (Leasein, Locasa, Resa) y detecta gaps

## Qué NO hace

- NO escribe copy final de ads, emails ni landings
- NO diseña visuales
- NO ejecuta campañas en Meta / Google Ads
- NO modifica código del sitio fluxperu.com
- NO publica contenido

Para esas tareas, otros agentes toman el brief de este y los ejecutan.

---

## Cómo activarlo

### Opción A — Desde Claude Code

```bash
cd /Users/securex07/flux-marketing/estratega-oferta
claude
```

Claude Code auto-detecta el `CLAUDE.md` y carga el contexto del agente. Todo el trabajo empieza con el contexto ya cargado.

### Opción B — Desde cualquier otro lugar

Si estás trabajando en otro proyecto y quieres consultarle algo rápido al Estratega, usa:

```bash
claude --workspace /Users/securex07/flux-marketing/estratega-oferta
```

---

## Comandos rápidos

Una vez dentro del agente, estos son los atajos que reconoce:

| Comando | Qué hace |
| --- | --- |
| `brief: [tema]` | Entrega un brief estratégico completo sobre el tema |
| `ángulo: [audiencia]` | Propone 3 ángulos distintos para una audiencia específica |
| `research: [competidor/tema]` | Entra en modo research profundo con WebFetch |
| `qué opinas de X` | Respuesta directa con recomendación y justificación |
| `emergencia: X` | Modo emergencia — respuesta corta, sin análisis largo |
| `reflexión` | Autocrítica del trabajo reciente |
| `estado` | Resumen de lo que ha hecho y lo pendiente |

## Estructura del workspace

```
estratega-oferta/
├── CLAUDE.md                ← contexto del proyecto (FLUX, competidores, pricing)
├── agents.md                ← definición del agente (identidad, modos, autonomía)
├── memory.md                ← memoria persistente entre sesiones
├── README.md                ← este archivo
├── .claude/
│   └── settings.json        ← skills habilitados, permisos, MCPs
├── briefs/                  ← entregables estratégicos (se crean con el tiempo)
│   └── YYYY-MM-DD-nombre.md
└── research/                ← notas de investigación
    └── YYYY-MM-DD-tema.md
```

## Autonomía

El agente tiene 4 niveles:

- **Nivel 0 — Never do:** nunca escribe copy público, nunca toca precios, nunca modifica el sitio web, nunca publica en redes.
- **Nivel 1 — Con aprobación:** cambios de posicionamiento, matar ángulos, proponer tests que afecten tráfico pagado.
- **Nivel 2 — Hacer y avisar:** research de competidores, briefs nuevos, mapeo de objeciones, actualización de memoria.
- **Nivel 3 — Silencioso:** investigación exploratoria interna, drafts descartables.

Ver `agents.md` para el detalle completo.

## Loops automáticos

- **Semanal** (lunes): scan rápido de métricas y señales débiles.
- **Mensual** (día 1): autocrítica + scan profundo de competidores + estado de la mesa.
- **Trimestral**: revisión completa de posicionamiento y pivot strategy.

## Skills recomendados

El agente usa estos skills según el contexto:

1. **competitive-scan** — scrape competidores
2. **jtbd-analysis** — framework Jobs to be Done
3. **value-prop-canvas** — canvas de propuesta de valor
4. **objection-mapping** — mapa de objeciones
5. **positioning-statement** — generador de declaraciones de posicionamiento
6. **keyword-gap-analysis** — análisis de keywords vs competencia

Ver `.claude/settings.json` para la configuración completa.

## MCPs sugeridos (opcionales)

- **puppeteer** — screenshots de competidores
- **gdrive** — lectura de docs estratégicos
- **search-console** — datos de Google Search Console

Actualmente deshabilitados. Se activan cuando Edson lo pida.

---

## Próximos agentes de la familia

Este agente es el primero de una suite de agentes de marketing para FLUX. Los siguientes planeados:

1. **copy-writer** — toma los briefs del Estratega y escribe copies finales (ads, emails, landings)
2. **media-buyer** — ejecuta campañas en Meta, Google, TikTok, LinkedIn
3. **content-creator** — produce posts para blog, LinkedIn personal, newsletter
4. **data-analyst** — analiza métricas de GA, Search Console, Meta Ads, Culqi
5. **lead-qualifier** — califica leads del formulario B2B y los rutea

Cada agente vive en su propia carpeta bajo `/Users/securex07/flux-marketing/`.
