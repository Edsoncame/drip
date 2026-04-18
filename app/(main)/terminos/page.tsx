import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Términos y condiciones del servicio de alquiler de MacBook de FLUX (Tika Services S.A.C.). Condiciones de renta, entrega, devolución y opción de compra.",
  robots: { index: true, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-700 text-[#18191F] mb-3">{title}</h2>
      <div className="text-sm leading-relaxed text-[#666666] space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-[#333333]">
        {children}
      </div>
    </div>
  );
}

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#1B4FFF] hover:underline">← Volver al inicio</Link>
      </div>
      <h1 className="text-3xl font-800 text-[#18191F] mb-2">Términos y Condiciones</h1>
      <p className="text-sm text-[#999999] mb-8">Última actualización: abril 2026</p>

      <div className="prose prose-gray max-w-none text-[#333333]">
        <Section title="1. Partes e identificación">
          <p>El presente contrato de arrendamiento operativo de equipos informáticos (en adelante, el &ldquo;Contrato&rdquo;) se celebra entre:</p>
          <ul>
            <li><strong>FLUX</strong>, nombre comercial de <strong>Tika Services S.A.C.</strong>, identificada con RUC N.° 20605702512, con domicilio fiscal en Lima, Perú (en adelante, &ldquo;FLUX&rdquo; o &ldquo;el Arrendador&rdquo;).</li>
            <li>El <strong>Usuario</strong>: persona natural o jurídica que acepta estos términos al completar el proceso de registro y/o contratación en fluxperu.com (en adelante, &ldquo;el Arrendatario&rdquo; o &ldquo;el Usuario&rdquo;).</li>
          </ul>
          <p>La aceptación de estos Términos y Condiciones durante el proceso de checkout constituye la manifestación de voluntad del Usuario y tiene la misma validez que una firma manuscrita, conforme a la Ley N.° 27291 y el Decreto Legislativo N.° 1412 (Ley de Gobierno Digital del Perú).</p>
        </Section>

        <Section title="2. Objeto del servicio">
          <p>FLUX pone a disposición del Usuario equipos Apple MacBook (Air y/o Pro) en modalidad de arrendamiento operativo mensual, por un plazo determinado de 8, 16 o 24 meses (en adelante, el &ldquo;Plazo&rdquo;), a cambio de una renta mensual fija pactada al momento de la contratación (en adelante, la &ldquo;Renta Mensual&rdquo;).</p>
          <p>Los equipos son de propiedad exclusiva de Tika Services S.A.C. durante toda la vigencia del Contrato y hasta la eventual ejecución de la opción de compra. El Usuario adquiere únicamente el derecho de uso del equipo conforme a los términos aquí establecidos.</p>
        </Section>

        <Section title="3. Planes, precios y moneda">
          <p>FLUX ofrece tres planes de renta según la duración:</p>
          <ul>
            <li><strong>Plan 8 meses:</strong> tarifa mensual más alta, menor compromiso.</li>
            <li><strong>Plan 16 meses:</strong> tarifa intermedia.</li>
            <li><strong>Plan 24 meses:</strong> tarifa mensual más baja.</li>
          </ul>
          <p>Los precios publicados en fluxperu.com están expresados en dólares americanos (USD). El IGV (18%) no está incluido y será adicionado cuando corresponda según la normativa tributaria vigente.</p>
          <p>Los precios pueden ser actualizados por FLUX. Cualquier cambio de precio no afectará a contratos ya vigentes y solo aplicará a nuevas contrataciones.</p>
        </Section>

        <Section title="4. Cobro y método de pago">
          <p><strong>4.1. Primer cobro:</strong> La Renta Mensual del primer mes se cobra al momento de confirmar el pedido mediante el procesador de pagos Mercado Pago. Este cobro activa el pedido.</p>
          <p><strong>4.2. Cobros recurrentes:</strong> A partir del segundo mes, el cobro se realiza automáticamente en la misma fecha calendario mediante el método de pago registrado. El Usuario autoriza expresamente este cobro recurrente al aceptar estos Términos.</p>
          <p><strong>4.3. Impago:</strong> Si un cobro automático falla, FLUX notificará al Usuario por correo electrónico. El Usuario tendrá un período de gracia de 5 (cinco) días hábiles para regularizar el pago. Transcurrido dicho plazo sin que se haya realizado el pago, FLUX podrá: (a) suspender el servicio de soporte técnico; (b) solicitar la devolución inmediata del equipo; y/o (c) reportar la deuda a las centrales de riesgo conforme a la legislación peruana.</p>
          <p><strong>4.4. No se requiere depósito de garantía.</strong> FLUX no solicita depósito, fianza ni matrícula. El primer mes de renta es el único pago al inicio.</p>
        </Section>

        <Section title="5. Entrega del equipo">
          <p><strong>5.1. Modalidades de entrega:</strong> El Usuario puede elegir entre:</p>
          <ul>
            <li><strong>Recojo en oficina:</strong> el equipo estará disponible en un plazo de 24 horas hábiles desde la confirmación del pago. FLUX comunicará la dirección y horario de recojo por correo electrónico. Horario de atención: lunes a viernes, 9:00 a.m. a 6:00 p.m.</li>
            <li><strong>Envío a domicilio:</strong> entrega gratuita en Lima Metropolitana en un plazo de 24 a 48 horas hábiles desde la confirmación del pago. El Usuario proporcionará dirección, distrito y referencia.</li>
          </ul>
          <p><strong>5.2. Cobertura:</strong> El servicio de entrega y recojo solo está disponible dentro de Lima Metropolitana. Direcciones fuera de esta zona no están cubiertas.</p>
          <p><strong>5.3. Verificación:</strong> Al recibir el equipo, el Usuario debe verificar que se encuentre en perfecto estado, con todos sus accesorios originales (cable USB-C o MagSafe, adaptador de corriente y guía de inicio rápido). Cualquier observación debe ser reportada a FLUX dentro de las 24 horas siguientes a la recepción.</p>
          <p><strong>5.4. Plazos estimados:</strong> Los plazos de entrega son estimados y no constituyen obligación firme. FLUX no será responsable por retrasos causados por fuerza mayor, caso fortuito o causas imputables al transportista o al Usuario.</p>
        </Section>

        <Section title="6. Uso del equipo">
          <p>El Usuario se compromete a:</p>
          <ul>
            <li>Usar el equipo de forma diligente y conforme a su finalidad (uso profesional o empresarial).</li>
            <li>No modificar, desensamblar, reparar por cuenta propia ni alterar el hardware o el número de serie del equipo.</li>
            <li>No ceder, subarrendar, prestar ni transferir el equipo a terceros sin autorización previa y escrita de FLUX.</li>
            <li>No sacar el equipo del territorio peruano sin autorización previa y escrita de FLUX.</li>
            <li>Mantener actualizado el sistema operativo cuando FLUX lo requiera por razones de seguridad.</li>
            <li>Aceptar la instalación de software de gestión de dispositivos (MDM) cuando FLUX lo considere necesario, especialmente para contratos empresariales.</li>
          </ul>
        </Section>

        <Section title="7. AppleCare+ (servicio opcional)">
          <p><strong>7.1.</strong> El Usuario puede contratar AppleCare+ como servicio adicional al momento de la contratación, por un costo mensual adicional indicado en el checkout.</p>
          <p><strong>7.2.</strong> AppleCare+ es un programa de Apple Inc. que extiende la cobertura de garantía a 3 años e incluye hasta 2 reparaciones por daño accidental por período de cobertura, sujeto a un deducible de USD $99 por incidente.</p>
          <p><strong>7.3.</strong> AppleCare+ cubre: daños accidentales a la pantalla, batería, carcasa y componentes internos. <strong>No cubre:</strong> pérdida, robo, daño intencional, modificaciones no autorizadas, daño cosmético que no afecte la funcionalidad, ni daños por exposición a líquidos que afecten componentes no cubiertos.</p>
          <p><strong>7.4.</strong> La contratación de AppleCare+ es por todo el período de la renta y no puede ser cancelada de forma independiente.</p>
          <p><strong>7.5.</strong> FLUX actúa como intermediario en la contratación de AppleCare+. Las reclamaciones de garantía se gestionan directamente con Apple Inc. a través de sus canales autorizados.</p>
        </Section>

        <Section title="8. Responsabilidad por daños, pérdida y robo">
          <p><strong>8.1. Sin AppleCare+:</strong> El Usuario es responsable de cualquier daño, pérdida o robo del equipo. FLUX facturará al Usuario el costo de reparación según las tarifas vigentes de Apple, o el precio de reemplazo del equipo en caso de pérdida total.</p>
          <p><strong>8.2. Con AppleCare+:</strong> Los daños accidentales cubiertos se gestionan a través de Apple con el deducible correspondiente (USD $99). Los daños no cubiertos por AppleCare+ siguen siendo responsabilidad del Usuario.</p>
          <p><strong>8.3. Robo o pérdida:</strong> En caso de robo, el Usuario debe presentar denuncia policial dentro de las 48 horas y enviar copia a FLUX. El Usuario deberá abonar el precio de reemplazo del equipo según el modelo. Ni FLUX ni AppleCare+ cubren pérdida o robo.</p>
          <p><strong>8.4. Opción de compra al finalizar el plazo:</strong> El Usuario puede adquirir el equipo al finalizar el plazo a un precio especial que se coordina al término del contrato. Este precio se documenta por escrito como adenda al contrato original.</p>
        </Section>

        <Section title="9. Opción de compra">
          <p><strong>9.1.</strong> Al finalizar el Plazo contratado, el Usuario podrá ejercer la opción de compra del equipo al valor residual correspondiente, detallado en la cláusula 8.4.</p>
          <p><strong>9.2.</strong> La opción de compra debe ejercerse por escrito (email a hola@fluxperu.com) dentro de los 30 días calendario siguientes al vencimiento del Contrato. Transcurrido dicho plazo sin ejercer la opción, el Usuario deberá devolver el equipo.</p>
          <p><strong>9.3. Compra por colaborador:</strong> En contratos empresariales, el colaborador asignado al equipo podrá adquirirlo al valor residual mediante un plan de 16 cuotas mensuales, previa autorización de la empresa contratante. FLUX gestionará este proceso directamente con el colaborador.</p>
        </Section>

        <Section title="10. Cancelación anticipada y devolución">
          <p><strong>10.1. Plazo mínimo:</strong> El Usuario se compromete a mantener el Contrato durante el Plazo mínimo elegido (8, 16 o 24 meses). No se admiten cancelaciones anticipadas durante el Plazo mínimo, salvo en los casos previstos en la cláusula 10.3.</p>
          <p><strong>10.2. Cancelación ordinaria:</strong> Una vez cumplido el Plazo mínimo, el Usuario puede cancelar el Contrato con 30 días de aviso previo por escrito enviado a hola@fluxperu.com.</p>
          <p><strong>10.3. Cancelación anticipada extraordinaria:</strong> FLUX podrá autorizar la cancelación anticipada en casos justificados (cierre de empresa, mudanza fuera de Lima, fuerza mayor). En estos casos, el Usuario deberá: (a) pagar una penalidad equivalente a 2 meses de Renta Mensual; y (b) devolver el equipo en perfecto estado de funcionamiento.</p>
          <p><strong>10.4. Devolución del equipo:</strong> La devolución se coordina con FLUX mediante las mismas modalidades de la entrega (recojo en oficina o envío). El equipo debe devolverse con todos sus accesorios originales, sin daños más allá del desgaste normal por uso, con el software restablecido a configuración de fábrica (factory reset) y sin bloqueo de activación (Buscar mi Mac desactivado).</p>
          <p><strong>10.5. Inspección:</strong> FLUX inspeccionará el equipo devuelto en un plazo de 5 días hábiles. Si se detectan daños no reportados, FLUX facturará el costo de reparación conforme a la cláusula 8.</p>
        </Section>

        <Section title="11. Propiedad intelectual y datos">
          <p><strong>11.1.</strong> El equipo es y permanece en todo momento propiedad de Tika Services S.A.C. El Contrato no transfiere propiedad alguna al Usuario salvo el ejercicio efectivo de la opción de compra.</p>
          <p><strong>11.2.</strong> FLUX no accede, almacena ni monitorea los datos personales, archivos o información del Usuario almacenados en el equipo. El Usuario es el único responsable de realizar respaldos de su información.</p>
          <p><strong>11.3.</strong> Antes de la devolución, el Usuario debe eliminar toda su información personal del equipo y realizar un factory reset. FLUX no se hace responsable de datos remanentes en equipos devueltos.</p>
        </Section>

        <Section title="12. Facturación">
          <p>FLUX emite comprobante de pago (boleta o factura) por cada cobro mensual conforme a la normativa de SUNAT. Para la emisión de factura, el Usuario debe proporcionar un RUC válido y vigente al momento de la contratación. Los cambios de datos de facturación deben solicitarse antes del siguiente cobro.</p>
        </Section>

        <Section title="13. Limitación de responsabilidad">
          <p><strong>13.1.</strong> FLUX no será responsable por daños indirectos, incidentales, especiales o consecuentes, incluyendo pero no limitado a: pérdida de datos, lucro cesante, interrupción de negocio o daño reputacional, derivados del uso o la imposibilidad de uso del equipo.</p>
          <p><strong>13.2.</strong> La responsabilidad total acumulada de FLUX bajo este Contrato no excederá el monto total de Rentas Mensuales efectivamente pagadas por el Usuario durante los últimos 12 meses.</p>
          <p><strong>13.3.</strong> FLUX no garantiza que el equipo sea adecuado para un propósito particular del Usuario. El equipo se entrega &ldquo;tal cual&rdquo; con las especificaciones técnicas publicadas por Apple Inc.</p>
        </Section>

        <Section title="14. Resolución por incumplimiento">
          <p>FLUX podrá resolver el Contrato de pleno derecho y exigir la devolución inmediata del equipo si el Usuario: (a) incurre en mora de pago por más de 30 días; (b) incumple las obligaciones de uso establecidas en la cláusula 6; (c) proporciona información falsa o fraudulenta; (d) es declarado en insolvencia o quiebra; o (e) utiliza el equipo para actividades ilícitas.</p>
        </Section>

        <Section title="15. Modificaciones">
          <p>FLUX se reserva el derecho de modificar estos Términos y Condiciones. Cualquier modificación será notificada al Usuario con un mínimo de 30 días de anticipación al correo electrónico registrado. El uso continuo del servicio después de dicho plazo implica la aceptación de los nuevos términos. Si el Usuario no está de acuerdo con las modificaciones, podrá cancelar el Contrato conforme a la cláusula 10.2.</p>
        </Section>

        <Section title="16. Legislación aplicable y resolución de controversias">
          <p><strong>16.1.</strong> Este Contrato se rige por las leyes de la República del Perú, en particular el Código Civil (Libro VII, Sección Segunda — Contratos Nominados, Título VI — Arrendamiento), la Ley N.° 29571 (Código de Protección y Defensa del Consumidor) y la Ley N.° 29733 (Ley de Protección de Datos Personales).</p>
          <p><strong>16.2.</strong> Las partes acuerdan que cualquier controversia derivada del presente Contrato será sometida, en primer lugar, a un proceso de conciliación extrajudicial conforme a la Ley N.° 26872. De no llegarse a un acuerdo, las partes se someten a la jurisdicción de los juzgados y tribunales del distrito judicial de Lima.</p>
        </Section>

        <Section title="17. Disposiciones finales">
          <p><strong>17.1.</strong> Si alguna cláusula de estos Términos fuera declarada nula o inaplicable, las restantes cláusulas mantendrán su plena vigencia y efecto.</p>
          <p><strong>17.2.</strong> La falta de ejercicio por parte de FLUX de cualquier derecho establecido en este Contrato no constituye renuncia al mismo.</p>
          <p><strong>17.3.</strong> Este Contrato, junto con la Política de Privacidad y cualquier anexo o adenda, constituye el acuerdo completo entre las partes y reemplaza cualquier acuerdo previo, verbal o escrito.</p>
        </Section>

        <Section title="18. Contacto">
          <p>Para consultas, reclamos o el ejercicio de cualquier derecho bajo este Contrato:</p>
          <ul>
            <li><strong>Correo electrónico:</strong> hola@fluxperu.com</li>
            <li><strong>Sitio web:</strong> fluxperu.com</li>
            <li><strong>Razón social:</strong> Tika Services S.A.C.</li>
            <li><strong>RUC:</strong> 20605702512</li>
          </ul>
        </Section>
      </div>

      <div className="mt-10 pt-6 border-t border-[#E5E5E5] flex gap-4 text-sm">
        <Link href="/privacidad" className="text-[#1B4FFF] hover:underline">Política de privacidad</Link>
        <Link href="/contacto" className="text-[#1B4FFF] hover:underline">Contacto</Link>
      </div>
    </div>
  );
}
