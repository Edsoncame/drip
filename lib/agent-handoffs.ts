/**
 * Sistema de handoffs agent-to-agent.
 *
 * Cuando un agente termina de escribir archivos, este módulo revisa las reglas
 * y dispara automáticamente al siguiente agente del pipeline. Así, cuando el
 * estratega escribe un brief, el copywriter lo agarra solo; cuando el copy
 * termina variaciones, el diseñador hace los visuales sin que nadie pida.
 *
 * Protección anti-loop: cada ejecución lleva `depth` y paramos en 2.
 */

import type { AgentId } from "./agents";

export interface HandoffRule {
  when: {
    agent: AgentId;
    pathMatches: RegExp;
  };
  then: {
    agent: AgentId;
    taskTemplate: (ctx: { sourceAgent: AgentId; sourcePath: string }) => string;
  };
  description: string;
}

export const HANDOFF_RULES: HandoffRule[] = [
  {
    description: "Brief estratégico → Copywriter redacta variaciones",
    when: {
      agent: "estratega-oferta",
      pathMatches: /^briefs\/.*\.md$/,
    },
    then: {
      agent: "copy-lanzamiento",
      taskTemplate: ({ sourcePath }) =>
        `El estratega acaba de publicar un brief nuevo: ${sourcePath}. Leelo con read_file y escribí 3 variaciones de copy (conservadora / balanceada / osada) para email de bienvenida B2B + Meta ad primary text + Google ad headlines. Guardalo en output/YYYY-MM-DD-[slug].md`,
    },
  },
  {
    description: "Copy listo → Diseñador genera visuales",
    when: {
      agent: "copy-lanzamiento",
      pathMatches: /^output\/.*\.md$/,
    },
    then: {
      agent: "disenador-creativo",
      taskTemplate: ({ sourcePath }) =>
        `El copywriter terminó variaciones en ${sourcePath}. Leé el copy con read_file, extraé la promesa principal y generá 3 visuales hero 16:9 con generate_image (ambientes sin MacBook como protagonista). Guardá las URLs + prompts en output/YYYY-MM-DD-[slug]-visuals.md`,
    },
  },
  {
    description: "Content brief SEO → Editor escribe el artículo",
    when: {
      agent: "seo-specialist",
      pathMatches: /^content-briefs\/.*\.md$/,
    },
    then: {
      agent: "content-creator",
      taskTemplate: ({ sourcePath }) =>
        `El SEO publicó un content brief en ${sourcePath}. Leelo con read_file y escribí el artículo completo (800-2500 palabras) respetando H1/H2s/keywords del brief. Guardalo en drafts/YYYY-MM-DD-[slug].md`,
    },
  },
  {
    description: "Lead calificado Hot → Scout notifica al estratega",
    when: {
      agent: "lead-qualifier",
      pathMatches: /^leads\/hot\/.*\.md$/,
    },
    then: {
      agent: "estratega-oferta",
      taskTemplate: ({ sourcePath }) =>
        `El scout calificó un lead Hot en ${sourcePath}. Leelo con read_file y generá un brief estratégico específico para esa empresa/segmento en briefs/YYYY-MM-DD-[empresa].md con ángulo, promesa y próximo paso comercial.`,
    },
  },
  {
    description: "Research de mercado → Estratega ajusta la oferta",
    when: {
      agent: "market-researcher",
      pathMatches: /^competitor-analysis\/.*\.md$/,
    },
    then: {
      agent: "estratega-oferta",
      taskTemplate: ({ sourcePath }) =>
        `El market-researcher publicó un análisis de competidor en ${sourcePath}. Leelo con read_file, identificá qué debilidades explotar y actualizá la estrategia en briefs/YYYY-MM-DD-respuesta-[competidor].md`,
    },
  },
];

/**
 * Retorna la lista de handoffs que se disparan por los archivos recién escritos.
 */
export function matchHandoffs(
  sourceAgent: AgentId,
  filesWritten: { relPath: string }[],
): { rule: HandoffRule; sourcePath: string }[] {
  const out: { rule: HandoffRule; sourcePath: string }[] = [];
  for (const file of filesWritten) {
    for (const rule of HANDOFF_RULES) {
      if (rule.when.agent !== sourceAgent) continue;
      if (!rule.when.pathMatches.test(file.relPath)) continue;
      // Solo el primer match por archivo para no disparar 2 agentes a la vez
      out.push({ rule, sourcePath: file.relPath });
      break;
    }
  }
  return out;
}
