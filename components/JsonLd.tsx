import { products } from "@/lib/products";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FLUX",
    legalName: "Tika Services S.A.C.",
    url: BASE,
    logo: `${BASE}/images/logoflux.svg`,
    description:
      "Servicio de alquiler mensual de MacBook para empresas y profesionales en Lima, Perú.",
    foundingDate: "2025",
    taxID: "20605702512",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. Primavera 543, Oficina 502",
      addressLocality: "Surco",
      addressRegion: "Lima",
      postalCode: "15023",
      addressCountry: "PE",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: "hola@fluxperu.com",
      contactType: "customer service",
      availableLanguage: "es",
    },
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "FLUX — Renta de MacBooks",
    description:
      "Alquiler mensual de MacBook Air y MacBook Pro para empresas en Lima, Perú. Desde $85/mes, sin CAPEX, entrega en 24-48h.",
    url: BASE,
    logo: `${BASE}/images/logoflux.svg`,
    image: `${BASE}/og-image.png`,
    telephone: "+51932648703",
    email: "hola@fluxperu.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. Primavera 543, Oficina 502",
      addressLocality: "Surco",
      addressRegion: "Lima",
      postalCode: "15023",
      addressCountry: "PE",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -12.0464,
      longitude: -77.0428,
    },
    areaServed: {
      "@type": "City",
      name: "Lima",
    },
    priceRange: "$85 - $175 USD/mes",
    currenciesAccepted: "USD",
    paymentAccepted: "Tarjeta de crédito, Tarjeta de débito, Transferencia",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ProductJsonLd({ slug }: { slug: string }) {
  const product = products.find((p) => p.slug === slug);
  if (!product) return null;

  const lowestPrice = Math.min(...product.pricing.map((p) => p.price));
  const highestPrice = Math.max(...product.pricing.map((p) => p.price));

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: `Renta ${product.name} (${product.chip}, ${product.ram}, ${product.ssd}) desde $${lowestPrice}/mes. Sin comprar, entrega en Lima en 24-48h.`,
    image: product.image,
    brand: { "@type": "Brand", name: "Apple" },
    sku: product.slug,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: lowestPrice,
      highPrice: highestPrice,
      offerCount: product.pricing.length,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      offers: product.pricing.map((p) => ({
        "@type": "Offer",
        name: `Plan ${p.months} meses`,
        price: p.price,
        priceCurrency: "USD",
        unitCode: "MON",
        priceValidUntil: new Date(
          Date.now() + 90 * 86400000
        ).toISOString().split("T")[0],
        availability:
          product.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: `${BASE}/laptops/${product.slug}`,
      })),
    },
    additionalProperty: product.specs.map((s) => ({
      "@type": "PropertyValue",
      name: s.label,
      value: s.value,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd({
  faqs,
}: {
  faqs: { q: string; a: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
