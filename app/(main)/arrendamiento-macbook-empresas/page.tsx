import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "arrendamiento-macbook-empresas";

export const metadata: Metadata = {
  title: "Arrendamiento de MacBook para empresas en Perú",
  description:
    "Arrendamiento operativo de MacBooks para empresas en Perú. Cuota mensual 100% deducible SUNAT, sin inversión inicial. Ideal para PyMEs y corporaciones.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Arrendamiento MacBook empresas"
      h1="Arrendamiento de MacBook para empresas"
      subtitle="Arrendamiento operativo de MacBook Air y Pro para empresas peruanas. El modelo más eficiente para equipar a tu equipo sin comprometer tu capital de trabajo."
      valueProps={[
        {
          icon: "📜",
          title: "Contrato formal",
          desc: "Contrato de arrendamiento operativo firmado digitalmente, con todas las cláusulas que tu asesor legal necesita revisar.",
        },
        {
          icon: "💼",
          title: "Facturación corporativa",
          desc: "Emitimos factura electrónica SUNAT mensual a nombre de tu RUC, con la leyenda de detracción correspondiente si aplica.",
        },
        {
          icon: "🤝",
          title: "Servicio B2B dedicado",
          desc: "Asesor de cuenta asignado, reportes mensuales de activos en uso, y soporte prioritario para equipos corporativos.",
        },
      ]}
      audience={{
        title: "¿Qué es el arrendamiento operativo?",
        items: [
          "Es un contrato de alquiler de bienes muebles (Artículo 37 LIR)",
          "El 100% de la cuota mensual es deducible como gasto operativo",
          "NO aparece como pasivo en tu balance (a diferencia del leasing financiero)",
          "NO requiere depreciación contable (el equipo no es tu activo)",
          "Flexible al final: devuelves, renuevas o te la quedas a un precio especial",
          "Ideal para empresas con enfoque en eficiencia financiera",
        ],
      }}
      faqs={[
        {
          q: "¿Cuál es la diferencia con el leasing financiero?",
          a: "El leasing financiero lo ofrecen los bancos, requiere evaluación crediticia, genera pasivo en balance y obliga a ejercer opción de compra al final. El arrendamiento operativo (lo nuestro) no tiene nada de eso — es más ágil y flexible.",
        },
        {
          q: "¿Necesito ser una empresa grande para acceder?",
          a: "No. Atendemos desde freelancers con RUC hasta corporaciones con 50+ colaboradores. El proceso es el mismo, cambia solo el volumen y los descuentos.",
        },
        {
          q: "¿Es contablemente como un gasto o un arrendamiento NIIF 16?",
          a: "Bajo NIIF 16 y el PCGE, el arrendamiento operativo de equipos de bajo valor o corto plazo puede reconocerse directamente como gasto (cuenta 635 — Alquileres). No requiere activar el derecho de uso.",
        },
        {
          q: "¿Puedo incluir el servicio en mi proceso de compras corporativo?",
          a: "Sí. Si tu empresa necesita que registremos nuestra ficha de proveedor con documentos (RUC 20605702512, constitución, etc.) nos avisas y te los enviamos el mismo día.",
        },
      ]}
    />
  );
}
