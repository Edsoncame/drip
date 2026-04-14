import type { Metadata } from "next";
import Link from "next/link";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "beneficios-tributarios-alquiler-equipos-peru";

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
        Si tu empresa tributa en el régimen general en Perú, el alquiler de equipos tecnológicos
        ofrece ventajas fiscales significativas sobre la compra directa. En este artículo explicamos
        qué dice SUNAT, cómo aplicarlo en tu declaración anual, y con un ejemplo numérico real.
      </p>

      <h2>1. Marco legal: Artículo 37 de la LIR</h2>
      <p>
        La Ley del Impuesto a la Renta del Perú (LIR), en su artículo 37, permite deducir los gastos
        necesarios para generar rentas de tercera categoría. Dentro de esos gastos se incluye
        expresamente el <strong>arrendamiento de bienes muebles</strong> (equipos).
      </p>
      <blockquote>
        <strong>Artículo 37 LIR, inciso d:</strong> Los alquileres de predios ocupados como casa habitación
        del contribuyente, así como los arrendamientos de cosas muebles destinadas al desarrollo de
        la actividad gravada, serán deducibles en su totalidad.
      </blockquote>

      <h2>2. ¿Qué significa en la práctica?</h2>
      <p>
        Significa que <strong>el 100% de lo que pagas mensualmente por alquiler de MacBooks es
        deducible como gasto operativo</strong>, en el mismo ejercicio fiscal en que se devenga.
      </p>
      <p>
        No necesitas depreciarlo (porque no es un activo tuyo), no requiere tabla de SUNAT, no genera
        pasivo en tu balance, y no hay límite porcentual.
      </p>

      <h2>3. El IGV en cada factura es crédito fiscal</h2>
      <p>
        Cada factura mensual que FLUX emite incluye el IGV del 18%. Ese IGV es <strong>crédito
        fiscal</strong> que tu empresa puede compensar contra el IGV que cobra en sus ventas, igual
        que con cualquier otra compra a proveedores formalizados.
      </p>
      <p>
        Ejemplo: si alquilas 3 MacBooks por $95/mes cada una = $285/mes = ~S/ 1,064. El IGV incluido
        en la factura (~S/ 162) es crédito fiscal recuperable.
      </p>

      <h2>4. Comparación con la compra directa</h2>

      <h3>Si compras</h3>
      <p>
        Cuando compras un equipo por S/ 5,400 (~$1,450 USD):
      </p>
      <ul>
        <li>Registras <strong>un activo fijo</strong> en tu balance.</li>
        <li>Debes depreciarlo al <strong>25% anual</strong> según la tabla SUNAT (Decreto Supremo 122-94-EF).</li>
        <li>Deduces solo S/ 1,350 por año durante 4 años.</li>
        <li>Si vendes o das de baja antes de los 4 años, hay ajustes contables.</li>
        <li>Asumes el IGV como costo (a menos que seas sujeto del IGV).</li>
      </ul>

      <h3>Si alquilas con FLUX</h3>
      <p>
        Con alquiler de $95/mes × 12 meses = <strong>S/ 4,287 anuales deducibles al 100%</strong>:
      </p>
      <ul>
        <li>Registras el total como <strong>gasto operativo</strong>.</li>
        <li>Deduces el <strong>100% en el mismo ejercicio</strong>.</li>
        <li>No hay activo en tu balance → ratios financieros mejores.</li>
        <li>IGV 100% crédito fiscal recuperable.</li>
        <li>Flexibilidad total al final del contrato.</li>
      </ul>

      <h2>5. Ejemplo numérico: ahorro fiscal real</h2>
      <p>
        Supongamos que tu empresa compra vs alquila 5 MacBooks durante 16 meses:
      </p>

      <h3>Escenario A: Compra</h3>
      <ul>
        <li>Precio: S/ 5,400 × 5 = <strong>S/ 27,000</strong> de capital inicial</li>
        <li>Deducción anual: 25% × 27,000 = <strong>S/ 6,750/año</strong></li>
        <li>Ahorro fiscal anual (30% IR): <strong>S/ 2,025/año</strong></li>
        <li>En 16 meses: <strong>S/ 2,700 de ahorro fiscal</strong></li>
      </ul>

      <h3>Escenario B: Alquiler FLUX</h3>
      <ul>
        <li>Cuota mensual: $95 × 5 = $475/mes = ~S/ 1,773/mes</li>
        <li>16 meses = <strong>S/ 28,368</strong> total deducible</li>
        <li>Ahorro fiscal (30% IR): <strong>S/ 8,510</strong></li>
      </ul>
      <p>
        <strong>Diferencia: S/ 5,810 más de ahorro fiscal alquilando</strong>. Además conservas los
        S/ 27,000 de capital inicial para invertirlo en tu negocio.
      </p>

      <h2>6. Requisitos SUNAT para deducir</h2>
      <p>
        Para que el gasto sea deducible sin problemas:
      </p>
      <ul>
        <li>Factura electrónica emitida por el arrendador (FLUX lo hace automáticamente).</li>
        <li>El equipo debe usarse para actividades gravadas (tu operación normal).</li>
        <li>La factura debe estar a nombre del RUC de tu empresa.</li>
        <li>Debe existir un contrato que respalde el arrendamiento (FLUX te lo entrega firmado).</li>
        <li>El pago debe hacerse por medios formales (transferencia, tarjeta).</li>
      </ul>

      <h2>7. ¿Y la detracción?</h2>
      <p>
        El arrendamiento de bienes muebles está sujeto a <strong>detracción del 10%</strong> según la
        Resolución de Superintendencia N° 183-2004/SUNAT (anexo 2, numeral 2). FLUX emite las
        facturas con la leyenda de detracción incluida y tu empresa debe depositar el 10% en la
        cuenta BN del arrendador antes de tomar el crédito fiscal.
      </p>
      <p>
        Para alquileres menores a <strong>S/ 700</strong> mensuales, la detracción no aplica.
      </p>

      <h2>8. Conclusión</h2>
      <p>
        El alquiler de MacBooks con FLUX no solo te da flexibilidad y soporte técnico — también es
        más eficiente desde el punto de vista tributario. Con los números en la mano, alquilar genera
        <strong>60-80% más ahorro fiscal</strong> que comprar en los primeros 2 años.
      </p>
      <p>
        <strong>Nota importante:</strong> este artículo es informativo. Siempre consulta con tu
        contador o asesor tributario para la aplicación específica a tu empresa y régimen.
      </p>
      <p>
        <Link href="/empresas#cotizar">Pide una cotización</Link> y recibe un análisis tributario
        personalizado para tu empresa.
      </p>
    </BlogArticleLayout>
  );
}
