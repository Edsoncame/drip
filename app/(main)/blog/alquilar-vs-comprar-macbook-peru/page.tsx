import type { Metadata } from "next";
import Link from "next/link";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import BuyVsRentCalculator from "@/components/BuyVsRentCalculator";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "alquilar-vs-comprar-macbook-peru";

export async function generateMetadata(): Promise<Metadata> {
  const post = getBlogPost(SLUG);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${BASE}/blog/${SLUG}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <p>
        Tu empresa necesita MacBooks. La pregunta es: <strong>¿vale más comprarlas o alquilarlas?</strong>
        La respuesta corta es que <strong>para la mayoría de empresas peruanas el alquiler es más
        rentable</strong>, pero depende de varios factores. En este artículo los analizamos uno por uno
        con números reales.
      </p>

      <h2>1. El costo real de comprar una MacBook</h2>
      <p>
        Cuando compras una MacBook Pro de $1,800 USD, el costo no es solo esos $1,800. Hay varios costos
        ocultos que la mayoría de empresas olvida:
      </p>
      <ul>
        <li><strong>Depreciación acelerada:</strong> pierde el 30-40% de su valor en el primer año, más del 60% a los 3 años.</li>
        <li><strong>Costo de capital (opportunity cost):</strong> ese dinero que pagaste podría haber generado un 8-12% anual invertido en tu negocio.</li>
        <li><strong>Soporte técnico:</strong> cuando falla, tú pagas la reparación. Una pantalla rota en un MacBook cuesta $400-800.</li>
        <li><strong>Reemplazo por robo o pérdida:</strong> sin AppleCare+ o seguro, pagas 100%.</li>
        <li><strong>Obsolescencia:</strong> a los 3 años Apple ya sacó 2 chips nuevos. Tu equipo está atrasado.</li>
      </ul>

      <h2>2. El costo real del alquiler con FLUX</h2>
      <p>
        Con FLUX pagas una cuota mensual fija durante 8, 16 o 24 meses. Esa cuota ya incluye:
      </p>
      <ul>
        <li>El equipo con su caja, cables y cargador originales Apple.</li>
        <li>Entrega en Lima Metropolitana en 24-48 horas hábiles.</li>
        <li>Soporte técnico durante todo el plazo: si falla por defecto de fábrica, lo reemplazamos.</li>
        <li>Factura electrónica SUNAT automática cada mes.</li>
        <li>Opción de comprar el equipo al final por su valor residual (77.5% al mes 8, 55% al mes 16, 32.5% al mes 24).</li>
      </ul>

      <h2>3. Ventajas tributarias del alquiler en Perú</h2>
      <p>
        Este es el argumento más importante para el contador de tu empresa:
      </p>
      <blockquote>
        <strong>El alquiler de equipos es 100% deducible como gasto operativo</strong> según el Artículo 37 de la Ley del Impuesto a la Renta (inciso d). Además, el IGV es crédito fiscal recuperable en cada factura mensual.
      </blockquote>
      <p>
        En cambio, la compra de un equipo genera un <strong>activo fijo</strong> que debes depreciar
        contablemente (25% anual según tabla SUNAT) y solo deduces la porción depreciada del año.
        Esto significa liquidez inmovilizada + menos deducción inmediata.
      </p>

      <h3>Ejemplo numérico</h3>
      <p>
        Supongamos que tu empresa compra 5 MacBook Air por $1,450 cada una = <strong>$7,250 USD</strong> pagados
        al contado. En tu declaración anual puedes deducir solo el 25% = <strong>$1,812</strong>. El resto
        queda como activo depreciándose.
      </p>
      <p>
        Si en cambio alquilas esas mismas 5 MacBooks con FLUX por 16 meses a $95/mes = <strong>$7,600
        totales</strong>, pero <strong>deduces el 100% en el año que corresponde</strong>. La diferencia de
        $350 se compensa con el beneficio fiscal y el costo de oportunidad del capital que conservas.
      </p>

      <h2>4. Calculadora interactiva</h2>
      <p>
        Hicimos una calculadora para que veas los números reales para tu caso específico. Cambia la
        cantidad de equipos y el plazo:
      </p>

      <div className="not-prose my-8">
        <BuyVsRentCalculator />
      </div>

      <h2>5. ¿Cuándo SÍ conviene comprar?</h2>
      <p>
        No todo es alquiler. Conviene comprar cuando:
      </p>
      <ul>
        <li>Vas a usar el equipo más de 4-5 años sin renovarlo (raro en entornos profesionales).</li>
        <li>Tienes mucho capital excedente sin mejor uso productivo.</li>
        <li>Eres una persona natural y el equipo será de uso estrictamente personal.</li>
      </ul>

      <h2>6. ¿Cuándo conviene alquilar?</h2>
      <p>
        Casi siempre, pero especialmente cuando:
      </p>
      <ul>
        <li>Necesitas equipar a un equipo de 3+ personas.</li>
        <li>Tu empresa crece y prefieres mantener liquidez.</li>
        <li>Quieres renovar los equipos cada 2 años sin revender usados.</li>
        <li>Buscas máxima deducción tributaria.</li>
        <li>No quieres ocuparte del soporte técnico.</li>
      </ul>

      <h2>7. Conclusión</h2>
      <p>
        Para la mayoría de empresas peruanas — especialmente startups, agencias y PyMEs en
        crecimiento — <strong>alquilar con FLUX es financieramente más eficiente que comprar</strong>.
        La diferencia en liquidez, beneficio fiscal y soporte incluido supera ampliamente el leve
        sobrecosto nominal del alquiler.
      </p>
      <p>
        Si tienes dudas, <Link href="/empresas#cotizar">pide una cotización gratis</Link> y nosotros
        te armamos el análisis para tu caso específico.
      </p>
    </BlogArticleLayout>
  );
}
