import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-san-borja";

export const metadata: Metadata = {
  title: "Alquiler de MacBook en San Borja — Entrega inmediata",
  description:
    "Renta MacBook Air o Pro en San Borja, Lima. FLUX tiene sede en Av. Primavera 543 — entrega en minutos en todo el distrito. Profesionales y empresas.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook San Borja"
      h1="Alquiler de MacBook en San Borja"
      subtitle="FLUX tiene su sede en San Borja, por lo que los clientes del distrito tenemos el privilegio de recibir su MacBook en el menor tiempo posible — a veces en menos de una hora."
      valueProps={[
        {
          icon: "📍",
          title: "Somos tu vecino",
          desc: "Sede en Av. Primavera 543, Piso 4. Para entregas en San Borja podemos ir caminando o en taxi en menos de 15 minutos.",
        },
        {
          icon: "⏱️",
          title: "Express delivery",
          desc: "Coordinas hoy, recibes hoy. Si tu oficina está en Av. Aviación, Canaval y Moreyra o cerca del Centro Cívico, tu MacBook llega en menos de 2 horas.",
        },
        {
          icon: "🤝",
          title: "Soporte presencial",
          desc: "Si tienes cualquier problema técnico, puedes pasar por nuestra oficina y lo resolvemos en el momento. Solo clientes de San Borja tienen este privilegio.",
        },
      ]}
      audience={{
        title: "Ideal para el perfil de San Borja",
        items: [
          "Empresas en el Centro Cívico y Canaval y Moreyra",
          "Profesionales cerca del Real Plaza Primavera",
          "Clínicas y consultorios médicos modernizando su equipo",
          "Oficinas gubernamentales con tecnología Apple",
          "Residentes del distrito en home office",
          "Startups en el ecosistema local",
        ],
      }}
      faqs={[
        {
          q: "¿Tienen oficina que pueda visitar en San Borja?",
          a: "Sí. Av. Primavera 543, Piso 4. Para visitas técnicas coordinamos cita previa por WhatsApp (+51 900 164 769). No tenemos atención al público walk-in.",
        },
        {
          q: "¿Cuánto tardan en entregar en San Borja?",
          a: "Entre 1 y 3 horas si coordinamos en la mañana. Es el distrito más rápido de todos porque estamos físicamente acá.",
        },
        {
          q: "¿Ofrecen soporte técnico presencial?",
          a: "Sí, exclusivo para clientes de San Borja. Si hay algún problema con tu equipo, lo resolvemos en nuestra oficina sin tener que esperar envío de reemplazo.",
        },
        {
          q: "¿Empresas en el Real Plaza Primavera están incluidas?",
          a: "Claro. Entregamos regularmente en las oficinas cerca del Real Plaza y en el sector corporativo de Canaval y Moreyra.",
        },
      ]}
    />
  );
}
