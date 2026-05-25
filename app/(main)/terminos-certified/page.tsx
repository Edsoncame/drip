import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones — FLUX Certified | Venta de MacBooks Reacondicionados",
  description:
    "Términos y condiciones de compraventa de equipos FLUX Certified (MacBooks reacondicionados). Garantía 90 días, política de devolución 7 días, métodos de pago y despacho. Tika Services S.A.C., Lima, Perú.",
  robots: { index: true, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-700 text-[#18191F] mb-3 pb-2 border-b border-[#F0F0F0]">{title}</h2>
      <div className="text-sm leading-relaxed text-[#555555] space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-[#333333] [&_strong]:font-600">
        {children}
      </div>
    </div>
  );
}

export default function TerminosCertifiedPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <Link href="/comprar" className="text-xs text-[#1B4FFF] hover:underline mb-4 inline-block">
          ← Volver a FLUX Certified
        </Link>
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 bg-[#EEF2FF] text-[#1B4FFF] text-xs font-700 rounded-full">FLUX Certified</span>
        </div>
        <h1 className="text-2xl font-black text-[#18191F] mb-2">Términos y Condiciones de Compraventa</h1>
        <p className="text-sm text-[#999999]">
          Última actualización: mayo 2026 · Aplicable a todos los equipos FLUX Certified adquiridos desde fluxperu.com
        </p>
      </div>

      <Section title="1. Partes del contrato">
        <p>
          <strong>Vendedor:</strong> Tika Services S.A.C., con RUC 20612345678, domicilio en Av. Primavera, Surco,
          Lima, Perú. Correo: hola@fluxperu.com.
        </p>
        <p>
          <strong>Comprador:</strong> la persona natural o jurídica que realiza la compra a través del sitio web
          fluxperu.com o mediante acuerdo directo con FLUX.
        </p>
        <p>
          Al completar el proceso de pago, el Comprador declara haber leído, entendido y aceptado los presentes
          Términos y Condiciones en su totalidad.
        </p>
      </Section>

      <Section title="2. Descripción del producto">
        <p>
          Los equipos <strong>FLUX Certified</strong> son MacBooks Apple que formaron parte de la flota de
          arrendamiento operativo de FLUX y que, al concluir su ciclo de renta, son sometidos a un proceso de
          revisión técnica de <strong>15 puntos</strong> antes de ofrecerse a la venta.
        </p>
        <p>
          Cada equipo se vende como <strong>reacondicionado</strong> (no nuevo). El estado de cada unidad se
          indica expresamente en la ficha del producto mediante una de las siguientes clasificaciones:
        </p>
        <ul>
          <li><strong>Excelente</strong> — sin marcas de uso visibles, batería con alta capacidad remanente.</li>
          <li><strong>Muy bueno</strong> — marcas de uso mínimas, funcionamiento óptimo en todos los componentes.</li>
          <li><strong>Bueno</strong> — marcas de uso normales, funcionamiento correcto en todos los componentes.</li>
        </ul>
        <p>
          Las imágenes son referenciales. Las especificaciones técnicas (chip, RAM, SSD, color) publicadas en la
          ficha del producto son las del equipo real y prevalecen sobre cualquier imagen.
        </p>
      </Section>

      <Section title="3. Precio y pago">
        <p>
          Todos los precios publicados están expresados en <strong>dólares americanos (USD)</strong> e incluyen
          IGV (18 %). El tipo de cambio aplicable para pagos en soles se determina al momento del pago.
        </p>
        <p>
          Los pagos se procesan a través de <strong>Stripe</strong>. FLUX no almacena datos de tarjeta; el
          procesamiento es realizado íntegramente por Stripe bajo estándar PCI-DSS.
        </p>
        <p>
          Se aceptan:
        </p>
        <ul>
          <li>Tarjetas de crédito y débito Visa, Mastercard y American Express.</li>
          <li>Tarjetas peruanas emitidas por BCP, BBVA, Interbank y Scotiabank.</li>
        </ul>
        <p>
          La compra es un pago único. No existe cargo recurrente ni suscripción asociada.
        </p>
        <p>
          La transacción se considera perfeccionada cuando Stripe confirma el pago exitoso y FLUX emite el
          comprobante de pago (boleta o factura electrónica).
        </p>
      </Section>

      <Section title="4. Entrega y despacho">
        <p>
          FLUX realiza despacho a domicilio <strong>dentro de Lima Metropolitana en un plazo de 24 horas hábiles</strong>
          contadas desde la confirmación del pago. El costo de envío se calcula según el distrito de destino y
          se muestra al Comprador antes de completar el pago.
        </p>
        <p>
          El Comprador también puede optar por <strong>retiro en tienda</strong> sin costo adicional en nuestra
          oficina en Av. Primavera, Surco, Lima, previa coordinación con nuestro equipo.
        </p>
        <p>
          Para envíos fuera de Lima, el plazo y costo son coordinados directamente con el Comprador. FLUX no se
          responsabiliza por retrasos imputables a la empresa transportista o a eventos de fuerza mayor.
        </p>
        <p>
          El riesgo de pérdida o daño del equipo se transfiere al Comprador en el momento de la entrega física
          del equipo al domicilio indicado o al momento del retiro en tienda.
        </p>
      </Section>

      <Section title="5. Garantía técnica — 90 días">
        <p>
          FLUX otorga una <strong>garantía técnica de 90 días calendario</strong> contados desde la fecha de
          entrega del equipo, que cubre defectos de hardware preexistentes o surgidos durante dicho período,
          incluyendo:
        </p>
        <ul>
          <li>Fallas en pantalla (píxeles muertos, retroiluminación, táctil si aplica).</li>
          <li>Fallas en batería por defecto de fabricación.</li>
          <li>Fallas en teclado, trackpad, puertos o placa madre.</li>
          <li>Fallas en altavoces, micrófono o cámara.</li>
        </ul>
        <p><strong>La garantía NO cubre:</strong></p>
        <ul>
          <li>Daños físicos causados por caída, golpe o impacto.</li>
          <li>Daños por contacto con líquidos.</li>
          <li>Daños causados por modificaciones, reparaciones o intervenciones no autorizadas por FLUX.</li>
          <li>Deterioro estético normal por uso (rayones, desgaste de teclas).</li>
          <li>Software, aplicaciones de terceros o sistema operativo.</li>
        </ul>
        <p>
          Para activar la garantía, el Comprador debe escribir a <strong>hola@fluxperu.com</strong> indicando
          su número de orden y describiendo la falla. FLUX evaluará el equipo y, de corresponder, procederá
          con la reparación o sustitución sin costo para el Comprador.
        </p>
      </Section>

      <Section title="6. Política de devolución — 7 días">
        <p>
          El Comprador tiene derecho a devolver el equipo <strong>dentro de los 7 días calendario</strong>
          siguientes a la fecha de recepción, sin necesidad de expresar motivo, y recibir el reembolso total
          del precio pagado, siempre que se cumplan las siguientes condiciones:
        </p>
        <ul>
          <li>El equipo se devuelve en el mismo estado en que fue recibido (sin daños adicionales).</li>
          <li>Se incluyen todos los accesorios y el empaque original entregado por FLUX.</li>
          <li>El Comprador coordina la devolución escribiendo a <strong>hola@fluxperu.com</strong> antes del vencimiento del plazo.</li>
        </ul>
        <p>
          El costo de envío de devolución es asumido por FLUX si la causa es un defecto no informado o un
          error en el equipo enviado. En cualquier otro caso (arrepentimiento de compra), el costo de
          devolución es asumido por el Comprador.
        </p>
        <p>
          El reembolso se procesa en un plazo de <strong>5 a 10 días hábiles</strong> a través del mismo
          método de pago utilizado en la compra, sujeto a los tiempos de procesamiento de Stripe y la
          entidad financiera del Comprador.
        </p>
        <p>
          Pasados los 7 días, no se aceptan devoluciones por arrepentimiento. Solo aplica la garantía
          técnica descrita en la cláusula 5.
        </p>
      </Section>

      <Section title="7. Comprobante de pago">
        <p>
          FLUX emite <strong>boleta electrónica</strong> por defecto para personas naturales y{" "}
          <strong>factura electrónica</strong> para personas jurídicas. El comprobante se envía al correo
          electrónico proporcionado por el Comprador en un plazo no mayor a 48 horas hábiles desde el pago.
        </p>
        <p>
          Para solicitar factura, el Comprador debe indicar RUC y razón social durante el proceso de compra
          o escribir a hola@fluxperu.com antes de que se emita el comprobante.
        </p>
      </Section>

      <Section title="8. Propiedad del equipo y restricciones">
        <p>
          La propiedad del equipo se transfiere al Comprador al momento de la entrega física, una vez
          confirmado el pago íntegro.
        </p>
        <p>
          Los equipos FLUX Certified son desbloqueados de MDM y Apple Business Manager antes de la entrega.
          El Comprador podrá usarlos con su propio Apple ID sin restricciones de gestión remota.
        </p>
      </Section>

      <Section title="9. Limitación de responsabilidad">
        <p>
          La responsabilidad de FLUX frente al Comprador se limita al precio pagado por el equipo. FLUX no
          será responsable por daños indirectos, pérdida de datos, lucro cesante ni daños consecuentes
          derivados del uso o la imposibilidad de uso del equipo.
        </p>
        <p>
          FLUX no es fabricante de los equipos Apple. La garantía ofrecida es propia de FLUX y es
          independiente de cualquier garantía del fabricante.
        </p>
      </Section>

      <Section title="10. Protección de datos personales">
        <p>
          Los datos personales del Comprador son tratados por Tika Services S.A.C. conforme a la{" "}
          <strong>Ley N° 29733 — Ley de Protección de Datos Personales</strong> y su reglamento. Son
          utilizados exclusivamente para gestionar la compraventa, emitir comprobantes de pago y brindar
          soporte postventa.
        </p>
        <p>
          Los datos no son cedidos a terceros salvo a Stripe (procesador de pagos) y a empresas de courier
          para la gestión del despacho, quienes actúan como encargados de tratamiento bajo acuerdos de
          confidencialidad.
        </p>
        <p>
          Para ejercer derechos ARCO (acceso, rectificación, cancelación u oposición), el Comprador puede
          escribir a <strong>hola@fluxperu.com</strong>.
        </p>
        <p>
          Más información en nuestra{" "}
          <Link href="/privacidad" className="text-[#1B4FFF] hover:underline">
            Política de Privacidad
          </Link>
          .
        </p>
      </Section>

      <Section title="11. Ley aplicable y jurisdicción">
        <p>
          Los presentes Términos se rigen por las leyes de la <strong>República del Perú</strong>, en
          particular por el Código Civil (D.Leg. 295), el Código de Protección y Defensa del Consumidor
          (Ley 29571) y la Ley de Protección de Datos Personales (Ley 29733).
        </p>
        <p>
          Ante cualquier controversia derivada de estos Términos, las partes se someten a los{" "}
          <strong>Juzgados y Tribunales de Lima, Perú</strong>, con renuncia expresa a cualquier otro fuero.
        </p>
        <p>
          Antes de iniciar cualquier acción judicial, el Comprador puede presentar una queja directamente a
          FLUX por correo electrónico. FLUX se compromete a responder en un plazo máximo de 5 días hábiles.
          También puede recurrir al{" "}
          <strong>INDECOPI</strong> para la defensa de sus derechos como consumidor.
        </p>
      </Section>

      <Section title="12. Modificaciones">
        <p>
          FLUX se reserva el derecho de modificar estos Términos en cualquier momento. Las modificaciones
          serán publicadas en esta página con indicación de la fecha de actualización. Las compras realizadas
          antes de la modificación se rigen por los Términos vigentes al momento de la transacción.
        </p>
      </Section>

      <Section title="13. Contacto">
        <p>
          Para consultas sobre estos Términos, garantías, devoluciones o cualquier aspecto de tu compra:
        </p>
        <ul>
          <li>Correo: <strong>hola@fluxperu.com</strong></li>
          <li>WhatsApp: <strong>+51 900 164 769</strong></li>
          <li>Dirección: Av. Primavera, Surco, Lima, Perú</li>
        </ul>
      </Section>

      {/* Footer nav */}
      <div className="mt-10 pt-6 border-t border-[#F0F0F0] flex flex-wrap gap-4 text-xs text-[#999999]">
        <Link href="/privacidad" className="hover:text-[#1B4FFF]">Política de Privacidad</Link>
        <Link href="/terminos" className="hover:text-[#1B4FFF]">Términos de Renta</Link>
        <Link href="/libro-de-reclamaciones" className="hover:text-[#1B4FFF]">Libro de Reclamaciones</Link>
        <Link href="/comprar" className="hover:text-[#1B4FFF]">FLUX Certified</Link>
      </div>
    </div>
  );
}
