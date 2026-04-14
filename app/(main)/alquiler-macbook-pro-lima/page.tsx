import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-pro-lima";

export const metadata: Metadata = {
  title: "Alquiler de MacBook Pro en Lima — desde $110/mes",
  description:
    "Renta MacBook Pro M4 o M5 en Lima desde $110/mes. Ideal para edición de video, desarrollo y trabajo profesional. Entrega en 24-48h, soporte incluido.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook Pro Lima"
      h1="Alquiler de MacBook Pro en Lima"
      subtitle="La MacBook más potente del mercado, en alquiler mensual. Pantalla XDR, 24 horas de batería y chip M4 o M5. Sin comprarla, sin depósito, con entrega en 24-48 horas."
      valueProps={[
        {
          icon: "⚡",
          title: "Rendimiento profesional",
          desc: "Chip Apple M4 o M5 Pro para edición de video 4K, renderizado 3D, desarrollo con compilaciones pesadas y machine learning.",
        },
        {
          icon: "🎨",
          title: "Pantalla Liquid Retina XDR",
          desc: "1,000 nits sostenidos, HDR real y ProMotion 120Hz. La mejor pantalla del mercado para diseñadores y editores.",
        },
        {
          icon: "🔋",
          title: "24 horas de batería",
          desc: "Autonomía real para todo un día de trabajo sin buscar enchufes. La más duradera de su categoría.",
        },
      ]}
      audience={{
        title: "¿Para quién es la MacBook Pro?",
        items: [
          "Editores de video y fotógrafos profesionales",
          "Desarrolladores con cargas pesadas (Xcode, Android Studio, Unity)",
          "Diseñadores 3D, motion graphics y modelado",
          "Productores musicales y audio engineers",
          "Equipos de data science y machine learning",
          "Cualquier profesional que trabaja con muchas apps pesadas al mismo tiempo",
        ],
      }}
      faqs={[
        {
          q: "¿Cuánto cuesta alquilar una MacBook Pro en Lima?",
          a: "Desde $110/mes en plan de 24 meses, $130/mes en plan de 16 meses, $165/mes en plan de 8 meses. La cuota incluye el equipo, soporte técnico y factura electrónica SUNAT.",
        },
        {
          q: "¿Qué diferencia hay entre el M4 y el M5 Pro?",
          a: "El M5 Pro tiene 12 núcleos de CPU y 18 de GPU, contra 10+10 del M4. Es entre 25% y 40% más rápido en tareas de renderizado. Para 90% de usuarios profesionales, el M4 es suficiente.",
        },
        {
          q: "¿Puedo comprarla al final del contrato?",
          a: "Sí. Al finalizar el plazo puedes comprar la MacBook Pro por su valor residual (77.5% al mes 8, 55% al mes 16, 32.5% al mes 24). También puedes renovar o devolverla.",
        },
        {
          q: "¿Qué pasa si se daña el equipo?",
          a: "Si es falla de fábrica, la reemplazamos sin costo en 48 horas hábiles. Si es daño accidental o mal uso, el cliente asume la reparación (o puede contratar AppleCare+ al inicio).",
        },
      ]}
    />
  );
}
