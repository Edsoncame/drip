/**
 * Metadata del blog de FLUX.
 *
 * Cada artículo vive en su propio archivo bajo `app/(main)/blog/[slug]/page.tsx`.
 * Este archivo solo mantiene el índice (lista ordenada por fecha) que usa
 * la página /blog y el sitemap.
 *
 * Para agregar un artículo nuevo:
 *   1. Crear app/(main)/blog/mi-slug/page.tsx con el contenido
 *   2. Agregar entrada acá con title, description, date, slug
 *   3. Sitemap se actualiza automático
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO format
  readingTime: string;
  category: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "equipar-startup-lima-macbooks-sin-capex-2026",
    title: "Cómo Equipar tu Startup en Lima con MacBooks sin Descapitalizarte (Guía 2026)",
    description: "Guía práctica para founders y CEOs: cómo equipar un equipo de 5 a 50 personas en Lima con MacBooks, sin CAPEX, con factura SUNAT y entrega en 48h.",
    date: "2026-05-17",
    readingTime: "9 min",
    category: "Guías",
  },
  {
    slug: "renting-tecnologico-peru-que-es-como-funciona-2026",
    title: "Renting Tecnológico en Perú: Qué Es, Cómo Funciona y Por Qué Cada Vez Más Empresas Lo Eligen (2026)",
    description: "Qué es el renting tecnológico en Perú, cómo se diferencia del leasing financiero y operativo, el marco legal SUNAT, ventajas tributarias y cuándo conviene para tu empresa.",
    date: "2026-05-14",
    readingTime: "7 min",
    category: "Guías",
  },
  {
    slug: "macbook-vs-windows-empresa-peru",
    title: "MacBook vs Windows para empresas en Perú: comparativa completa 2026",
    description: "¿MacBook o Windows para equipar tu empresa? Comparativa honesta de costos, productividad, soporte y tributación para empresas en Perú. Alquila desde $85/mes.",
    date: "2026-05-13",
    readingTime: "6 min",
    category: "Comparativas",
  },
  {
    slug: "renting-tecnologico-peru-guia-2026",
    title: "Renting Tecnológico en Perú: Qué es, cómo funciona y por qué cada vez más empresas lo eligen (2026)",
    description: "Guía completa sobre renting tecnológico en Perú: diferencias con leasing, marco legal (NIIF 16, Art. 37 LIR), tratamiento contable y casos de uso para empresas.",
    date: "2026-05-09",
    readingTime: "8 min",
    category: "Guías",
  },
  {
    slug: "cuanto-cuesta-mac-peru",
    title: "¿Cuánto cuesta un Mac en Perú en 2026? Precios reales y alternativas",
    description: "Precios reales de MacBook Air, MacBook Pro y Mac mini en Perú 2026. En soles y dólares. Más: cómo usar un Mac desde $85/mes sin comprarlo.",
    date: "2026-05-09",
    readingTime: "7 min",
    category: "Guías",
  },
  {
    slug: "macbook-vs-windows-laptops-empresas-peru-2026",
    title: "MacBook vs Windows para empresas en Perú 2026: ¿cuál conviene según el rol?",
    description: "¿Mac o Windows para tu empresa? La respuesta depende del rol, no de la empresa. Guía con tabla de decisión, TCO real y benchmarks para el mercado peruano 2026.",
    date: "2026-05-06",
    readingTime: "7 min",
    category: "Comparativas",
  },
  {
    slug: "macbook-desarrolladores-software-empresas-tech-peru",
    title: "Por qué los mejores equipos de desarrollo en Lima trabajan en Mac",
    description: "¿Cuánto cuesta equipar un equipo de desarrollo en Lima? Benchmarks M4 reales, análisis TCO, MDM para devs y por qué el UNIX nativo importa. Números 2026.",
    date: "2026-05-04",
    readingTime: "9 min",
    category: "Guías",
  },
  {
    slug: "equipar-equipo-remoto-peru-macbook-2026",
    title: "Cómo equipar un equipo remoto en Perú con MacBooks: guía completa 2026",
    description: "Guía práctica para CTOs y Ops managers: cómo llevar MacBooks a empleados remotos en Perú, onboarding zero-touch con MDM, gestión de flota distribuida y costos reales.",
    date: "2026-05-03",
    readingTime: "7 min",
    category: "Guías",
  },
  {
    slug: "macbook-freelancer-cuarta-categoria-deduccion-ir-peru",
    title: "MacBook como gasto deducible: guía para freelancers con rentas de cuarta categoría en Perú (2026)",
    description: "¿Podés deducir el alquiler de una MacBook si sos freelancer en Perú? Guía tributaria completa: cuarta categoría, Art. 46 LIR, flujo de caja y cuándo sí conviene alquilar.",
    date: "2026-04-30",
    readingTime: "6 min",
    category: "Tributario",
  },
  {
    slug: "alquilar-vs-comprar-macbook-peru",
    title: "¿Alquilar o comprar MacBook en Perú? Análisis completo con calculadora",
    description:
      "Comparamos costos reales, ventajas tributarias, liquidez y flexibilidad de alquilar MacBooks con FLUX vs comprarlas. Incluye calculadora interactiva.",
    date: "2026-04-14",
    readingTime: "8 min",
    category: "Finanzas",
  },
  {
    slug: "leasing-operativo-laptops-peru",
    title: "Leasing operativo de laptops en Perú: la guía definitiva 2026",
    description:
      "Qué es el leasing operativo, cómo funciona en Perú, diferencias con el financiero, y por qué es la mejor opción para equipar a tu empresa con MacBooks.",
    date: "2026-04-14",
    readingTime: "10 min",
    category: "Guías",
  },
  {
    slug: "macbook-air-vs-pro-cual-elegir",
    title: "MacBook Air M4 vs MacBook Pro M4: cuál es mejor para tu equipo",
    description:
      "Comparativa detallada entre MacBook Air y Pro con chip M4. Diferencias reales de rendimiento, precio, batería y cuándo elegir cada una.",
    date: "2026-04-14",
    readingTime: "6 min",
    category: "Comparativas",
  },
  {
    slug: "beneficios-tributarios-alquiler-equipos-peru",
    title: "Beneficios tributarios del alquiler de equipos en Perú (SUNAT 2026)",
    description:
      "Cómo deducir 100% el alquiler de laptops como gasto operativo, recuperar el IGV en cada factura, y evitar depreciar activos. Artículo 37 LIR aplicado.",
    date: "2026-04-14",
    readingTime: "7 min",
    category: "Tributario",
  },
  {
    slug: "como-contabilizar-alquiler-macbook-sunat",
    title: "Cómo contabilizar el alquiler de MacBooks en tu empresa (PCGE 2026)",
    description:
      "Guía práctica para contadores: qué cuentas usar, cómo registrar la factura mensual, IGV, retenciones y presentación ante SUNAT.",
    date: "2026-04-14",
    readingTime: "9 min",
    category: "Contabilidad",
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
