import Link from "next/link";

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#1B4FFF] hover:underline">← Volver al inicio</Link>
      </div>
      <h1 className="text-3xl font-800 text-[#18191F] mb-2">Términos y Condiciones</h1>
      <p className="text-sm text-[#999999] mb-8">Última actualización: abril 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-[#333333]">
        {[
          {
            title: "1. Objeto del servicio",
            content: "FLUX, operado por Tika Services S.A.C. (RUC: 20605702512), ofrece el alquiler mensual de equipos MacBook a empresas y profesionales en Lima, Perú. El usuario accede al uso del equipo durante el plazo contratado a cambio de una renta mensual.",
          },
          {
            title: "2. Condiciones de la renta",
            content: "El cobro del primer mes se realiza al momento de confirmar el pedido. Los meses siguientes se cobran automáticamente en la misma fecha mediante el método de pago registrado. El usuario puede cancelar el contrato con 30 días de aviso previo por escrito.",
          },
          {
            title: "3. Uso del equipo",
            content: "El equipo es propiedad de Tika Services S.A.C. durante toda la vigencia del contrato. El usuario se compromete a usar el equipo de forma responsable, no cederlo a terceros sin autorización, y mantenerlo en buen estado.",
          },
          {
            title: "4. Responsabilidad por daños",
            content: "El usuario es responsable de los daños causados por mal uso, pérdida o robo del equipo. FLUX ofrece un seguro básico contra daños accidentales. Daños intencionales o negligencia grave no están cubiertos.",
          },
          {
            title: "5. Opción de compra",
            content: "Al finalizar el plazo contratado, el usuario puede ejercer la opción de compra del equipo al valor residual pactado en el contrato. Esta opción debe ser ejercida dentro de los 30 días posteriores al vencimiento.",
          },
          {
            title: "6. Entrega y devolución",
            content: "La entrega se realiza en el domicilio o empresa del cliente en Lima Metropolitana en un plazo de 2 a 5 días hábiles. La devolución del equipo al finalizar el contrato se coordina directamente con FLUX.",
          },
          {
            title: "7. Modificaciones",
            content: "FLUX se reserva el derecho de modificar estos términos con un aviso previo de 30 días. El uso continuo del servicio implica la aceptación de los nuevos términos.",
          },
          {
            title: "8. Contacto",
            content: "Para consultas sobre estos términos escríbenos a hola@flux.pe o llámanos al +51 999 000 000.",
          },
        ].map(section => (
          <div key={section.title}>
            <h2 className="text-lg font-700 text-[#18191F] mb-2">{section.title}</h2>
            <p className="text-sm leading-relaxed text-[#666666]">{section.content}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-[#E5E5E5] flex gap-4 text-sm">
        <Link href="/privacidad" className="text-[#1B4FFF] hover:underline">Política de privacidad</Link>
        <Link href="/contacto" className="text-[#1B4FFF] hover:underline">Contacto</Link>
      </div>
    </div>
  );
}
