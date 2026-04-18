import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "macbook-mensual-peru";

export const metadata: Metadata = {
  title: "MacBook mensual en Perú — Paga por mes, no compres",
  description:
    "Obtén una MacBook Air o Pro pagando mensualmente en Perú. Desde $85/mes con todo incluido. Entrega en Lima 24-48h, opción de compra al final.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="MacBook mensual Perú"
      h1="MacBook por mes en Perú"
      subtitle="¿Quieres una MacBook pero no gastar $1,500 de golpe? Paga mes a mes con FLUX. Desde $85/mes puedes tener la mejor laptop Apple trabajando para ti."
      valueProps={[
        {
          icon: "📅",
          title: "Una cuota al mes, sin sorpresas",
          desc: "Cuota fija mensual durante todo el contrato. Nunca sube, nunca cambia, nunca hay cobros ocultos.",
        },
        {
          icon: "💳",
          title: "Paga con tarjeta o transferencia",
          desc: "Stripe procesa pagos recurrentes automáticos con cualquier tarjeta de crédito peruana. También aceptamos transferencia bancaria.",
        },
        {
          icon: "🎁",
          title: "Todo incluido",
          desc: "Cargador, cables, caja original, entrega, soporte técnico y factura electrónica — todo viene en la cuota mensual.",
        },
      ]}
      audience={{
        title: "¿Por qué pagar mensual en lugar de comprar?",
        items: [
          "No descapitalizas tu negocio ni tu ahorro personal",
          "Puedes empezar con una MacBook más cara de la que podrías comprar al contado",
          "Al final del contrato renuevas por el modelo nuevo sin revender el viejo",
          "El gasto es 100% deducible si tienes empresa",
          "Si es para uso personal: no hay revisión crediticia compleja",
          "Entrega inmediata: sin esperar aprobaciones bancarias ni plazos largos",
        ],
      }}
      faqs={[
        {
          q: "¿Cómo funciona el pago mensual?",
          a: "Al firmar el contrato pagas el primer mes. A partir del segundo mes, Stripe cobra automáticamente tu tarjeta el mismo día cada mes. También puedes pagar por transferencia bancaria subiendo el voucher a tu panel.",
        },
        {
          q: "¿Qué pasa si no puedo pagar un mes?",
          a: "Tienes 5 días de gracia después del vencimiento. Si pasan 10 días sin pago, se suspende el servicio. Si pasan 30 días, el contrato entra en cobranza. Siempre es mejor avisar por WhatsApp y coordinar una solución.",
        },
        {
          q: "¿Puedo pagar todo por adelantado?",
          a: "Sí, y te damos un descuento del 5% si pagas todo el plazo completo por adelantado. Es ideal para empresas que quieren cerrar el ejercicio fiscal con el gasto asentado.",
        },
        {
          q: "¿El cobro incluye IGV?",
          a: "Sí. Todas las cuotas mostradas ya incluyen el IGV del 18%. La factura lo desglosa por si necesitas el crédito fiscal.",
        },
      ]}
    />
  );
}
