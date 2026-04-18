import type { Metadata } from "next";
import Link from "next/link";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "leasing-operativo-laptops-peru";

export async function generateMetadata(): Promise<Metadata> {
  const post = getBlogPost(SLUG);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${BASE}/blog/${SLUG}` },
    openGraph: { title: post.title, description: post.description, type: "article", publishedTime: post.date },
  };
}

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <p>
        El <strong>leasing operativo</strong> es una de las formas más inteligentes de equipar a tu
        empresa con tecnología en Perú. A diferencia del leasing financiero o la compra directa, te
        permite acceder a equipos de última generación sin comprometer capital ni asumir la
        depreciación.
      </p>

      <h2>1. ¿Qué es exactamente el leasing operativo?</h2>
      <p>
        El leasing operativo (también llamado <em>arrendamiento operativo</em> o <em>HaaS - Hardware
        as a Service</em>) es un contrato por el cual una empresa paga una cuota mensual fija durante un
        plazo determinado a cambio del uso de un equipo. Al finalizar el contrato, el equipo vuelve al
        proveedor o puede ser comprado por su valor residual.
      </p>
      <p>
        <strong>Característica clave:</strong> el equipo NO es propiedad de la empresa durante el
        contrato. Por eso no se deprecia en tu balance ni consume tu capital de trabajo.
      </p>

      <h2>2. Diferencias entre los 3 modelos</h2>
      <h3>Compra directa</h3>
      <ul>
        <li>Pagas el total de una vez.</li>
        <li>Capital inmovilizado desde el día 1.</li>
        <li>Te vuelves dueño y asumes depreciación.</li>
        <li>Soporte técnico, seguros y obsolescencia corren por tu cuenta.</li>
      </ul>

      <h3>Leasing financiero</h3>
      <ul>
        <li>Un banco compra el equipo y te lo arrienda con opción de compra al final.</li>
        <li>Requiere evaluación crediticia y garantías.</li>
        <li>Aparece como pasivo en tu balance.</li>
        <li>Plazos típicos de 24 a 60 meses.</li>
        <li>Al final, normalmente ejerces la opción de compra y te quedas con el equipo.</li>
      </ul>

      <h3>Leasing operativo (lo que ofrece FLUX)</h3>
      <ul>
        <li>Cuota mensual fija que cubre equipo + soporte + garantía.</li>
        <li>No requiere garantías ni evaluación bancaria.</li>
        <li>NO aparece como pasivo en tu balance.</li>
        <li>Plazos cortos (8, 16 o 24 meses) con flexibilidad total.</li>
        <li>Al final: devuelves, renuevas con equipo nuevo, o te la quedas a un precio especial.</li>
      </ul>

      <h2>3. Ventajas del leasing operativo en Perú</h2>
      <h3>Tributarias</h3>
      <p>
        El pago mensual es 100% deducible como gasto operativo bajo el <strong>Artículo 37 de la Ley
        del Impuesto a la Renta</strong> (inciso d). Además, el IGV es crédito fiscal recuperable en
        cada factura mensual emitida por el arrendador.
      </p>

      <h3>Financieras</h3>
      <ul>
        <li><strong>Cero capital inicial:</strong> no descapitalizas la empresa.</li>
        <li><strong>Flujo de caja predecible:</strong> pagas lo mismo cada mes, fácil de proyectar.</li>
        <li><strong>Ratios saludables:</strong> al no tener pasivo ni activo fijo, tu ratio de endeudamiento y ROA mejoran.</li>
      </ul>

      <h3>Operativas</h3>
      <ul>
        <li>Soporte técnico incluido durante todo el plazo.</li>
        <li>Reemplazo inmediato en caso de falla de fábrica.</li>
        <li>Renovación automática por modelos más nuevos cada 2 años (si lo deseas).</li>
      </ul>

      <h2>4. ¿Cuándo NO usar leasing operativo?</h2>
      <p>
        El leasing operativo no es para todos. No lo uses si:
      </p>
      <ul>
        <li>Necesitas ser propietario del equipo por razones específicas (ej. llevarlo como aporte a un proyecto).</li>
        <li>Vas a usar el equipo más de 4-5 años sin renovarlo (comprar sale ligeramente mejor a muy largo plazo).</li>
        <li>Tu empresa tiene exceso de liquidez sin mejor uso productivo.</li>
      </ul>

      <h2>5. Proceso típico con FLUX</h2>
      <ol>
        <li><strong>Elige el modelo</strong> en nuestro catálogo o pídenos una cotización personalizada.</li>
        <li><strong>Firma el contrato</strong> digitalmente (10 minutos).</li>
        <li><strong>Valida identidad</strong> (DNI + selfie) si es persona natural, o RUC si es empresa.</li>
        <li><strong>Primer pago</strong> por Stripe (tarjeta) o transferencia bancaria.</li>
        <li><strong>Entrega en 24-48h</strong> en tu oficina en Lima.</li>
        <li><strong>Factura electrónica SUNAT</strong> mensual automática.</li>
      </ol>

      <h2>6. ¿Cuánto cuesta el leasing operativo de MacBooks?</h2>
      <p>
        Depende del modelo y plazo. Nuestros precios actuales (abril 2026):
      </p>
      <ul>
        <li>MacBook Air 13&quot; M4 desde <strong>$85/mes</strong> (plan 24 meses)</li>
        <li>MacBook Pro 14&quot; M4 desde <strong>$110/mes</strong> (plan 24 meses)</li>
        <li>MacBook Pro 14&quot; M5 desde <strong>$125/mes</strong> (plan 24 meses)</li>
      </ul>
      <p>
        Para empresas con 5+ equipos aplicamos <strong>descuento por volumen</strong>. Pide tu
        cotización personalizada en <Link href="/empresas#cotizar">/empresas</Link>.
      </p>

      <h2>7. Conclusión</h2>
      <p>
        El leasing operativo es el estándar en Europa y Estados Unidos para equipar empresas modernas,
        y está empezando a crecer fuerte en Perú. Si tu empresa busca flexibilidad, liquidez y
        eficiencia tributaria, es el modelo ideal. FLUX es el único proveedor especializado 100% en
        MacBook en el país.
      </p>
    </BlogArticleLayout>
  );
}
