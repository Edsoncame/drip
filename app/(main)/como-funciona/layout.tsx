import type { Metadata } from "next";
import { FAQJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "¿Cómo funciona el alquiler de MacBook?",
  description: "Alquila tu MacBook en 6 pasos: elige modelo, selecciona plan, paga el primer mes y recibe tu Mac en Lima en 24-48h. Sin depósito, sin trámites largos.",
  openGraph: {
    title: "¿Cómo funciona? | FLUX — Alquiler de MacBook en Lima",
    description: "Alquila tu MacBook en minutos. Elige, paga y recibe en 24-48h en Lima.",
  },
};

const faqs = [
  { q: "¿Necesito pagar un depósito de garantía?", a: "No. FLUX no pide depósito. El primer mes de renta es el único pago al inicio." },
  { q: "¿Puedo salirme antes de terminar el plazo?", a: "Puedes cancelar una vez que completes tu plazo mínimo (8, 16 o 24 meses). Solo coordinas la devolución del equipo." },
  { q: "¿Qué pasa si se daña la Mac?", a: "Los daños por accidente están fuera de la cobertura básica. Por eso ofrecemos AppleCare+ como add-on." },
  { q: "¿Puedo comprar la Mac al terminar?", a: "Sí. El precio de compra está fijado desde el inicio: 77.5% a 8 meses, 55% a 16 meses y 32.5% a 24 meses." },
  { q: "¿Cuánto demora la entrega en Lima?", a: "Entre 24 y 48 horas hábiles desde que confirmamos tu pedido. Entregamos en tu oficina o donde nos digas en Lima." },
];

export default function ComoFuncionaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FAQJsonLd faqs={faqs} />
      {children}
    </>
  );
}
