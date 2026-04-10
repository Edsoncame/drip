import Link from "next/link";

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#1B4FFF] hover:underline">← Volver al inicio</Link>
      </div>
      <h1 className="text-3xl font-800 text-[#18191F] mb-2">Política de Privacidad</h1>
      <p className="text-sm text-[#999999] mb-8">Última actualización: abril 2026</p>

      <div className="space-y-6 text-[#333333]">
        {[
          {
            title: "1. Responsable del tratamiento",
            content: "Tika Services S.A.C., con RUC 20608888888, con domicilio en Lima, Perú, es responsable del tratamiento de tus datos personales en cumplimiento de la Ley N.° 29733 — Ley de Protección de Datos Personales del Perú.",
          },
          {
            title: "2. Datos que recopilamos",
            content: "Recopilamos nombre, correo electrónico, teléfono, empresa y RUC al momento del registro. También datos de pago procesados de forma segura por Mercado Pago (nunca almacenamos datos de tarjeta en nuestros servidores).",
          },
          {
            title: "3. Finalidad del tratamiento",
            content: "Usamos tus datos para: gestionar tu cuenta y contratos de renta, procesar pagos mensuales, coordinar la entrega y devolución de equipos, enviarte comunicaciones relacionadas con tu servicio y, con tu consentimiento, enviarte ofertas y novedades.",
          },
          {
            title: "4. Base legal",
            content: "El tratamiento se basa en la ejecución del contrato de renta, el cumplimiento de obligaciones legales (facturación, SUNAT) y el interés legítimo de mejorar nuestros servicios.",
          },
          {
            title: "5. Compartición de datos",
            content: "No vendemos ni cedemos tus datos a terceros con fines comerciales. Compartimos datos únicamente con: Mercado Pago (procesador de pagos), proveedores de logística (para entrega de equipos) y autoridades cuando la ley lo requiera.",
          },
          {
            title: "6. Tus derechos (ARCO)",
            content: "Tienes derecho a Acceder, Rectificar, Cancelar y Oponerte al tratamiento de tus datos. Ejerce tus derechos escribiendo a privacidad@drip.pe con tu nombre y DNI. Responderemos en un plazo máximo de 20 días hábiles.",
          },
          {
            title: "7. Seguridad",
            content: "Implementamos medidas técnicas y organizativas para proteger tus datos: cifrado SSL, almacenamiento en servidores seguros, acceso restringido al personal autorizado.",
          },
          {
            title: "8. Cookies",
            content: "Usamos cookies esenciales para el funcionamiento del sitio y cookies analíticas para mejorar la experiencia. Puedes deshabilitar las cookies no esenciales desde la configuración de tu navegador.",
          },
        ].map(section => (
          <div key={section.title}>
            <h2 className="text-lg font-700 text-[#18191F] mb-2">{section.title}</h2>
            <p className="text-sm leading-relaxed text-[#666666]">{section.content}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-[#E5E5E5] flex gap-4 text-sm">
        <Link href="/terminos" className="text-[#1B4FFF] hover:underline">Términos y condiciones</Link>
        <Link href="/contacto" className="text-[#1B4FFF] hover:underline">Contacto</Link>
      </div>
    </div>
  );
}
