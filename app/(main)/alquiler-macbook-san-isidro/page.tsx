import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-san-isidro";

export const metadata: Metadata = {
  title: "Alquiler de MacBook en San Isidro — Entrega el mismo día",
  description:
    "Alquila MacBook Air o Pro en San Isidro, Lima. Entrega en oficinas del Centro Empresarial en el mismo día. Ideal para empresas y profesionales del distrito.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook San Isidro"
      h1="Alquiler de MacBook en San Isidro"
      subtitle="El distrito financiero de Lima merece equipos de primer nivel. FLUX entrega MacBooks en oficinas del Centro Empresarial y zona empresarial de San Isidro en el mismo día de coordinación."
      valueProps={[
        {
          icon: "⚡",
          title: "Entrega mismo día",
          desc: "Si coordinamos antes de las 11 am, tu MacBook llega a tu oficina en San Isidro esa misma tarde. Más rápido que Rappi.",
        },
        {
          icon: "🏢",
          title: "Familiarizados con el distrito",
          desc: "Entregamos regularmente en Centro Empresarial Real, Torre Begonias, Omega Building y los principales edificios de San Isidro.",
        },
        {
          icon: "💼",
          title: "Perfil B2B",
          desc: "Empresas financieras, consultoras, agencias digitales y despachos legales son nuestro perfil ideal en el distrito.",
        },
      ]}
      audience={{
        title: "Empresas y profesionales de San Isidro",
        items: [
          "Estudios de abogados en Torre del Parque",
          "Consultoras Big 4 y boutique financieras",
          "Startups con oficina en Centro Empresarial Real",
          "Agencias de marketing digital",
          "Profesionales financieros independientes",
          "Gerentes y C-level que prefieren Apple sobre Windows",
        ],
      }}
      faqs={[
        {
          q: "¿Realmente entregan el mismo día en San Isidro?",
          a: "Sí. San Isidro es uno de los 4 distritos con entrega same-day garantizada. Coordinas antes de las 11 am, recibes antes de las 5 pm.",
        },
        {
          q: "¿Tienen oficina física en San Isidro?",
          a: "Nuestra sede está en Av. Primavera 543, Piso 4, San Borja (a 8 minutos de San Isidro). Entregamos en tu oficina para tu comodidad.",
        },
        {
          q: "¿Entregan en edificios con protocolos de seguridad?",
          a: "Sí. Si tu edificio requiere que coordinemos con recepción (Centro Empresarial, Torre Begonias, etc.), lo hacemos. Solo avísanos al momento de firmar.",
        },
        {
          q: "¿Puedo pagar con transferencia BCP o Interbank?",
          a: "Sí. Aceptamos transferencia a cuenta BCP, Interbank, BBVA, Scotiabank y también pago con tarjeta vía Culqi.",
        },
      ]}
    />
  );
}
