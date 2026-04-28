/**
 * Términos y Condiciones FLUX v2 — máxima protección legal del Arrendador.
 *
 * Cláusulas críticas integradas (vs v1):
 *  - Pagaré incompleto autorizado al inicio (Ley 27287, ejecutivo art. 688 CPC)
 *  - Garantía solidaria del representante legal en B2B
 *  - Consentimiento PDP-21 expreso para INFOCORP / Equifax / Sentinel
 *  - Bloqueo remoto + MDM + Apple Business Manager autorizados expresamente
 *  - Cláusula resolutoria expresa Art. 1430 CC (sin necesidad sentencia)
 *  - Apropiación ilícita Art. 190 CP en caso de no-devolución
 *  - Cláusula penal por no-devolución (1× valor + 0.5% diario)
 *  - Domicilio contractual fijo con presunción de notificación
 *  - Cesión libre del crédito a empresas de cobranza
 *  - Costos y costas + honorarios de abogados a cargo del Usuario
 *  - Información falsa: nulidad + indemnización USD 2,000 + acción penal
 *  - Arbitraje CCL para contratos B2B >USD 5,000
 *
 * IMPORTANTE: este documento fue redactado SIN revisión de abogado
 * peruano (ver memoria del proyecto). Antes de cualquier disputa
 * relevante, contratar revisión legal especializada.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Términos y condiciones del contrato de arrendamiento operativo de equipos Apple MacBook con FLUX (Tika Services S.A.C.). Renta, garantías, devolución, opción de compra, mora y resolución.",
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
        <Link href="/" className="text-sm text-[#1B4FFF] hover:underline">
          ← Volver al inicio
        </Link>
      </div>
      <h1 className="text-3xl font-800 text-[#18191F] mb-2">Términos y Condiciones</h1>
      <p className="text-sm text-[#999999] mb-8">Última actualización: 28 de abril de 2026</p>

      <div className="prose prose-gray max-w-none text-[#333333]">
        <Section title="1. Partes e identificación">
          <p>
            El presente contrato de arrendamiento operativo de equipos informáticos (en adelante, el
            &ldquo;Contrato&rdquo;) se celebra entre:
          </p>
          <ul>
            <li>
              <strong>FLUX</strong>, nombre comercial de <strong>Tika Services S.A.C.</strong>,
              identificada con RUC N.° 20605702512, con domicilio fiscal en Lima, Perú (en adelante,
              &ldquo;FLUX&rdquo; o &ldquo;el Arrendador&rdquo;).
            </li>
            <li>
              El <strong>Usuario</strong>: persona natural o jurídica que acepta estos Términos al
              completar el proceso de registro y/o contratación en fluxperu.com (en adelante, &ldquo;el
              Arrendatario&rdquo; o &ldquo;el Usuario&rdquo;).
            </li>
          </ul>
          <p>
            Cuando el Usuario sea persona jurídica, además interviene como{" "}
            <strong>Garante Solidario</strong> el representante legal y/o accionista mayoritario que
            firme la contratación, conforme a la cláusula 7 del presente Contrato.
          </p>
        </Section>

        <Section title="2. Aceptación del contrato y valor jurídico">
          <p>
            <strong>2.1.</strong> La aceptación de estos Términos durante el proceso de checkout, mediante
            la marcación expresa de la casilla &ldquo;Acepto los Términos y Condiciones&rdquo; y la
            confirmación del pago, constituye manifestación libre, expresa, informada e inequívoca del
            consentimiento del Usuario.
          </p>
          <p>
            <strong>2.2.</strong> Conforme a la <strong>Ley N.° 27291</strong> (Ley que modifica el Código
            Civil permitiendo la utilización de medios electrónicos para la manifestación de la voluntad)
            y al <strong>Decreto Legislativo N.° 1412</strong> (Ley de Gobierno Digital), la aceptación
            digital tiene la misma validez jurídica que una firma manuscrita.
          </p>
          <p>
            <strong>2.3.</strong> El Usuario declara haber leído íntegramente estos Términos, comprenderlos
            y aceptarlos voluntariamente. Reconoce expresamente que estas condiciones forman parte
            inseparable del Contrato y son vinculantes desde su aceptación.
          </p>
        </Section>

        <Section title="3. Objeto del servicio">
          <p>
            FLUX pone a disposición del Usuario equipos Apple MacBook (Air y/o Pro) en modalidad de
            arrendamiento operativo mensual, por un plazo determinado de 8, 16 o 24 meses (en adelante,
            el &ldquo;Plazo&rdquo;), a cambio de una renta mensual fija pactada al momento de la
            contratación (en adelante, la &ldquo;Renta Mensual&rdquo;).
          </p>
          <p>
            Los equipos son de <strong>propiedad exclusiva e indivisible</strong> de Tika Services S.A.C.
            durante toda la vigencia del Contrato y hasta la eventual ejecución de la opción de compra.
            El Usuario adquiere únicamente el derecho de uso del equipo (jus utendi y fruendi) conforme a
            los términos aquí establecidos. El Contrato no transfiere propiedad alguna salvo el ejercicio
            efectivo y pagado de la opción de compra.
          </p>
        </Section>

        <Section title="4. Planes, precios y moneda">
          <p>FLUX ofrece tres planes de renta según la duración:</p>
          <ul>
            <li>
              <strong>Plan 8 meses:</strong> tarifa mensual más alta, menor compromiso de plazo.
            </li>
            <li>
              <strong>Plan 16 meses:</strong> tarifa intermedia.
            </li>
            <li>
              <strong>Plan 24 meses:</strong> tarifa mensual más baja.
            </li>
          </ul>
          <p>
            Los precios publicados en fluxperu.com están expresados en dólares americanos (USD). El IGV
            (18%) no está incluido y será adicionado cuando corresponda según la normativa tributaria
            vigente. El tipo de cambio aplicable, en caso de pago en soles, será el tipo de cambio venta
            publicado por la SBS al día del cobro.
          </p>
          <p>
            Los precios pueden ser actualizados por FLUX. Cualquier cambio de precio no afectará a
            contratos ya vigentes y solo aplicará a nuevas contrataciones.
          </p>
        </Section>

        <Section title="5. Cobro y método de pago">
          <p>
            <strong>5.1. Primer cobro:</strong> La Renta Mensual del primer mes se cobra al momento de
            confirmar el pedido mediante los procesadores de pago habilitados (Stripe, Mercado Pago u
            otros). Este cobro activa el pedido.
          </p>
          <p>
            <strong>5.2. Cobros recurrentes:</strong> A partir del segundo mes, el cobro se realiza
            automáticamente en la misma fecha calendario mediante el método de pago registrado. El
            Usuario autoriza expresa, irrevocable y por anticipado este cobro recurrente al aceptar
            estos Términos. Esta autorización subsiste durante toda la vigencia del Contrato y se
            extiende a cualquier modificación o renovación del medio de pago.
          </p>
          <p>
            <strong>5.3. Reintento de cobro:</strong> Si un cobro automático falla, FLUX podrá reintentar
            el cobro en los días siguientes con el mismo medio de pago o con cualquier otro medio que el
            Usuario haya registrado.
          </p>
          <p>
            <strong>5.4. Sin depósito ni fianza:</strong> FLUX no solicita depósito de garantía, fianza ni
            matrícula. La protección de FLUX descansa en las garantías establecidas en la cláusula 7
            (pagaré incompleto y garantía solidaria) y en las cláusulas penales del presente Contrato.
          </p>
        </Section>

        <Section title="6. Mora, intereses moratorios y cláusula penal compensatoria">
          <p>
            <strong>6.1. Mora automática:</strong> Conforme al{" "}
            <strong>Artículo 1333 del Código Civil</strong>, el solo vencimiento del plazo de pago
            constituye al Usuario en mora, sin necesidad de intimación judicial o extrajudicial previa.
            La fecha de vencimiento es el día calendario del cobro recurrente pactado.
          </p>
          <p>
            <strong>6.2. Período de gracia:</strong> Sin perjuicio de la mora automática, FLUX otorga un
            período de gracia de 5 (cinco) días calendario contados desde el primer fallo de cobro, sin
            generación de intereses moratorios. Vencido el período de gracia se aplican los intereses y
            penalidades de las cláusulas 6.3 y 6.4.
          </p>
          <p>
            <strong>6.3. Intereses moratorios:</strong> A partir del sexto día calendario de mora, las
            obligaciones impagas devengarán intereses moratorios a la <strong>tasa máxima legal</strong>{" "}
            permitida por el Banco Central de Reserva del Perú (TIPMN para operaciones en moneda
            nacional o TIPMEX para operaciones en moneda extranjera, según corresponda al Contrato),
            calculados sobre saldo deudor desde el día siguiente al vencimiento hasta la fecha efectiva
            de pago.
          </p>
          <p>
            <strong>6.4. Cláusula penal compensatoria:</strong> Adicionalmente a los intereses
            moratorios, el Usuario se obliga a pagar una penalidad equivalente al{" "}
            <strong>10% de la Renta Mensual impaga por cada cobro fallido</strong>, en concepto de
            compensación por daños administrativos, costos de gestión de cobranza preventiva y
            comunicaciones. Esta penalidad es acumulable con los intereses moratorios.
          </p>
          <p>
            <strong>6.5. Imputación de pagos:</strong> Conforme al{" "}
            <strong>Artículo 1257 del Código Civil</strong>, los pagos parciales se imputarán primero a
            penalidades, luego a intereses moratorios y finalmente al capital adeudado.
          </p>
        </Section>

        <Section title="7. Garantías de cumplimiento (pagaré incompleto y garantía solidaria)">
          <p>
            <strong>7.1. Pagaré incompleto.</strong> Al recibir el equipo, y como condición resolutoria de
            la entrega efectiva, el Usuario suscribirá un{" "}
            <strong>pagaré incompleto</strong> a favor de Tika Services S.A.C., conforme a los{" "}
            <strong>Artículos 10 y 158 de la Ley N.° 27287 (Ley de Títulos Valores)</strong>. El Usuario
            autoriza expresa e irrevocablemente a FLUX a completar el pagaré con los siguientes datos en
            caso de incumplimiento:
          </p>
          <ul>
            <li>
              <strong>Importe:</strong> total de Rentas Mensuales adeudadas + intereses moratorios +
              penalidades + valor comercial del equipo (si no se devuelve) + costos de cobranza.
            </li>
            <li>
              <strong>Fecha de emisión:</strong> el día siguiente al vencimiento del período de mora
              previsto en la cláusula 19.
            </li>
            <li>
              <strong>Fecha de vencimiento:</strong> a la vista (pagadero al momento de su presentación
              al cobro).
            </li>
          </ul>
          <p>
            El pagaré así completado constituye <strong>título ejecutivo</strong> y permite a FLUX
            iniciar proceso ejecutivo de cobro conforme al{" "}
            <strong>Artículo 688 del Código Procesal Civil</strong>, sin perjuicio de las demás acciones
            legales que correspondan.
          </p>
          <p>
            <strong>7.2. Pagaré digital.</strong> Cuando lo autorice la legislación vigente y previo
            acuerdo entre las partes, el pagaré podrá emitirse en formato digital mediante firma
            electrónica avanzada conforme al{" "}
            <strong>Decreto Legislativo N.° 1310 y la Ley N.° 27269</strong> (Ley de Firmas y
            Certificados Digitales).
          </p>
          <p>
            <strong>7.3. Garantía solidaria del representante legal (contratos B2B).</strong> Cuando el
            Usuario sea persona jurídica, su representante legal y/o accionista mayoritario que firme la
            contratación se constituye en <strong>garante solidario, indivisible e ilimitado</strong> del
            cumplimiento de todas las obligaciones del presente Contrato, incluyendo el pago de Rentas
            Mensuales, intereses, penalidades, costos de cobranza y la devolución del equipo en el
            estado pactado. Esta garantía solidaria subsiste con plenos efectos hasta el íntegro
            cumplimiento del Contrato y la devolución y/o pago efectivo del equipo.
          </p>
          <p>
            <strong>7.4. Renuncia a beneficios.</strong> El Garante Solidario renuncia expresamente a los
            beneficios de excusión, división y orden previstos en los{" "}
            <strong>Artículos 1879, 1881 y 1887 del Código Civil</strong>. FLUX podrá demandar al
            Garante Solidario directa y personalmente, incluso antes de agotar la cobranza contra el
            Usuario, sin necesidad de previa intimación.
          </p>
          <p>
            <strong>7.5. Subsidiaridad.</strong> La inexistencia, nulidad o inexigibilidad de cualquiera
            de las garantías de esta cláusula no afecta la validez ni la exigibilidad de las demás.
          </p>
        </Section>

        <Section title="8. Entrega del equipo">
          <p>
            <strong>8.1. Modalidades de entrega:</strong> El Usuario puede elegir entre:
          </p>
          <ul>
            <li>
              <strong>Recojo en oficina:</strong> el equipo estará disponible en un plazo de 24 horas
              hábiles desde la confirmación del pago. FLUX comunicará la dirección y horario de recojo
              por correo electrónico. Horario de atención: lunes a viernes, 9:00 a.m. a 6:00 p.m.
            </li>
            <li>
              <strong>Envío a domicilio:</strong> entrega gratuita en Lima Metropolitana en un plazo de
              24 a 48 horas hábiles desde la confirmación del pago. El Usuario proporcionará dirección,
              distrito y referencia.
            </li>
          </ul>
          <p>
            <strong>8.2. Cobertura:</strong> El servicio de entrega y recojo solo está disponible dentro
            de Lima Metropolitana. Direcciones fuera de esta zona no están cubiertas.
          </p>
          <p>
            <strong>8.3. Verificación al recibir:</strong> Al recibir el equipo, el Usuario debe verificar
            que se encuentre en perfecto estado, con todos sus accesorios originales (cable USB-C o
            MagSafe, adaptador de corriente y guía de inicio rápido). Cualquier observación debe ser
            reportada a FLUX dentro de las 24 horas siguientes a la recepción. Vencido dicho plazo, se
            entiende que el equipo fue recibido en perfecto estado.
          </p>
          <p>
            <strong>8.4. Acta de entrega:</strong> La entrega se documenta mediante acta firmada por el
            Usuario o quien lo represente. La firma del acta + suscripción del pagaré (cl. 7.1) +
            verificación del equipo constituyen condiciones simultáneas e indivisibles para la entrega
            efectiva.
          </p>
          <p>
            <strong>8.5. Plazos estimados:</strong> Los plazos de entrega son estimados y no constituyen
            obligación firme. FLUX no será responsable por retrasos causados por fuerza mayor, caso
            fortuito o causas imputables al transportista o al Usuario.
          </p>
        </Section>

        <Section title="9. Uso del equipo">
          <p>El Usuario se compromete a:</p>
          <ul>
            <li>
              Usar el equipo de forma diligente y conforme a su finalidad (uso profesional o
              empresarial).
            </li>
            <li>
              No modificar, desensamblar, reparar por cuenta propia ni alterar el hardware o el número
              de serie del equipo.
            </li>
            <li>
              No ceder, subarrendar, prestar, dar en garantía ni transferir el equipo a terceros sin
              autorización previa y escrita de FLUX.
            </li>
            <li>
              No sacar el equipo del territorio peruano sin autorización previa y escrita de FLUX.
            </li>
            <li>
              Mantener actualizado el sistema operativo cuando FLUX lo requiera por razones de
              seguridad.
            </li>
            <li>
              Conservar y respaldar la batería original, cargador y demás accesorios entregados.
            </li>
            <li>
              Comunicar a FLUX, en un plazo máximo de 48 horas, cualquier cambio de domicilio, número
              telefónico, correo electrónico o representante legal.
            </li>
          </ul>
        </Section>

        <Section title="10. Activación remota, MDM y Apple Business Manager">
          <p>
            <strong>10.1. Autorización expresa de gestión remota.</strong> El Usuario autoriza expresa e
            irrevocablemente a FLUX a:
          </p>
          <ul>
            <li>
              Inscribir el equipo en el programa <strong>Apple Business Manager (ABM)</strong> y/o en una
              solución de Mobile Device Management (MDM) administrada por FLUX.
            </li>
            <li>
              Mantener activada la función <strong>Find My Mac</strong> (Buscar mi Mac) y/o{" "}
              <strong>Activation Lock</strong> con el Apple ID corporativo de FLUX.
            </li>
            <li>
              Aplicar políticas de seguridad: cifrado FileVault, contraseña de firmware, restricciones
              de instalación de software cuando aplique al perfil del Usuario.
            </li>
          </ul>
          <p>
            <strong>10.2. Bloqueo y borrado remoto en caso de incumplimiento.</strong> El Usuario autoriza
            expresa e irrevocablemente a FLUX a ejecutar las siguientes acciones remotas en cualquiera
            de los siguientes supuestos: (i) mora superior a 30 días calendario; (ii) no devolución del
            equipo vencido el Plazo o resuelto el Contrato; (iii) reporte de robo o pérdida; (iv) uso del
            equipo para actividades ilícitas:
          </p>
          <ul>
            <li>Bloqueo remoto del equipo (lock).</li>
            <li>
              Borrado remoto de la información del equipo y restablecimiento a configuración de fábrica
              (remote wipe).
            </li>
            <li>
              Activación de mensaje en pantalla con instrucciones de devolución y datos de contacto de
              FLUX.
            </li>
            <li>Geolocalización del equipo y recuperación física por canales legales.</li>
          </ul>
          <p>
            <strong>10.3. Indemnidad por gestión remota.</strong> El Usuario reconoce que la activación
            de las medidas de la cláusula 10.2 es una facultad legítima de FLUX como propietario del
            equipo y como medida proporcional para proteger su propiedad. El Usuario libera a FLUX de
            cualquier responsabilidad por pérdida de información, lucro cesante o cualquier daño derivado
            de la ejecución de estas medidas, siendo su única responsabilidad mantener respaldos
            actualizados de su información personal.
          </p>
          <p>
            <strong>10.4. Restitución del control.</strong> Una vez regularizada la mora o devuelto el
            equipo, FLUX restituirá el control normal del equipo o, en caso de devolución, lo procesará
            según la cláusula 14.5.
          </p>
        </Section>

        <Section title="11. AppleCare+ (servicio opcional)">
          <p>
            <strong>11.1.</strong> El Usuario puede contratar AppleCare+ como servicio adicional al
            momento de la contratación, por un costo mensual adicional indicado en el checkout.
          </p>
          <p>
            <strong>11.2.</strong> AppleCare+ es un programa de Apple Inc. que extiende la cobertura de
            garantía a 3 años e incluye hasta 2 reparaciones por daño accidental por período de
            cobertura, sujeto a un deducible de USD $99 por incidente.
          </p>
          <p>
            <strong>11.3. Cobertura.</strong> AppleCare+ cubre: daños accidentales a la pantalla,
            batería, carcasa y componentes internos. <strong>No cubre:</strong> pérdida, robo, daño
            intencional, modificaciones no autorizadas, daño cosmético que no afecte la funcionalidad,
            ni daños por exposición a líquidos que afecten componentes no cubiertos.
          </p>
          <p>
            <strong>11.4.</strong> La contratación de AppleCare+ es por todo el período de la renta y no
            puede ser cancelada de forma independiente del Contrato principal.
          </p>
          <p>
            <strong>11.5.</strong> FLUX actúa como intermediario en la contratación de AppleCare+. Las
            reclamaciones de garantía se gestionan directamente con Apple Inc. a través de sus canales
            autorizados.
          </p>
        </Section>

        <Section title="12. Responsabilidad por daños, pérdida y robo">
          <p>
            <strong>12.1. Sin AppleCare+:</strong> El Usuario es responsable de cualquier daño, pérdida o
            robo del equipo, sin importar la causa (salvo culpa grave demostrada de FLUX). FLUX
            facturará al Usuario el costo de reparación según las tarifas vigentes de Apple Service o el
            valor comercial de reemplazo del equipo en caso de pérdida total, robo o destrucción
            irreparable.
          </p>
          <p>
            <strong>12.2. Con AppleCare+:</strong> Los daños accidentales cubiertos se gestionan a través
            de Apple con el deducible correspondiente (USD $99). Los daños no cubiertos por AppleCare+
            siguen siendo responsabilidad íntegra del Usuario.
          </p>
          <p>
            <strong>12.3. Robo o pérdida.</strong> En caso de robo, el Usuario debe presentar denuncia
            policial dentro de las 48 horas siguientes al hecho y enviar copia digitalizada a
            hola@fluxperu.com. El Usuario deberá abonar a FLUX el valor comercial de reemplazo del
            equipo según el modelo, en un plazo máximo de 15 días calendario desde la fecha del hecho.
            <strong>Ni FLUX ni AppleCare+ cubren pérdida o robo</strong>: la denuncia policial es
            requisito formal pero no exime al Usuario de la responsabilidad económica.
          </p>
          <p>
            <strong>12.4. Cobranza del valor de reemplazo.</strong> El valor de reemplazo es exigible
            inmediatamente y, en caso de impago, se incorpora al pagaré incompleto de la cláusula 7.1
            como obligación adicional, sin perjuicio de las acciones penales por apropiación ilícita
            (cláusula 18) si correspondiera.
          </p>
        </Section>

        <Section title="13. Opción de compra y valor residual">
          <p>
            <strong>13.1.</strong> Al finalizar el Plazo contratado, el Usuario podrá ejercer una opción
            de compra del equipo al <strong>valor residual</strong> determinado conforme a la cláusula
            13.2.
          </p>
          <p>
            <strong>13.2. Valor residual.</strong> El valor residual será calculado sobre el precio de
            lista de Apple vigente al momento de la contratación original, según los siguientes
            porcentajes referenciales:
          </p>
          <ul>
            <li>
              <strong>Plan 8 meses:</strong> entre 60% y 75% del precio de lista original.
            </li>
            <li>
              <strong>Plan 16 meses:</strong> entre 35% y 50% del precio de lista original.
            </li>
            <li>
              <strong>Plan 24 meses:</strong> entre 15% y 30% del precio de lista original.
            </li>
          </ul>
          <p>
            El porcentaje exacto dentro del rango lo determinará FLUX considerando: estado general del
            equipo, ciclos de carga de la batería, daños cosméticos no reportados, modelo y antigüedad.
            FLUX comunicará el valor residual final al Usuario con 30 días calendario de anticipación al
            vencimiento del Plazo.
          </p>
          <p>
            <strong>13.3. Plazo para ejercer la opción.</strong> La opción de compra debe ejercerse por
            escrito (correo a hola@fluxperu.com) dentro de los 30 días calendario siguientes al
            vencimiento del Contrato. Transcurrido dicho plazo sin ejercer la opción, el Usuario deberá
            devolver el equipo conforme a la cláusula 14.
          </p>
          <p>
            <strong>13.4. Pago de la opción.</strong> El pago del valor residual debe efectuarse en una
            sola armada al momento del ejercicio de la opción, mediante transferencia bancaria, tarjeta
            de crédito o débito. Pagado el valor residual y emitida la boleta o factura
            correspondiente, FLUX transfiere la propiedad del equipo al Usuario y desinscribe el equipo
            del MDM/ABM.
          </p>
          <p>
            <strong>13.5. Compra por colaborador (B2B).</strong> En contratos empresariales, el
            colaborador asignado al equipo podrá adquirirlo al valor residual mediante un plan de hasta
            16 cuotas mensuales, previa autorización escrita de la empresa contratante. Mientras dure
            el plan, el equipo permanece bajo MDM/ABM de FLUX y solo se libera con el pago de la última
            cuota.
          </p>
        </Section>

        <Section title="14. Cancelación anticipada y devolución">
          <p>
            <strong>14.1. Plazo mínimo.</strong> El Usuario se compromete a mantener el Contrato durante
            el Plazo mínimo elegido (8, 16 o 24 meses). No se admiten cancelaciones anticipadas durante
            el Plazo mínimo, salvo en los casos previstos en la cláusula 14.3.
          </p>
          <p>
            <strong>14.2. Cancelación ordinaria.</strong> Una vez cumplido el Plazo mínimo, el Usuario
            puede cancelar el Contrato con 30 días calendario de aviso previo, por escrito enviado a
            hola@fluxperu.com.
          </p>
          <p>
            <strong>14.3. Cancelación anticipada extraordinaria.</strong> FLUX podrá autorizar la
            cancelación anticipada en casos justificados (cierre de empresa documentado, mudanza fuera
            de Lima, fuerza mayor probada). En estos casos, el Usuario deberá: (a) pagar una penalidad
            equivalente a 2 (dos) Rentas Mensuales; (b) abonar el valor proporcional de cualquier
            promoción o descuento aprovechado; y (c) devolver el equipo en perfecto estado de
            funcionamiento.
          </p>
          <p>
            <strong>14.4. Devolución del equipo.</strong> La devolución se coordina con FLUX mediante las
            mismas modalidades de la entrega (recojo en oficina o envío). El equipo debe devolverse:
          </p>
          <ul>
            <li>Con todos sus accesorios originales (cable, adaptador, caja si aplica).</li>
            <li>Sin daños más allá del desgaste normal por uso responsable.</li>
            <li>
              Con el software restablecido a configuración de fábrica (factory reset) y la sesión de
              iCloud cerrada.
            </li>
            <li>
              Sin bloqueo de activación personal del Usuario (Buscar mi Mac/Activation Lock con su
              Apple ID desactivado).
            </li>
          </ul>
          <p>
            <strong>14.5. Inspección de la devolución.</strong> FLUX inspeccionará el equipo devuelto en
            un plazo de 5 días hábiles. Si se detectan daños no reportados, accesorios faltantes o
            bloqueos de activación personales, FLUX facturará al Usuario el costo de reparación,
            reemplazo o desbloqueo conforme a la cláusula 12, deduciéndolo de cualquier saldo a favor o
            facturándolo de manera independiente. Esta facturación se incorpora al pagaré incompleto si
            no es pagada en 15 días calendario.
          </p>
          <p>
            <strong>14.6. Cláusula penal por no devolución.</strong> Si el Usuario, vencido el Plazo o
            resuelto el Contrato, no devolviera el equipo en el plazo de{" "}
            <strong>10 días calendario</strong> desde la intimación notarial:
          </p>
          <ul>
            <li>
              Pagará a FLUX, por concepto de cláusula penal,{" "}
              <strong>el valor comercial de reemplazo del equipo</strong> al momento de la intimación
              (equivalente al 100% del precio de lista del modelo en su versión vigente o más cercana).
            </li>
            <li>
              Adicionalmente, pagará una penalidad diaria equivalente al{" "}
              <strong>0.5% del valor comercial</strong> por cada día de retraso desde el día 11 hasta
              la devolución efectiva o pago íntegro del valor.
            </li>
            <li>
              Estas penalidades se acumulan con los intereses moratorios de las Rentas Mensuales
              impagas y se incorporan al pagaré incompleto.
            </li>
            <li>
              Lo anterior se entiende sin perjuicio de las acciones penales por{" "}
              <strong>apropiación ilícita</strong> conforme al Artículo 190 del Código Penal (cláusula
              18).
            </li>
          </ul>
        </Section>

        <Section title="15. Resolución del Contrato (cláusula resolutoria expresa)">
          <p>
            <strong>15.1. Cláusula resolutoria expresa.</strong> Conforme al{" "}
            <strong>Artículo 1430 del Código Civil</strong>, el presente Contrato se resolverá{" "}
            <strong>de pleno derecho</strong>, sin necesidad de declaración judicial ni intimación
            adicional, si el Usuario incurre en cualquiera de las siguientes causales:
          </p>
          <ul>
            <li>
              Mora superior a 30 (treinta) días calendario en el pago de cualquier Renta Mensual o
              cantidad debida bajo este Contrato.
            </li>
            <li>Incumplimiento de las obligaciones de uso establecidas en la cláusula 9.</li>
            <li>
              Información falsa, alterada o fraudulenta proporcionada al momento de la contratación o
              durante la vigencia del Contrato.
            </li>
            <li>Insolvencia, quiebra, concurso preventivo o liquidación del Usuario.</li>
            <li>Uso del equipo para actividades ilícitas o contrarias al orden público.</li>
            <li>Subarrendamiento, cesión o transferencia no autorizada del equipo.</li>
            <li>
              Imposibilidad de localizar al Usuario o devolución de comunicaciones por cambio no
              comunicado de domicilio.
            </li>
          </ul>
          <p>
            <strong>15.2. Efectos de la resolución.</strong> Producida la resolución de pleno derecho,
            FLUX comunicará al Usuario, por correo electrónico al domicilio contractual (cl. 22), la
            constatación de la causal. Desde dicha comunicación:
          </p>
          <ul>
            <li>El Usuario debe devolver el equipo en un plazo máximo de 5 días calendario.</li>
            <li>
              Se hacen exigibles inmediatamente todas las Rentas Mensuales devengadas hasta la fecha,
              más penalidades, intereses y la cláusula penal del valor comercial del equipo.
            </li>
            <li>
              FLUX queda facultado a ejecutar las medidas remotas de la cláusula 10.2 (bloqueo, wipe,
              localización).
            </li>
            <li>FLUX queda facultado a completar y ejecutar el pagaré conforme a la cláusula 7.1.</li>
            <li>FLUX queda facultado a reportar a centrales de riesgo conforme a la cláusula 19.</li>
          </ul>
        </Section>

        <Section title="16. Resolución por cualquier de las partes">
          <p>
            FLUX podrá adicionalmente resolver el Contrato unilateralmente, mediante comunicación
            escrita con 30 días de anticipación, por razones operativas, regulatorias o de discontinuación
            del servicio. En tal caso, las Rentas Mensuales pagadas no son reembolsables proporcionalmente
            salvo cuando el cierre fuera por causa exclusiva e imputable a FLUX, en cuyo caso se
            reembolsará la fracción no consumida del último mes.
          </p>
        </Section>

        <Section title="17. Información falsa o fraudulenta">
          <p>
            <strong>17.1.</strong> El Usuario declara, bajo responsabilidad civil y penal, que toda la
            información proporcionada en el proceso de contratación (identidad, RUC, DNI, dirección,
            datos financieros, situación laboral, datos del representante legal en B2B) es{" "}
            <strong>verdadera, completa y actual</strong>.
          </p>
          <p>
            <strong>17.2. Consecuencias de información falsa.</strong> La verificación posterior por
            parte de FLUX de información falsa, alterada o suplantada produce simultáneamente:
          </p>
          <ul>
            <li>Resolución automática del Contrato conforme a la cláusula 15.1.</li>
            <li>
              Obligación del Usuario de devolver el equipo en un plazo máximo de{" "}
              <strong>24 horas</strong> desde la intimación.
            </li>
            <li>
              Pago de una <strong>indemnización mínima de USD 2,000</strong> (dos mil dólares
              americanos) en concepto de daños y perjuicios líquidos, sin perjuicio de daños mayores
              demostrables.
            </li>
            <li>
              Acción penal por <strong>falsedad ideológica (Art. 428 CP)</strong>,{" "}
              <strong>estafa (Art. 196 CP)</strong> y/o <strong>uso de documento falso (Art. 427 CP)</strong>{" "}
              ante el Ministerio Público.
            </li>
            <li>Reporte calificado a centrales de riesgo conforme a la cláusula 19.</li>
          </ul>
        </Section>

        <Section title="18. Apropiación ilícita y acciones penales">
          <p>
            <strong>18.1. Apropiación ilícita.</strong> El Usuario declara expresamente conocer que el
            equipo es de propiedad exclusiva de Tika Services S.A.C. y que, vencido el Plazo o resuelto
            el Contrato, la retención del equipo más allá del plazo de devolución, sin pago del valor
            residual o devolución efectiva, configura el delito de{" "}
            <strong>Apropiación Ilícita previsto en el Artículo 190 del Código Penal Peruano</strong>,
            sancionado con pena privativa de libertad no menor de 2 ni mayor de 4 años.
          </p>
          <p>
            <strong>18.2. Hurto agravado.</strong> Si el Usuario dispone del equipo (lo vende,
            transfiere, da en garantía o destruye) sin autorización de FLUX, podrá configurarse
            adicionalmente el delito de <strong>Hurto Agravado (Art. 186 CP)</strong>, sancionado con
            pena privativa de libertad no menor de 3 ni mayor de 6 años.
          </p>
          <p>
            <strong>18.3. Inicio de acción penal.</strong> Vencido el plazo de 10 días calendario de la
            intimación notarial sin devolución efectiva, FLUX queda facultado a iniciar denuncia penal
            ante el Ministerio Público, sin perjuicio de las acciones civiles paralelas y de la
            ejecución del pagaré.
          </p>
          <p>
            <strong>18.4. Reserva de denuncia.</strong> La denuncia penal será desistida o no continuada
            si el Usuario devuelve el equipo y paga la totalidad de las obligaciones pendientes
            (rentas, intereses, penalidades, costos) antes de la formalización de la investigación.
          </p>
        </Section>

        <Section title="19. Centrales de riesgo y consentimiento de tratamiento (Ley 29733)">
          <p>
            <strong>19.1. Consentimiento expreso e informado.</strong> Conforme a los{" "}
            <strong>Artículos 13, 14 y 18 de la Ley N.° 29733</strong> (Ley de Protección de Datos
            Personales) y su Reglamento (D.S. 003-2013-JUS), el Usuario otorga su consentimiento{" "}
            <strong>libre, expreso, inequívoco e informado</strong> para el tratamiento de sus datos
            personales con la finalidad específica de:
          </p>
          <ul>
            <li>
              <strong>Reportar a las centrales privadas de información de riesgos</strong> autorizadas
              por la Superintendencia de Banca, Seguros y AFP, incluyendo de manera enunciativa y no
              limitativa: <strong>Equifax Perú (INFOCORP)</strong>, <strong>Sentinel Perú</strong>,{" "}
              <strong>Experian Perú</strong>,{" "}
              <strong>Xchange Perú (Cámara de Comercio de Lima)</strong> y cualquier otra central
              vigente al momento del reporte.
            </li>
            <li>
              <strong>Información que se reporta:</strong> identidad del Usuario, monto adeudado, días
              de mora, tipo de deuda (renta de equipo, indemnización, valor de reemplazo,
              penalidades), estado de la deuda y, cuando aplique,{" "}
              <strong>la condición de no devolución del equipo</strong>.
            </li>
            <li>
              <strong>Plazo del reporte:</strong> hasta 5 (cinco) años contados desde la cancelación
              íntegra de la deuda, conforme al Reglamento del Sistema de Información de Riesgos.
            </li>
          </ul>
          <p>
            <strong>19.2. Inicio del reporte.</strong> FLUX podrá iniciar el reporte a centrales de
            riesgo a partir del <strong>día 31 de mora</strong>, previa comunicación al Usuario por
            correo electrónico con al menos 48 horas de anticipación al envío del reporte.
          </p>
          <p>
            <strong>19.3. Derechos ARCO.</strong> El Usuario podrá ejercer en todo momento sus derechos
            de acceso, rectificación, cancelación y oposición (ARCO) sobre sus datos personales en
            poder de FLUX, escribiendo a hola@fluxperu.com. La rectificación de datos no extingue por
            sí misma la obligación de pago.
          </p>
          <p>
            <strong>19.4. Cesión de datos a terceros para cobranza.</strong> El Usuario consiente que
            FLUX comparta sus datos personales con: (i) empresas de cobranza extrajudicial y judicial;
            (ii) estudios de abogados encargados de la cobranza; (iii) bancos para gestiones de
            recobro; (iv) operadores de pago para procesar reintentos. Esta cesión está limitada a la
            finalidad de cobranza y devolución del equipo.
          </p>
        </Section>

        <Section title="20. Cesión de derechos y subrogación">
          <p>
            <strong>20.1.</strong> FLUX podrá ceder libremente, total o parcialmente, los créditos
            derivados de este Contrato a terceros (empresas de factoring, empresas de cobranza,
            inversionistas) sin necesidad de nuevo consentimiento del Usuario, siendo suficiente la
            comunicación posterior al Usuario indicando el cesionario y el nuevo método de pago.
          </p>
          <p>
            <strong>20.2.</strong> El Usuario no podrá ceder, transferir ni subarrendar sus derechos u
            obligaciones bajo este Contrato sin autorización previa, expresa y escrita de FLUX. Toda
            cesión no autorizada es nula de pleno derecho y configura causal de resolución (cl. 15.1).
          </p>
        </Section>

        <Section title="21. Costos de cobranza, costos y costas">
          <p>
            <strong>21.1.</strong> Todos los costos derivados de la cobranza extrajudicial (cartas
            notariales, gestiones por agencia de cobranza, cobranza prejudicial, registros) serán
            asumidos íntegramente por el Usuario y se incorporan al monto adeudado, hasta un máximo del
            10% del capital adeudado.
          </p>
          <p>
            <strong>21.2.</strong> En caso de cobranza judicial o arbitral, el Usuario asumirá íntegramente:
          </p>
          <ul>
            <li>
              Los <strong>costos del proceso</strong> (tasas judiciales, peritajes, notificaciones,
              traducciones, copias certificadas).
            </li>
            <li>
              Las <strong>costas del proceso</strong>, incluyendo los{" "}
              <strong>honorarios profesionales de los abogados</strong> de FLUX, en un porcentaje que
              no será menor al 10% ni mayor al 20% del monto demandado, salvo determinación distinta
              del juez o árbitro.
            </li>
            <li>Cualquier otro gasto razonablemente incurrido por FLUX en defensa de sus derechos.</li>
          </ul>
        </Section>

        <Section title="22. Domicilio contractual y notificaciones">
          <p>
            <strong>22.1. Domicilio contractual del Usuario.</strong> El Usuario fija como domicilio
            para todas las comunicaciones, intimaciones, notificaciones judiciales y extrajudiciales:
            (i) la dirección física consignada al momento del registro y/o entrega del equipo, y (ii)
            el correo electrónico registrado en su cuenta de fluxperu.com. El Usuario se obliga a
            mantener actualizados ambos domicilios y a comunicar cualquier cambio en un plazo máximo de
            48 horas.
          </p>
          <p>
            <strong>22.2. Presunción de notificación válida.</strong> Cualquier comunicación enviada por
            FLUX a la dirección física o al correo electrónico registrados se reputa válidamente
            realizada en la fecha de envío, surtiendo plenos efectos legales aunque no sea efectivamente
            recepcionada por el Usuario, salvo prueba en contrario que demuestre causa no imputable.
          </p>
          <p>
            <strong>22.3. Domicilio contractual de FLUX.</strong> FLUX fija como domicilio contractual el
            consignado en su ficha RUC ante SUNAT y como correo de comunicaciones hola@fluxperu.com.
          </p>
        </Section>

        <Section title="23. Facturación y comprobantes de pago">
          <p>
            FLUX emite comprobante de pago electrónico (boleta o factura) por cada cobro mensual
            conforme a la normativa de SUNAT. Para la emisión de factura, el Usuario debe proporcionar
            un RUC válido y vigente al momento de la contratación. Los cambios de datos de facturación
            deben solicitarse antes del siguiente cobro. La emisión de factura por gastos deducibles del
            arrendamiento es responsabilidad de FLUX; el Usuario es responsable de utilizar el
            comprobante conforme a su régimen tributario.
          </p>
        </Section>

        <Section title="24. Limitación de responsabilidad de FLUX">
          <p>
            <strong>24.1.</strong> FLUX no será responsable por daños indirectos, incidentales,
            especiales o consecuentes, incluyendo pero no limitado a: pérdida de datos, lucro cesante,
            interrupción de negocio, daño reputacional o pérdida de oportunidad, derivados del uso o la
            imposibilidad de uso del equipo, fallas de hardware o software ajenas a FLUX, o medidas
            remotas legítimamente aplicadas conforme a la cláusula 10.
          </p>
          <p>
            <strong>24.2.</strong> La responsabilidad total acumulada de FLUX bajo este Contrato no
            excederá el monto total de Rentas Mensuales efectivamente pagadas por el Usuario durante los
            últimos 12 (doce) meses anteriores al hecho que origine la reclamación.
          </p>
          <p>
            <strong>24.3.</strong> FLUX no garantiza que el equipo sea adecuado para un propósito
            particular del Usuario. El equipo se entrega &ldquo;tal cual&rdquo; con las especificaciones
            técnicas publicadas por Apple Inc.
          </p>
        </Section>

        <Section title="25. Modificaciones de los Términos">
          <p>
            FLUX se reserva el derecho de modificar estos Términos y Condiciones. Cualquier
            modificación será notificada al Usuario con un mínimo de 30 días calendario de anticipación
            al correo electrónico registrado y publicada en fluxperu.com/terminos con la fecha de
            actualización. El uso continuo del servicio después de dicho plazo implica la aceptación de
            los nuevos términos. Si el Usuario no está de acuerdo con las modificaciones, podrá
            cancelar el Contrato conforme a la cláusula 14.2 sin penalidad, siempre y cuando ya haya
            cumplido el Plazo mínimo.
          </p>
        </Section>

        <Section title="26. Legislación aplicable y resolución de controversias">
          <p>
            <strong>26.1. Ley aplicable.</strong> Este Contrato se rige por las leyes de la República del
            Perú, en particular: el Código Civil (Libro VII, Sección Segunda — Contratos Nominados,
            Título VI — Arrendamiento; y Libro VI — Obligaciones); la Ley N.° 29571 (Código de
            Protección y Defensa del Consumidor) cuando aplique; la Ley N.° 29733 (Ley de Protección de
            Datos Personales); la Ley N.° 27287 (Ley de Títulos Valores); el Código Procesal Civil; y
            el Código Penal.
          </p>
          <p>
            <strong>26.2. Conciliación previa.</strong> Las controversias derivadas del presente
            Contrato serán sometidas, en primer lugar, a un proceso de{" "}
            <strong>conciliación extrajudicial</strong> conforme a la Ley N.° 26872. La conciliación es
            requisito de procedibilidad para acciones civiles, salvo en los casos exceptuados por ley
            (procesos ejecutivos, medidas cautelares, alimentos, etc.).
          </p>
          <p>
            <strong>26.3. Jurisdicción ordinaria.</strong> Agotada la conciliación sin acuerdo, las
            partes se someten a la <strong>jurisdicción exclusiva de los juzgados y tribunales del
            distrito judicial de Lima Cercado</strong>, renunciando a cualquier otro fuero que pudiera
            corresponderles.
          </p>
          <p>
            <strong>26.4. Arbitraje (contratos B2B mayores a USD 5,000).</strong> Para contratos cuya
            obligación total acumulada (sumatoria de Rentas Mensuales + valor del equipo + AppleCare+)
            supere los USD 5,000, las partes acuerdan que cualquier controversia sea resuelta mediante{" "}
            <strong>arbitraje administrado por el Centro de Arbitraje de la Cámara de Comercio de
            Lima (CCL)</strong>, conforme a sus reglamentos vigentes. El tribunal estará compuesto por
            un (1) árbitro único cuando la cuantía sea inferior a USD 50,000 y por tres (3) árbitros
            cuando sea superior. El idioma del arbitraje será español y la sede Lima, Perú. El laudo
            arbitral será definitivo, inapelable y ejecutable inmediatamente.
          </p>
          <p>
            <strong>26.5. Acciones ejecutivas.</strong> La cláusula arbitral no impide a FLUX iniciar
            directamente proceso ejecutivo sobre el pagaré (cl. 7.1) ante la jurisdicción ordinaria,
            ni medidas cautelares previas, las que constituyen acciones especiales no sujetas al
            arbitraje.
          </p>
        </Section>

        <Section title="27. Disposiciones finales">
          <p>
            <strong>27.1. Salvedad de nulidad.</strong> Si alguna cláusula de estos Términos fuera
            declarada nula o inaplicable por autoridad competente, las restantes cláusulas mantendrán
            su plena vigencia y efecto. La parte declarada nula será reemplazada por una disposición
            válida que más se aproxime a la intención original de las partes.
          </p>
          <p>
            <strong>27.2. No renuncia.</strong> La falta de ejercicio o el ejercicio tardío por parte de
            FLUX de cualquier derecho establecido en este Contrato no constituye renuncia al mismo, ni
            crea precedente exigible para el Usuario.
          </p>
          <p>
            <strong>27.3. Acuerdo completo.</strong> Este Contrato, junto con la Política de
            Privacidad, el pagaré incompleto firmado al inicio, el acta de entrega y cualquier anexo o
            adenda escrita, constituye el acuerdo íntegro entre las partes y reemplaza cualquier
            acuerdo previo, verbal o escrito.
          </p>
          <p>
            <strong>27.4. Idioma del Contrato.</strong> El idioma oficial del Contrato es el español.
            Cualquier traducción es referencial. En caso de discrepancia entre versiones, prevalece la
            versión en español.
          </p>
          <p>
            <strong>27.5. Encabezados.</strong> Los encabezados de las cláusulas son únicamente
            referenciales y no afectan la interpretación de su contenido.
          </p>
        </Section>

        <Section title="28. Contacto y libro de reclamaciones">
          <p>Para consultas, reclamos o el ejercicio de cualquier derecho bajo este Contrato:</p>
          <ul>
            <li>
              <strong>Correo electrónico:</strong> hola@fluxperu.com
            </li>
            <li>
              <strong>Sitio web:</strong> fluxperu.com
            </li>
            <li>
              <strong>Razón social:</strong> Tika Services S.A.C.
            </li>
            <li>
              <strong>RUC:</strong> 20605702512
            </li>
            <li>
              <strong>Libro de Reclamaciones:</strong>{" "}
              <Link href="/libro-de-reclamaciones" className="text-[#1B4FFF] hover:underline">
                fluxperu.com/libro-de-reclamaciones
              </Link>
            </li>
          </ul>
        </Section>
      </div>

      <div className="mt-10 pt-6 border-t border-[#E5E5E5] flex gap-4 text-sm">
        <Link href="/privacidad" className="text-[#1B4FFF] hover:underline">
          Política de privacidad
        </Link>
        <Link href="/contacto" className="text-[#1B4FFF] hover:underline">
          Contacto
        </Link>
        <Link href="/libro-de-reclamaciones" className="text-[#1B4FFF] hover:underline">
          Libro de reclamaciones
        </Link>
      </div>
    </div>
  );
}
