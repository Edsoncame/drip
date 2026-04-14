import type { Metadata } from "next";
import Link from "next/link";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "como-contabilizar-alquiler-macbook-sunat";

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
        Guía práctica para contadores que reciben una factura mensual por alquiler de MacBook con
        FLUX. Explicamos la cuenta contable correcta según el Plan Contable General Empresarial
        (PCGE), el tratamiento del IGV, la detracción y cómo presentarlo ante SUNAT.
      </p>

      <h2>1. Concepto contable</h2>
      <p>
        El alquiler de equipos tecnológicos se clasifica como <strong>gasto operativo por servicios
        prestados por terceros</strong>. En el PCGE corresponde a la cuenta:
      </p>
      <blockquote>
        <strong>Cuenta 63 — Gastos de servicios prestados por terceros</strong><br />
        Subcuenta <strong>635 — Alquileres</strong><br />
        Sub-subcuenta <strong>6352 — Edificaciones o instalaciones</strong> — NO<br />
        Sub-subcuenta <strong>6353 — Maquinarias y equipos de explotación</strong> — SÍ (esta es la que aplica)
      </blockquote>

      <h2>2. Asiento contable típico</h2>
      <p>
        Supongamos que recibes una factura de FLUX por alquiler mensual de 3 MacBooks:
      </p>
      <ul>
        <li>Monto neto: S/ 1,064.00</li>
        <li>IGV (18%): S/ 191.52</li>
        <li>Total factura: S/ 1,255.52</li>
      </ul>

      <h3>Asiento por la provisión del gasto</h3>
      <pre className="text-xs">
{`————————————————————————————————————————————————————
635  Alquileres                        1,064.00
6353 Maquinarias y equipos
40   Tributos por pagar                   191.52
4011 IGV crédito fiscal
     a  42  Cuentas por pagar comerciales           1,255.52
         421  Facturas por pagar
————————————————————————————————————————————————————
Glosa: Provisión alquiler 3 MacBooks — Factura E001-XXX FLUX`}
      </pre>

      <h3>Asiento por el destino (PCGE define subcuentas 94, 95, 97 según tu uso)</h3>
      <pre className="text-xs">
{`————————————————————————————————————————————————————
94   Gastos administrativos              1,064.00
     (o 95 Gastos de ventas si aplica)
     a  79  Cargas imputables a cuenta de costos     1,064.00
————————————————————————————————————————————————————
Glosa: Destino del gasto`}
      </pre>

      <h3>Asiento por el pago</h3>
      <pre className="text-xs">
{`————————————————————————————————————————————————————
42   Cuentas por pagar comerciales     1,255.52
     a  10  Efectivo y equivalentes                  1,255.52
         1041  Cuenta corriente operativa
————————————————————————————————————————————————————
Glosa: Pago factura FLUX`}
      </pre>

      <h2>3. Tratamiento de la detracción</h2>
      <p>
        El alquiler de bienes muebles está afecto a <strong>detracción del 10%</strong> cuando el
        monto del comprobante supera <strong>S/ 700</strong> (SPOT - Resolución 183-2004/SUNAT).
      </p>
      <p>
        Sobre el monto total de la factura: S/ 1,255.52 × 10% = <strong>S/ 126</strong> (redondeado al
        mayor).
      </p>

      <h3>Asiento de la detracción</h3>
      <pre className="text-xs">
{`————————————————————————————————————————————————————
42    Cuentas por pagar comerciales       126.00
      a  10  Efectivo y equivalentes                 126.00
          1042  Cuenta detracciones
————————————————————————————————————————————————————
Glosa: Depósito detracción a cuenta BN del proveedor`}
      </pre>
      <p>
        Este depósito se hace en la <strong>cuenta del Banco de la Nación del proveedor (FLUX)</strong>
        antes de pagar el resto. FLUX te proporciona su número de cuenta de detracciones al solicitarlo.
      </p>

      <h2>4. Registro de compras electrónico</h2>
      <p>
        La factura debe registrarse en el <strong>Registro de Compras electrónico</strong> (SUNAT) en
        el periodo en que se devenga el servicio. Como es alquiler mensual, se devenga en el mes de
        uso, independientemente de cuándo llegue la factura.
      </p>
      <p>
        Campos clave del registro:
      </p>
      <ul>
        <li>Tipo de documento: 01 (Factura electrónica)</li>
        <li>Periodo: mes del servicio</li>
        <li>Base imponible con IGV: S/ 1,064.00</li>
        <li>IGV crédito fiscal: S/ 191.52</li>
        <li>Número de detracción (si aplica)</li>
        <li>Clasificación: gasto operativo</li>
      </ul>

      <h2>5. Presentación en declaración anual (DJ Anual 3ra categoría)</h2>
      <p>
        En la <strong>Declaración Jurada Anual del Impuesto a la Renta de 3ra Categoría</strong>
        (Formulario 710 Renta Anual), los gastos por alquiler se presentan en:
      </p>
      <ul>
        <li><strong>Casilla 807</strong> — Servicios prestados por terceros (incluye alquileres)</li>
        <li>Son <strong>100% deducibles</strong>, no hay límite porcentual si están debidamente sustentados</li>
      </ul>

      <h2>6. Diferencias vs otros tipos de arrendamiento</h2>
      <h3>Leasing operativo (lo que hace FLUX)</h3>
      <p>
        Se registra como gasto (cuenta 63). No se activa el bien porque no hay riesgo ni control
        sustancial del activo por parte del arrendatario (NIIF 16 permite la exención para equipos
        de bajo valor o plazos cortos).
      </p>

      <h3>Leasing financiero</h3>
      <p>
        Bajo NIIF 16, requiere reconocer el activo y el pasivo por el derecho de uso. Genera
        depreciación y gasto financiero. Solo aplica cuando hay transferencia sustancial de riesgos
        y beneficios al arrendatario, lo cual <strong>NO es el caso del alquiler operativo con FLUX</strong>.
      </p>

      <h2>7. Checklist para el contador</h2>
      <ul>
        <li>✓ Factura electrónica emitida por FLUX (RUC 20605702512)</li>
        <li>✓ Factura a nombre del RUC de la empresa arrendataria</li>
        <li>✓ Detracción del 10% depositada (si monto {'>'} S/ 700)</li>
        <li>✓ Registro en libro de compras del mes correspondiente</li>
        <li>✓ Clasificación en cuenta 635 — Alquileres</li>
        <li>✓ Contrato de alquiler disponible para fiscalización</li>
        <li>✓ Crédito fiscal del IGV tomado en el mes correspondiente</li>
        <li>✓ Presentación en DJ Anual casilla 807</li>
      </ul>

      <h2>8. Conclusión</h2>
      <p>
        El tratamiento contable del alquiler de MacBooks con FLUX es simple y ventajoso: todo va
        directo a gasto operativo sin necesidad de activar, depreciar ni llevar registros de activo
        fijo. Perfectamente deducible al 100% y con IGV crédito fiscal.
      </p>
      <p>
        Si necesitas más información o el contrato modelo para tu archivo contable,{" "}
        <Link href="/contacto">contáctanos</Link> y te lo enviamos.
      </p>
    </BlogArticleLayout>
  );
}
