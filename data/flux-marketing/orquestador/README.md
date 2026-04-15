# Orquestador · FLUX Marketing

Coordinador autónomo que ejecuta pipelines completos de marketing usando 3 subagentes especializados.

> **Una instrucción → un pipeline completo.** Sin manejar cada agente a mano.

---

## Cómo funciona

```
Tú dices: "lanza campaña para MacBook Pro dirigida a agencias creativas de Lima"
                           │
                           ▼
                   Orquestador
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      estratega-      copy-          disenador-
      oferta          lanzamiento    creativo
      │                │              │
      ▼                ▼              ▼
   brief.md      copy.md         visuales/
           │
           ▼
   Reporte consolidado al owner
```

El orquestador invoca los 3 subagentes en secuencia. Cada uno escribe en su carpeta correspondiente (`../estratega-oferta/briefs/`, `../copy-lanzamiento/output/`, `../disenador-creativo/output/`). Al final te devuelve un reporte con las rutas de todos los archivos generados.

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/orquestador
claude
```

Claude Code carga automáticamente:
- `CLAUDE.md` — instrucciones del orquestador
- `agents.md` — identidad y modos
- `memory.md` — memoria persistente
- `.claude/agents/*.md` — los 3 subagentes se cargan automáticamente

No hay que hacer nada más — los subagentes ya están listos para ser invocados.

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `campaña: [descripción]` | Pipeline completo 3 pasos (estratega → copy → diseñador) |
| `solo copy: [descripción]` | Solo copy-lanzamiento (requiere brief previo) |
| `solo visual: [descripción]` | Solo diseñador-creativo (requiere copy previo) |
| `brief: [tema]` | Solo estratega |
| `paralelo: [lista]` | Múltiples pipelines en paralelo |
| `refinar: [campaña] cambiando [X]` | Ajustar un pipeline previo |
| `estado` | Resumen de pipelines recientes |
| `último` | Detalles del último pipeline |

## Ejemplo real de uso

```
campaña: quiero captar empresas medianas peruanas (50-200 empleados) que
necesitan equipar a su equipo de diseño con MacBook Pro. El mensaje principal
debe ser el beneficio tributario del alquiler vs la compra. Canal principal:
LinkedIn Ads.
```

El orquestador:

1. **Invoca estratega-oferta** con esa descripción → el estratega genera el brief estratégico
2. **Lee el brief** generado
3. **Invoca copy-lanzamiento** pasando la ruta del brief → genera 3 variaciones de copy para LinkedIn Ad
4. **Lee el copy** generado
5. **Invoca disenador-creativo** pasando brief + copy → genera 3 visuales para LinkedIn (1200×628)
6. **Reporte final** con las rutas:

```
Pipeline completado ✓

1. Estrategia: /Users/securex07/flux-marketing/estratega-oferta/briefs/2026-04-14-empresas-medianas-linkedin.md
2. Copy: /Users/securex07/flux-marketing/copy-lanzamiento/output/2026-04-14-empresas-medianas-linkedin.md
3. Visuales: /Users/securex07/flux-marketing/disenador-creativo/output/2026-04-14-empresas-medianas-linkedin/

Próximos pasos:
- Revisar brief y aprobar
- Elegir variación de copy preferida (recomendación: balanceada)
- Subir visuales a LinkedIn Ads Manager
- Configurar segmentación y presupuesto
```

Tú solo revisas y das OK. Los archivos ya están todos donde deben estar.

## Estructura del workspace

```
orquestador/
├── CLAUDE.md                         ← cerebro del orquestador
├── agents.md                         ← identidad, modos, autonomía
├── memory.md                         ← historial y patrones aprendidos
├── README.md                         ← este archivo
├── .claude/
│   └── agents/                       ← subagentes auto-cargados
│       ├── estratega-oferta.md
│       ├── copy-lanzamiento.md
│       └── disenador-creativo.md
└── campaigns/                        ← resúmenes por campaña ejecutada
    └── YYYY-MM-DD-[slug].md
```

## Relación con los workspaces individuales

Los workspaces originales **siguen existiendo**:
- `/Users/securex07/flux-marketing/estratega-oferta/` — workspace del estratega (cuando quieres trabajar con él solo)
- `/Users/securex07/flux-marketing/copy-lanzamiento/` — workspace del copywriter
- `/Users/securex07/flux-marketing/disenador-creativo/` — workspace del diseñador

**Puedes usar cualquiera de los 4 workspaces:**

- **Orquestador** (este) — para pipelines completos autónomos
- **Workspaces individuales** — cuando solo quieres trabajar con un agente específico en modo conversacional

Los subagentes en `.claude/agents/` son **copias condensadas** de cada agente, con las reglas esenciales para funcionar como subagente. Los workspaces individuales tienen el contexto completo por si quieres profundizar.

## Autonomía

- **Nivel 0 (never-do):** nunca publica a canales reales, nunca ejecuta ads pagados, nunca modifica los `.md` de los subagentes, nunca salta el estratega si hay estrategia nueva
- **Nivel 1 (con aprobación):** modelos premium (Fal.ai en lugar de Pollinations), 3+ pipelines en paralelo, saltar pasos
- **Nivel 2 (hacer y avisar):** invocar los 3 subagentes en secuencia, guardar outputs, generar reportes
- **Nivel 3 (silencioso):** exploración previa de contexto

## Próximos agentes de la suite

```
✅ estratega-oferta      — qué decir
✅ copy-lanzamiento      — cómo escribirlo
✅ disenador-creativo    — cómo visualizarlo
✅ orquestador (este)    — coordinar los 3 de forma autónoma
⏳ media-buyer           — ejecutar en Meta/Google/TikTok/LinkedIn
⏳ content-creator       — publicar en blog/LinkedIn/newsletter
⏳ data-analyst          — medir resultados
⏳ lead-qualifier        — procesar leads B2B
```
