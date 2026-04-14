import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-surco";

export const metadata: Metadata = {
  title: "Alquiler de MacBook en Surco — Lima",
  description:
    "Renta MacBook Air o Pro en Santiago de Surco. Entrega rápida en zonas residenciales, oficinas y edificios corporativos. Home office, estudiantes y empresas.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook Surco"
      h1="Alquiler de MacBook en Surco"
      subtitle="Santiago de Surco combina oficinas corporativas con el perfil residencial más grande de Lima. FLUX entrega MacBooks tanto en casas para home office como en empresas del distrito."
      valueProps={[
        {
          icon: "🏠",
          title: "Home office premium",
          desc: "Si trabajas remoto desde Surco, una MacBook Air o Pro convierte tu casa en una oficina productiva sin gastar una fortuna.",
        },
        {
          icon: "🎓",
          title: "Estudiantes universitarios",
          desc: "Surco concentra universidades como UPC, USIL y USMP. Planes accesibles desde $85/mes para carreras que exigen Apple (diseño, arquitectura, audiovisual).",
        },
        {
          icon: "🚗",
          title: "Entrega flexible",
          desc: "Entregamos en condominios (coordinamos con portería), edificios corporativos y puntos de encuentro en el distrito.",
        },
      ]}
      audience={{
        title: "Para residentes y empresas de Surco",
        items: [
          "Profesionales en home office (tendencia post-pandemia)",
          "Estudiantes de UPC, USIL, USMP y Toulouse Lautrec",
          "Empresas con oficinas en Chacarilla y Camacho",
          "Familias que necesitan equipo para estudios o trabajo",
          "Diseñadores y creativos freelance del distrito",
          "Profesionales que buscan renovar sin comprar",
        ],
      }}
      faqs={[
        {
          q: "¿Entregan en condominios privados de Surco?",
          a: "Sí. Coordinamos con la portería o administración del condominio. Solo necesitas avisar a tu conserje que FLUX va a entregar un equipo a tu nombre.",
        },
        {
          q: "¿Atienden a estudiantes universitarios?",
          a: "Sí, con DNI o carné de extranjería. Si tienes RUC individual de cuarta categoría, también emitimos factura electrónica deducible.",
        },
        {
          q: "¿Es Surco una zona con entrega same-day?",
          a: "Sí. Surco está en nuestro radio principal de entrega. Coordinas antes de las 11 am, entregamos en la tarde.",
        },
        {
          q: "¿Tienen planes para familias que necesitan 2+ equipos?",
          a: "Sí. A partir de 2 equipos aplica descuento del 5%, y a partir de 3 equipos el 8%. Ideal para hermanos estudiantes o familias con trabajo remoto.",
        },
      ]}
    />
  );
}
