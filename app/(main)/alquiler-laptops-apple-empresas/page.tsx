import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-laptops-apple-empresas";

export const metadata: Metadata = {
  title: "Alquiler de laptops Apple para empresas en Perú",
  description:
    "Equipa a tu empresa con MacBooks sin invertir capital. Alquiler mensual de laptops Apple con soporte técnico, factura SUNAT y descuento por volumen.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler laptops Apple empresas"
      h1="Alquiler de laptops Apple para empresas"
      subtitle="El único proveedor peruano especializado 100% en MacBook. Equipa a tu equipo con MacBook Air o Pro pagando una cuota mensual deducible al 100% de impuestos."
      valueProps={[
        {
          icon: "🏢",
          title: "Planes por volumen",
          desc: "Descuentos progresivos cuando alquilas 5, 10 o más equipos. Mientras más equipos, menor es la cuota individual.",
        },
        {
          icon: "📊",
          title: "100% deducible SUNAT",
          desc: "La cuota mensual es gasto operativo según el Artículo 37 LIR. IGV crédito fiscal recuperable en cada factura.",
        },
        {
          icon: "🛡️",
          title: "Soporte + reemplazo",
          desc: "Si una MacBook falla, te mandamos un reemplazo en 48 horas hábiles. Tu equipo nunca pierde productividad.",
        },
      ]}
      audience={{
        title: "Ideal para empresas que...",
        items: [
          "Necesitan equipar a 5 o más colaboradores con MacBook",
          "Prefieren optimizar su balance sin activos fijos tecnológicos",
          "Quieren renovar equipos cada 2 años por modelos nuevos",
          "Buscan máxima eficiencia tributaria en gastos operativos",
          "Valoran el soporte técnico incluido sin tener IT interno",
          "Priorizan MacOS sobre Windows para su equipo (diseño, desarrollo, producción)",
        ],
      }}
      faqs={[
        {
          q: "¿Cuál es el descuento por volumen?",
          a: "A partir de 5 equipos ofrecemos hasta 8% de descuento sobre la cuota regular. A partir de 10 equipos, hasta 12%. Para más de 20, cotización personalizada con descuentos mayores.",
        },
        {
          q: "¿Puedo alquilar diferentes modelos en un mismo contrato?",
          a: "Sí. Puedes combinar MacBook Air para colaboradores administrativos y MacBook Pro para diseñadores o desarrolladores, todo bajo el mismo contrato y factura.",
        },
        {
          q: "¿Emiten factura con detracción?",
          a: "Sí. Las facturas superiores a S/ 700 tienen detracción del 10% que el cliente deposita en nuestra cuenta BN antes del pago. Cumplimos todos los requisitos SUNAT.",
        },
        {
          q: "¿Cómo funciona la renovación al final del contrato?",
          a: "Al finalizar el plazo (8, 16 o 24 meses) puedes: (1) devolver los equipos, (2) renovar el contrato con modelos nuevos manteniendo la misma cuota, o (3) comprar los equipos por su valor residual.",
        },
      ]}
    />
  );
}
