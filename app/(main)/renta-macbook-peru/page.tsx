import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "renta-macbook-peru";

export const metadata: Metadata = {
  title: "Renta de MacBook en Perú — Alquiler mensual desde $85",
  description:
    "Renta mensual de MacBook Air y MacBook Pro en Perú. Entrega en Lima en 24-48h. Sin comprar, sin depósito, con factura SUNAT. Personas y empresas.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Renta MacBook Perú"
      h1="Renta de MacBook en Perú"
      subtitle="Accede a la mejor MacBook Air o Pro pagando solo una cuota mensual fija. Sin letra chica, sin inversión inicial, con entrega en Lima y opción de compra al final."
      valueProps={[
        {
          icon: "💰",
          title: "Sin capital inicial",
          desc: "Pagas mes a mes. Mantienes tu liquidez intacta para crecer tu negocio o invertir donde te genera más valor.",
        },
        {
          icon: "🚚",
          title: "Entrega en Lima 24-48h",
          desc: "Una vez validada tu identidad y procesado el primer pago, enviamos tu MacBook a cualquier distrito de Lima Metropolitana.",
        },
        {
          icon: "📄",
          title: "Factura SUNAT automática",
          desc: "Cada mes recibes tu factura electrónica a nombre de tu RUC (si eres empresa) o boleta (si eres persona natural).",
        },
      ]}
      audience={{
        title: "Renta MacBook si eres...",
        items: [
          "Profesional independiente que necesita una computadora confiable sin descapitalizarte",
          "Estudiante universitario que quiere la mejor herramienta sin endeudarse",
          "Empresa peruana que quiere equipar a su equipo sin CAPEX",
          "Startup en crecimiento que prioriza flexibilidad sobre propiedad",
          "Agencia creativa que renueva equipos cada 2 años",
          "Freelancer que busca deducir el gasto 100% en SUNAT",
        ],
      }}
      faqs={[
        {
          q: "¿Qué diferencia hay entre renta, alquiler y leasing?",
          a: "Para FLUX son lo mismo: son sinónimos. 'Renta' es más usado en México, 'alquiler' en Perú, 'leasing' en términos financieros. El producto que ofrecemos es leasing operativo de MacBooks.",
        },
        {
          q: "¿Puedo rentar como persona natural?",
          a: "Sí. Emitimos boleta electrónica para personas naturales. Solo necesitas DNI y pasar la verificación de identidad estándar.",
        },
        {
          q: "¿Cuál es el plazo mínimo?",
          a: "El plazo mínimo es de 8 meses. También hay planes de 16 y 24 meses con cuota mensual más baja.",
        },
        {
          q: "¿Qué incluye la cuota mensual?",
          a: "La MacBook con cargador y cables Apple originales, entrega en Lima, soporte técnico durante todo el plazo, reemplazo por falla de fábrica, y factura SUNAT automática.",
        },
      ]}
    />
  );
}
