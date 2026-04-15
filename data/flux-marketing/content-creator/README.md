# Content-Creator · FLUX

Agente de contenido long-form editorial. Escribe blogs (800-2500 palabras), posts LinkedIn founder-led, y newsletters.

> **No es copy-lanzamiento.** `copy-lanzamiento` redacta piezas cortas (ads, emails, bullets). `content-creator` redacta contenido largo con autoridad editorial y voz de Edson.

## Qué hace

- **Blog posts** — artículos SEO-optimizados de 800-2500 palabras basados en briefs de `seo-specialist`
- **LinkedIn founder-led** — posts en primera persona de Edson, con opinión real y datos
- **Newsletters** — emails largos para la lista de suscriptores FLUX
- **Long-form research** — artículos con data propia, entrevistas, casos de estudio
- **Repurposing** — convierte un blog en hilo LinkedIn, en carrusel, en newsletter

## Qué NO hace

- NO redacta ads, emails transaccionales o bullets cortos (eso es `copy-lanzamiento`)
- NO hace keyword research (eso es `seo-specialist`)
- NO publica nada — drafts para que Edson revise
- NO inventa data, stats ni casos — fact-checking obligatorio

## Voz editorial

- **Autoridad sin arrogancia** — Edson sabe, pero no sermonea
- **Data > opinión** — números específicos, fuentes citadas
- **Perspectiva peruana** — contexto local, no traducción de contenido gringo
- **Una idea por párrafo** — párrafos cortos, scannable
- **Sin frases trilladas** — prohibidas las mismas que `copy-lanzamiento`

## Flujo

```
seo-specialist/content-briefs/YYYY-MM-DD-tema.md
           │
           ▼
      content-creator
           │
           ├─ research/          ← notas, fuentes, data
           └─ drafts/YYYY-MM-DD-tema.md   ← Edson revisa
                     │
                     ▼
              published/         ← tracking de lo publicado
```

## Cómo activarlo

```bash
cd /Users/securex07/flux-marketing/content-creator
claude
```

## Comandos rápidos

| Comando | Qué hace |
|---|---|
| `blog: [tema]` | Redacta blog completo desde brief |
| `linkedin: [tema]` | Post LinkedIn founder-led |
| `newsletter: [tema]` | Newsletter mensual |
| `repurpose: [archivo]` | Convierte un formato en otros |
| `investiga: [tema]` | Research previo sin redactar |
| `factcheck: [archivo]` | Verifica data y fuentes |

## Estructura

```
content-creator/
├── CLAUDE.md
├── agents.md
├── memory.md
├── README.md
├── .claude/settings.json
├── research/              ← notas, fuentes
├── drafts/                ← drafts listos para revisión
└── published/             ← tracking de publicados
```

## Upstream / Downstream

- **Upstream:** seo-specialist (briefs), data-analyst (data propia), Edson (dirección editorial)
- **Downstream:** Edson publica manualmente; community-manager adapta a formato corto
