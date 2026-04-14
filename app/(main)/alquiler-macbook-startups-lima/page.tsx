import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-startups-lima";

export const metadata: Metadata = {
  title: "Alquiler de MacBook para startups en Lima — FLUX",
  description:
    "Equipa a tu startup con MacBooks sin quemar runway. Alquiler mensual flexible, sin CAPEX, con soporte técnico y descuento especial para startups early-stage.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook startups Lima"
      h1="Alquiler de MacBook para startups en Lima"
      subtitle="Tu runway es sagrado. En lugar de quemar $10,000 en MacBooks, paga una cuota mensual y mantén ese capital para contratar, marketing o producto."
      valueProps={[
        {
          icon: "🚀",
          title: "Pensado para early-stage",
          desc: "Contratos flexibles de 8 meses (el mínimo del mercado). Ideal para startups que aún no saben cuánto van a crecer en el próximo año.",
        },
        {
          icon: "📈",
          title: "Escalable al crecer",
          desc: "Contrataste 2 MacBooks y tu equipo creció a 8. Agregamos 6 equipos nuevos al mismo contrato sin re-negociar.",
        },
        {
          icon: "⚖️",
          title: "Balance limpio",
          desc: "Sin activos fijos tecnológicos ni pasivos por leasing bancario. Tu balance se ve más sano para inversionistas.",
        },
      ]}
      audience={{
        title: "Perfecto para startups que...",
        items: [
          "Están pre-seed o seed y no quieren descapitalizarse",
          "Tienen equipos distribuidos (varios fundadores + primeros hires)",
          "Contratan diseñadores y devs que exigen MacBook",
          "Están preparándose para un due diligence donde los activos importan",
          "Quieren cerrar su ronda con métricas operativas saludables (burn rate bajo)",
          "Necesitan equipos ya porque tienen MVP corriendo",
        ],
      }}
      faqs={[
        {
          q: "¿Hay descuento especial para startups?",
          a: "Sí. Startups con menos de 18 meses de operación que muestren constitución de sociedad reciben descuento del 10% en la primera cuota. Escríbenos mencionando que eres startup para aplicar.",
        },
        {
          q: "¿Qué modelos son los más populares entre startups?",
          a: "MacBook Air 13 M4 para founders/operaciones y MacBook Pro 14 M4 para desarrolladores y diseñadores. El 70% de nuestras startups clientes eligen Air.",
        },
        {
          q: "¿Aceptan pagos con cuenta empresa en construcción?",
          a: "Sí. Si tu startup aún no tiene cuenta bancaria empresa, podemos aceptar pago del representante legal con compromiso de regularización cuando abras la cuenta corporativa.",
        },
        {
          q: "¿Puedo escalar mi contrato si el equipo crece?",
          a: "Sí, en cualquier momento. Puedes agregar equipos adicionales al contrato existente sin tocar los plazos de los originales. Simplemente avísanos y en 48h tienes los nuevos equipos.",
        },
      ]}
    />
  );
}
