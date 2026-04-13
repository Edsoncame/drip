import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de cancelaciones y devoluciones | FLUX",
  description:
    "Conoce cómo cancelar tu suscripción FLUX, solicitar devoluciones y obtener reembolsos por cargos incorrectos.",
};

export default function CancelacionesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      <h1 className="text-3xl md:text-4xl font-800 text-[#18191F] mb-3">
        Política de cancelaciones y devoluciones
      </h1>
      <p className="text-sm text-[#666] mb-10">Última actualización: 13 de abril de 2026</p>

      <div className="prose prose-neutral max-w-none text-[#333] leading-relaxed space-y-8">
        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">1. Introducción</h2>
          <p>
            Tika Services S.A.C. (en adelante, <strong>FLUX</strong>), con RUC 20605702512, domiciliada en
            Av. Primavera 543, Piso 4, San Borja, Lima, Perú, establece la presente política para regular las
            cancelaciones de suscripciones y los reembolsos asociados al servicio de alquiler de MacBooks.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">2. Derecho de desistimiento (primeros 7 días)</h2>
          <p>
            Conforme al Código de Protección y Defensa del Consumidor del Perú (Ley N° 29571), el cliente tiene
            derecho a desistirse del contrato dentro de los <strong>7 días calendario</strong> siguientes a la
            entrega del equipo, sin expresión de causa.
          </p>
          <p>
            Para ejercer este derecho, el cliente debe:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Enviar un correo a <a href="mailto:hola@fluxperu.com" className="text-[#1B4FFF] hover:underline">hola@fluxperu.com</a> solicitando la cancelación.</li>
            <li>Devolver el equipo en las mismas condiciones en que fue entregado (sin daños, con todos sus accesorios y empaque original).</li>
            <li>FLUX coordinará el recojo del equipo sin costo adicional dentro de Lima Metropolitana.</li>
          </ul>
          <p>
            Una vez verificado el estado del equipo, FLUX reembolsará el 100% del monto cobrado en un plazo
            máximo de <strong>7 días hábiles</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">3. Cancelación después de los 7 días</h2>
          <p>
            Si el cliente desea cancelar su suscripción después del periodo de desistimiento, aplican las
            siguientes condiciones:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Penalidad por terminación anticipada:</strong> el cliente debe pagar el equivalente al 50%
              de las cuotas restantes hasta la finalización del plazo del contrato.
            </li>
            <li>
              El equipo debe ser devuelto en buenas condiciones. Daños físicos, pérdida de accesorios o falta de
              mantenimiento se descontarán del reembolso correspondiente (si aplica).
            </li>
            <li>
              La cancelación se puede solicitar desde el panel del cliente en{" "}
              <Link href="/cuenta/rentas" className="text-[#1B4FFF] hover:underline">Mis rentas</Link>, o
              enviando un correo a hola@fluxperu.com.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">4. Reembolsos por cargos incorrectos</h2>
          <p>
            Si el cliente detecta un cobro duplicado, un cargo por un monto mayor al pactado, o cualquier otro
            error, debe notificarlo a FLUX en un plazo máximo de 30 días calendario desde la fecha del cargo. El
            reembolso se realizará al mismo medio de pago original dentro de <strong>5 a 10 días hábiles</strong>,
            dependiendo del banco emisor y de Culqi (nuestro procesador de pagos).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">5. Fallas del equipo</h2>
          <p>
            Si el equipo presenta fallas de fábrica o defectos durante el periodo de alquiler, FLUX se
            compromete a reemplazarlo o repararlo sin costo adicional dentro de un plazo de 48 horas hábiles. El
            reporte debe hacerse a través de <a href="mailto:hola@fluxperu.com" className="text-[#1B4FFF] hover:underline">hola@fluxperu.com</a> o
            por WhatsApp al <a href="https://wa.me/51932648703" className="text-[#1B4FFF] hover:underline">+51 932 648 703</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">6. No aplica devolución</h2>
          <p>No procede devolución ni reembolso en los siguientes casos:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Cuando el equipo ha sido dañado por uso indebido, golpes, líquidos, o modificaciones no autorizadas.</li>
            <li>Cuando el cliente solicita la devolución pasados los 7 días calendario del periodo de desistimiento (en este caso aplica la política de cancelación con penalidad).</li>
            <li>Cuando el cliente no devuelve el equipo en el plazo acordado tras cancelar el contrato.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-700 text-[#18191F] mb-3">7. Canal de contacto</h2>
          <p>Para cualquier consulta relacionada con cancelaciones o devoluciones:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Email: <a href="mailto:hola@fluxperu.com" className="text-[#1B4FFF] hover:underline">hola@fluxperu.com</a></li>
            <li>WhatsApp: <a href="https://wa.me/51932648703" className="text-[#1B4FFF] hover:underline">+51 932 648 703</a></li>
            <li>Horario de atención: Lunes a Viernes, 9:00 a.m. – 6:00 p.m.</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-[#E5E5E5] text-xs text-[#999]">
        <p>Tika Services S.A.C. — RUC 20605702512</p>
        <p>Av. Primavera 543, Piso 4, San Borja, Lima, Perú</p>
      </div>
    </div>
  );
}
