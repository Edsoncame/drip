import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-miraflores";

export const metadata: Metadata = {
  title: "Alquiler de MacBook en Miraflores — Lima",
  description:
    "Renta MacBook Air o Pro en Miraflores. Entrega en oficinas, cafés y coworkings del distrito. Perfecto para startups, agencias creativas y profesionales.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook Miraflores"
      h1="Alquiler de MacBook en Miraflores"
      subtitle="El corazón creativo y turístico de Lima. FLUX atiende startups, agencias, cafés-coworking y profesionales independientes en Miraflores con entrega rápida y soporte cercano."
      valueProps={[
        {
          icon: "🎨",
          title: "Para el perfil creativo",
          desc: "Agencias de diseño, productoras, estudios fotográficos y editores de video encuentran en MacBook Pro la herramienta ideal, sin invertir capital.",
        },
        {
          icon: "☕",
          title: "Entrega en coworking",
          desc: "Entregamos en Comunal Miraflores, Selina CoWork, WeWork Miraflores y cualquier café con buen WiFi donde trabajes.",
        },
        {
          icon: "🌎",
          title: "Cercanía con el turismo",
          desc: "Si eres nómada digital o empresario que pasa temporadas en Lima, puedes alquilar una MacBook corto plazo y devolverla al irte.",
        },
      ]}
      audience={{
        title: "Perfecto para el ecosistema de Miraflores",
        items: [
          "Agencias de marketing y branding en el distrito",
          "Productoras audiovisuales y estudios fotográficos",
          "Desarrolladores y startups en Comunal / WeWork",
          "Nómadas digitales con estancias en Lima",
          "Profesionales creativos (copywriters, ilustradores, músicos)",
          "Bootcamps y escuelas de diseño como Toulouse Lautrec o Laboratoria",
        ],
      }}
      faqs={[
        {
          q: "¿Entregan en WeWork o Comunal?",
          a: "Sí. Entregamos regularmente en Comunal Miraflores, WeWork Lima, Selina, Work in Progress y cualquier coworking del distrito. Coordinamos con recepción sin problema.",
        },
        {
          q: "¿Aceptan contratos cortos para nómadas digitales?",
          a: "El plazo mínimo es 8 meses. Para estancias más cortas, considera que puedes adquirir y revender al final, o rentar con otra opción. Escríbenos con tu caso y vemos soluciones.",
        },
        {
          q: "¿Soportan pagos con tarjeta extranjera?",
          a: "Sí, Culqi acepta Visa/Mastercard internacionales. También podemos coordinar transferencia por Wise, Revolut o similares.",
        },
        {
          q: "¿Cuánto tarda la entrega en Miraflores?",
          a: "Same-day si coordinamos antes de las 11 am. Siguiente día hábil si es más tarde. El distrito está a 15 minutos de nuestra sede en San Borja.",
        },
      ]}
    />
  );
}
