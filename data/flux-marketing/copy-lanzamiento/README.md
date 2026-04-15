# Copy-Lanzamiento · FLUX

Agente de redacción que toma briefs estratégicos y los convierte en piezas de copy listas para revisar.

> **No es un estratega.** No decide qué decir. Toma el mensaje ya definido y lo escribe con precisión, variaciones y adaptado al canal.

---

## Qué hace este agente

- **Emails:** bienvenida, lanzamiento, nurturing, carrito abandonado, renovación, cobranza
- **Textos promocionales:** banners, push notifications, cards de producto
- **Hooks:** primeras líneas que enganchan en ads, reels, stories, emails
- **Bullets:** listas de beneficios claras y ordenadas por impacto
- **Mensajes de lanzamiento:** anuncios de nuevo producto o promoción
- **Headlines y subheadlines:** para landings, ads, emails
- **CTAs:** llamados a la acción con verbos concretos
- **Guiones cortos:** para videos de 15-30 segundos

## Qué NO hace

- NO decide posicionamiento (eso es del `estratega-oferta`)
- NO inventa ángulos fuera del brief
- NO diseña visuales
- NO publica copy ni envía emails a clientes reales
- NO modifica el código del sitio fluxperu.com

## Flujo de trabajo

```
estratega-oferta/briefs/YYYY-MM-DD-X.md
                │
                ▼
       copy-lanzamiento/briefs-in/ (o Edson pasa directo)
                │
                ▼
              Agente
                │
                ▼
copy-lanzamiento/output/YYYY-MM-DD-pieza.md (3 variaciones)
                │
                ▼
            Edson revisa → elige variante → publica
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/copy-lanzamiento
claude
```

Claude Code carga automáticamente `CLAUDE.md`, `agents.md` y `memory.md`. Todo el contexto listo.

## Comandos rápidos

| Comando | Qué hace |
| --- | --- |
| `redacta: [tipo-de-pieza]` | Redacta una pieza nueva — necesita brief |
| `email: [tipo]` | Redacta email específico (bienvenida / promo / carrito / cobranza) |
| `hook: [audiencia]` | Genera 5-10 hooks para una audiencia |
| `bullets: [producto/promesa]` | Genera 5-10 bullets ordenados por impacto |
| `variaciones: [texto]` | Produce 5-10 variantes del mismo mensaje |
| `pulir: [texto]` | Afina un copy existente sin reescribirlo |
| `traduce: [texto]` a [canal] | Adapta un copy de un canal a otro |
| `revisa: [texto]` | Audita un copy y señala qué mejorar |
| `brief-faltante` | Muestra qué datos mínimos necesita para trabajar |
| `estado` | Resumen de lo reciente y pendiente |

## Los 4 datos mínimos para trabajar

Si le pides que redacte algo, el agente necesita estos 4 datos mínimos antes de empezar:

1. **Audiencia:** ¿a quién le hablas?
2. **Promesa principal:** ¿cuál es la frase que deben recordar?
3. **Objeción clave:** ¿qué les frena comprar?
4. **CTA:** ¿qué quieres que hagan?

Si falta alguno, el agente pregunta antes de escribir. No adivina.

## Estructura del workspace

```
copy-lanzamiento/
├── CLAUDE.md                ← contexto FLUX + convenciones de voz
├── agents.md                ← identidad, modos, autonomía, personalidad
├── memory.md                ← voz calibrada, frases aprobadas, reglas aprendidas
├── README.md                ← este archivo
├── .claude/
│   └── settings.json        ← skills y permisos
├── briefs-in/               ← briefs que llegan de Edson o del estratega
│   └── YYYY-MM-DD-nombre.md
└── output/                  ← drafts de copy generados (3 variaciones cada uno)
    └── YYYY-MM-DD-pieza.md
```

## Autonomía

Ver `agents.md` para detalle completo. Resumen:

- **Nivel 0 — Never do:** nunca publica copy a producción, nunca envía emails reales, nunca modifica CLAUDE.md/agents.md, nunca usa frases prohibidas (lista en CLAUDE.md).
- **Nivel 1 — Con aprobación:** escribir para audiencias sin brief, usar palabras nuevas del brand vocabulary, romper convenciones de voz.
- **Nivel 2 — Hacer y avisar:** generar 3 variaciones, ajustar al canal, actualizar memoria.
- **Nivel 3 — Silencioso:** drafts internos descartables.

## Convenciones de voz (resumen)

- **Español peruano.** Nada de "tío/chaval/mola/vale".
- **Una idea por párrafo.** Párrafos de 1-3 oraciones máximo.
- **Números concretos.** "$85/mes" > "precios accesibles".
- **Verbos activos en CTAs.** "Cotiza gratis" > "Contáctanos".
- **Claro antes que bonito.** Si no se entiende al primer vistazo, simplifica.

Frases prohibidas listadas en `CLAUDE.md`. El agente las evita automáticamente.

## Relación con otros agentes de la suite

- **upstream:** `estratega-oferta` (le pasa los briefs)
- **downstream (futuros):** `media-buyer` (toma el copy y lanza campañas), `content-creator` (toma el copy y lo publica en redes)

## Próximos agentes de la familia

Desde `estratega-oferta/README.md`:

1. ✅ **estratega-oferta** — define qué decir
2. ✅ **copy-lanzamiento** — redacta el qué decir
3. ⏳ **media-buyer** — ejecuta campañas pagadas
4. ⏳ **content-creator** — produce contenido orgánico (blog, LinkedIn, newsletter)
5. ⏳ **data-analyst** — analiza métricas de todos los canales
6. ⏳ **lead-qualifier** — califica leads del formulario B2B
