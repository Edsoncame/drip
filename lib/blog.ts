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
