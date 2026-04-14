import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

/**
 * Template reutilizable para landing pages orientadas a SEO.
 *
 * Cada landing es un thin wrapper que provee:
 *   - h1, hero text, CTA
 *   - 3 bloques de value props
 *   - bloque "para quién"
 *   - sección FAQ corta
 *   - CTA final
 *
 * Se estructura así para que Google vea rápido: H1 único, keywords
 * relacionadas en H2, listas de beneficios, schema.org Breadcrumb.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export interface SeoLandingProps {
  slug: string; // para breadcrumb
  breadcrumbLabel: string;
  h1: string;
  subtitle: string;
  primaryCtaHref?: string;
  primaryCtaText?: string;
  valueProps: { icon: string; title: string; desc: string }[];
  audience: { title: string; items: string[] };
  faqs?: { q: string; a: string }[];
}

export default function SeoLandingPage({
  slug,
  breadcrumbLabel,
  h1,
  subtitle,
  primaryCtaHref = "/empresas#cotizar",
  primaryCtaText = "Pedir cotización gratis",
  valueProps,
  audience,
  faqs = [],
}: SeoLandingProps) {
  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: breadcrumbLabel, url: `${BASE}/${slug}` },
        ]}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#1B4FFF] to-[#102F99] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-800 mb-5 leading-tight">{h1}</h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={primaryCtaHref}
              className="px-6 py-3.5 bg-white text-[#1B4FFF] font-700 rounded-full hover:bg-[#F7F7F7] transition-colors"
            >
              {primaryCtaText}
            </Link>
            <Link
              href="/laptops"
              className="px-6 py-3.5 border border-white/30 text-white font-700 rounded-full hover:bg-white/10 transition-colors"
            >
              Ver MacBooks disponibles
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {valueProps.map((v) => (
              <div key={v.title} className="bg-[#F7F7F7] rounded-2xl p-6">
                <div className="text-3xl mb-3">{v.icon}</div>
                <h2 className="font-700 text-[#18191F] text-lg mb-2">{v.title}</h2>
                <p className="text-sm text-[#666] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-800 text-[#18191F] mb-6 text-center">{audience.title}</h2>
          <ul className="space-y-3 text-[#333]">
            {audience.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="text-[#1B4FFF] font-700 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-800 text-[#18191F] mb-8 text-center">
              Preguntas frecuentes
            </h2>
            <div className="space-y-4">
              {faqs.map((f) => (
                <div
                  key={f.q}
                  className="bg-white border border-[#E5E5E5] rounded-2xl p-5"
                >
                  <p className="font-700 text-[#18191F] mb-2">{f.q}</p>
                  <p className="text-sm text-[#666] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="py-16 bg-[#18191F] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-800 mb-3">¿Listo para dar el siguiente paso?</h2>
          <p className="text-lg opacity-80 mb-6">
            Cotización personalizada en menos de 24 horas. Sin compromiso.
          </p>
          <Link
            href={primaryCtaHref}
            className="inline-block px-8 py-4 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors"
          >
            {primaryCtaText}
          </Link>
        </div>
      </section>
    </div>
  );
}
