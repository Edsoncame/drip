# Diseñador-Creativo · FLUX

Agente que convierte briefs y copies en piezas visuales usando modelos generativos de **Fal.ai**, respetando el brand system de FLUX.

> **No es un estratega ni un copywriter.** Toma el mensaje y el texto ya definidos y produce las imágenes/videos que los acompañan.

---

## Qué hace este agente

- **Imágenes para ads** (Meta, Google Display, LinkedIn)
- **Hero sections** (visuales principales de landings)
- **Visuales de redes sociales** (Instagram, LinkedIn, Facebook)
- **Headers de email** (imagen que encabeza un email marketing)
- **Mockups de producto** (MacBooks en contextos reales)
- **Ilustraciones conceptuales** (para blog y landings)
- **Thumbnails** (Reels, TikTok, YouTube)
- **Videos cortos** (15-30s con Runway/Kling/Luma)

## Qué NO hace

- NO decide estrategia ni copy
- NO diseña logo ni identidad visual nueva (ya existe)
- NO hace edición pixel-perfect en Figma/Photoshop
- NO publica visuales directamente
- NO usa modelos fuera de Fal.ai

---

## ⚠️ IMPORTANTE: API key de Fal.ai

**El archivo `.claude/settings.json` contiene tu API key real de Fal.ai.**
Ya está configurado en `.gitignore` para que NUNCA se commitee a git.

**Si vas a mover este workspace a otra máquina:**
1. Copia `.claude/settings.json` manualmente
2. O re-ingresa tu key en el archivo

**Si tu key se compromete:**
1. Ve a https://fal.ai/dashboard → regenera tu key
2. Actualiza el archivo `.claude/settings.json` con la nueva

---

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/disenador-creativo
claude
```

Claude Code carga automáticamente:
- `CLAUDE.md` (contexto FLUX + brand system + convenciones de prompts)
- `agents.md` (identidad, modos, autonomía)
- `memory.md` (prompts aprobados, estilos calibrados)
- `.claude/settings.json` (conecta automáticamente al MCP de Fal.ai)

## Comandos rápidos

| Comando | Qué hace |
| --- | --- |
| `genera: [pieza]` | Genera una pieza visual con el flujo completo |
| `hero: [descripción]` | Genera hero image para landing o email |
| `ad: [canal] [descripción]` | Genera imagen para un anuncio específico |
| `post: [plataforma] [tema]` | Visual para redes (instagram/linkedin/facebook) |
| `mockup: [producto] [contexto]` | MacBook en un contexto (oficina, mano, escritorio) |
| `video: [descripción]` | Modo video (storyboard primero, luego Runway/Kling) |
| `explora: [tema]` | 8-12 variaciones de dirección visual |
| `moodboard: [tema]` | Referencias visuales sin generar |
| `regenera: [ID]` | Regenera una pieza previa con ajustes |
| `pulir-prompt: [prompt]` | Mejora un prompt antes de ejecutar |
| `estado` | Resumen de piezas recientes y cola |

## Primer ejemplo para probar

Una vez activado el agente, prueba esto:

```
hero: mockup de MacBook Air 13 en escritorio minimalista de oficina moderna,
luz natural suave, con notebook de cuero y café, paleta FLUX blue accent.
Aspect ratio 16:9 para el home de fluxperu.com
```

El agente va a:

1. Elegir modelo apropiado (probablemente `fal-ai/flux-pro/v1.1` para hero)
2. Construir el prompt completo siguiendo las convenciones
3. Llamar al MCP de Fal.ai
4. Generar 3-4 variaciones
5. Curar (descartar las que no cumplen brand)
6. Guardar en `output/YYYY-MM-DD-hero-home/`
7. Reportarte qué hizo

## Brand system (resumen)

**Colores:**
- Primary `#1B4FFF` · Dark `#102F99` · Light `#EEF2FF`
- Dark text `#333333` · Medium `#666666` · Light `#999999`

**Estilo visual:**
- Minimalista, limpio, premium tech
- Inspiración: Apple.com, Linear, Vercel, Stripe
- Mucho espacio blanco o azul FLUX suave
- Producto real (MacBook bien proporcionada, no interpretación rara)
- NO stock photo ni estética "AI art generic"

**Frases visuales prohibidas:**
- Personas sonriendo forzadamente
- Gradientes fosforescentes / HDR exagerado
- Fondos de circuitos, partículas, holographic overlays
- Proporciones incorrectas de MacBook

Ver `CLAUDE.md` para el detalle completo.

## Modelos de Fal.ai disponibles

### Imágenes

| Modelo | Calidad | Velocidad | Costo | Uso |
|---|---|---|---|---|
| `fal-ai/flux-pro/v1.1` | Máxima | Lento | $$$ | Hero images, landings finales |
| `fal-ai/flux/dev` | Alta | Medio | $$ | Drafts y testing |
| `fal-ai/flux/schnell` | Buena | Rápido | $ | Iteración rápida, thumbnails |
| `fal-ai/ideogram/v2` | Alta (con texto) | Medio | $$ | Cuando hay texto en la imagen |
| `fal-ai/recraft-v3` | Vectorial | Medio | $$ | Ilustraciones, iconos |
| `fal-ai/stable-diffusion-xl` | Media | Rápido | $ | Alternativa si FLUX.1 no va |

### Videos

| Modelo | Calidad | Velocidad | Costo | Uso |
|---|---|---|---|---|
| `fal-ai/runway-gen3/turbo` | Cinematográfica | Lento | $$$$ | Videos de 5-10s alta calidad |
| `fal-ai/kling-video/v1.5` | Muy buena | Medio | $$$ | Alternativa económica |
| `fal-ai/luma-dream-machine` | Fluida | Medio | $$$ | Mockups con movimiento suave |

## Autonomía

- **Nivel 0 (never-do):** nunca publica, nunca modifica el logo, nunca genera contenido explícito, nunca reproduce marcas protegidas, nunca gasta en modelos caros sin aprobación
- **Nivel 1 (con aprobación):** modelos caros (Runway, FLUX Pro en batches grandes), videos, estilos nuevos fuera de brand-refs/, gasto >$1 por sesión
- **Nivel 2 (hacer y avisar):** 3-4 variaciones con modelos rápidos, curación, actualización de memoria
- **Nivel 3 (silencioso):** pruebas internas descartables

Ver `agents.md` para detalle completo.

## Estructura del workspace

```
disenador-creativo/
├── CLAUDE.md                ← contexto FLUX + brand system + reglas de prompts
├── agents.md                ← identidad, modos, autonomía
├── memory.md                ← prompts aprobados, estilos, métricas
├── README.md                ← este archivo
├── .gitignore               ← protege settings.json del commit
├── .claude/
│   └── settings.json        ← API key de Fal.ai (privado)
├── briefs-in/               ← briefs y copies que entran
├── brand-refs/              ← referencias visuales aprobadas
└── output/                  ← imágenes/videos generados
    └── YYYY-MM-DD-pieza/
        ├── prompt.md
        ├── 01.jpg
        ├── 02.jpg
        └── 03.jpg
```

## Relación con otros agentes

```
estratega-oferta → brief → copy-lanzamiento → copy → disenador-creativo → visual
                                                              ↓
                                                     Edson revisa → publica
```

Este agente **lee** los outputs de los agentes upstream (`../copy-lanzamiento/output/` y `../estratega-oferta/briefs/`) para entender el contexto antes de generar visuales.

## Estado de la suite FLUX

1. ✅ **estratega-oferta** — qué decir
2. ✅ **copy-lanzamiento** — cómo escribirlo
3. ✅ **disenador-creativo** (este) — cómo visualizarlo
4. ⏳ **media-buyer** — lanzar en Meta/Google/TikTok/LinkedIn
5. ⏳ **content-creator** — publicar en blog/LinkedIn/newsletter
6. ⏳ **data-analyst** — medir todo
7. ⏳ **lead-qualifier** — procesar leads B2B
