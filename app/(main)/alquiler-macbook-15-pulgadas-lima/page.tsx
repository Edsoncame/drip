import type { Metadata } from "next";
import SeoLandingPage from "@/components/SeoLandingPage";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquiler-macbook-15-pulgadas-lima";

export const metadata: Metadata = {
  title: "Alquiler de MacBook 15 pulgadas en Lima — Pantalla grande",
  description:
    "¿Necesitas pantalla más grande? Renta una MacBook Air 15 o MacBook Pro 14/16 en Lima. Ideal para múltiples ventanas, edición de video y trabajo largo.",
  alternates: { canonical: `${BASE}/${SLUG}` },
};

export const revalidate = 86400;

export default function Page() {
  return (
    <SeoLandingPage
      slug={SLUG}
      breadcrumbLabel="Alquiler MacBook 15 pulgadas"
      h1="Alquiler de MacBook 15 pulgadas en Lima"
      subtitle="Cuando 13 pulgadas te quedan cortas, la MacBook de 15 pulgadas es la respuesta. Más espacio de trabajo, mejor para múltiples ventanas y más cómoda para jornadas largas."
      valueProps={[
        {
          icon: "🖥️",
          title: "Más espacio visual",
          desc: "15.3 pulgadas vs 13.6: un 30% más de área de pantalla. Diseñado para tener 2-3 apps abiertas a la vez sin alt-tab constante.",
        },
        {
          icon: "🔊",
          title: "Audio de 6 parlantes",
          desc: "La MacBook Air 15 tiene 6 parlantes con audio espacial. Mejor para videollamadas, presentaciones y contenido multimedia.",
        },
        {
          icon: "💪",
          title: "Misma autonomía",
          desc: "Pese a ser más grande, mantiene 18 horas de batería como la Air 13. El trade-off real es solo 0.27 kg más de peso.",
        },
      ]}
      audience={{
        title: "¿Cuándo elegir la MacBook 15?",
        items: [
          "Trabajas con Excel/Sheets complejos con muchas columnas visibles",
          "Diseñas en Figma, Photoshop o herramientas con paneles laterales",
          "Editas video o fotos y necesitas el viewport más grande posible",
          "Haces presentaciones o demos de tu producto en reuniones",
          "Prefieres una sola pantalla grande antes que usar monitor externo",
          "Pasas más de 6 horas al día frente a la computadora",
        ],
      }}
      faqs={[
        {
          q: "¿Qué modelos de 15 pulgadas ofrecen?",
          a: "Actualmente ofrecemos MacBook Air 15 pulgadas con chip M4. También la MacBook Pro 14 pulgadas (que es muy similar en área) y próximamente la Pro 16 pulgadas para trabajos intensivos.",
        },
        {
          q: "¿Es muy pesada comparada con la de 13?",
          a: "La Air 15 pesa 1.51 kg vs 1.24 kg de la Air 13. La diferencia (0.27 kg) es notable en mochila pero manejable para uso cotidiano en oficina o home office.",
        },
        {
          q: "¿Cuál es el precio?",
          a: "MacBook Air 15 M4 desde $95/mes en plan de 24 meses. En planes más cortos la cuota mensual sube proporcionalmente.",
        },
        {
          q: "¿Debo elegir Air 15 o Pro 14?",
          a: "Si tu prioridad es tamaño de pantalla y portabilidad, elige Air 15. Si priorizas rendimiento gráfico, pantalla XDR y batería de 24h, elige Pro 14. Ambas son excelentes para trabajo profesional.",
        },
      ]}
    />
  );
}
