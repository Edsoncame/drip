import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Política de privacidad de FLUX (Tika Services S.A.C.). Cómo protegemos tus datos personales conforme a la Ley N.° 29733 del Perú.",
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-[#1B4FFF] hover:underline">← Volver al inicio</Link>
      </div>
      <h1 className="text-3xl font-800 text-[#18191F] mb-2">Política de Privacidad</h1>
      <p className="text-sm text-[#999999] mb-8">Última actualización: 28 de abril de 2026</p>

      <div className="space-y-6 text-[#333333]">
        {[
          {
            title: "1. Responsable del tratamiento",
            content: "Tika Services S.A.C. (FLUX), con RUC 20605702512 y domicilio fiscal en Lima, Perú, es responsable del tratamiento de tus datos personales en cumplimiento de la Ley N.° 29733 — Ley de Protección de Datos Personales del Perú y su Reglamento (D.S. 003-2013-JUS).",
          },
          {
            title: "2. Datos que recopilamos",
            content: "Datos de identificación: nombre completo, DNI o RUC, correo electrónico, teléfono, dirección de entrega, empresa (B2B). Datos KYC: foto de DNI (anverso/reverso) y selfie con prueba de vida para verificar identidad. Datos de firma legal: nombre legal completo, fecha y hora UTC, dirección IP, user-agent del navegador, versión de los Términos aceptada y confirmación de scroll de lectura. Datos de pago: tokenizados y procesados por Stripe y Mercado Pago — FLUX nunca almacena datos completos de tarjeta. Datos de uso del equipo: logs de gestión MDM/Apple Business Manager para fines de seguridad y soporte (no monitoreamos contenido personal del usuario).",
          },
          {
            title: "3. Finalidad del tratamiento",
            content: "Tus datos se usan para: (a) gestionar tu cuenta y contratos de renta; (b) procesar pagos recurrentes; (c) coordinar entrega, soporte y devolución de equipos; (d) emitir factura electrónica SUNAT; (e) registrar la auditoría legal de aceptación de los Términos y Condiciones (con valor probatorio); (f) prevenir fraude, robo y suplantación de identidad mediante KYC; (g) reportar a centrales de riesgo en caso de mora prolongada (ver sección 5); (h) cumplir obligaciones tributarias y judiciales; (i) con tu consentimiento expreso, enviarte ofertas y novedades.",
          },
          {
            title: "4. Base legal del tratamiento",
            content: "El tratamiento se sustenta en: ejecución del contrato de arrendamiento, consentimiento expreso del titular al aceptar los Términos y Condiciones, cumplimiento de obligaciones legales (SUNAT, INDECOPI), e interés legítimo del responsable para prevenir fraude y proteger su patrimonio (Art. 14.1 Ley 29733).",
          },
          {
            title: "5. Compartición y cesión de datos",
            content: "FLUX no vende tus datos. Solo los comparte con terceros en estos casos específicos y con esta finalidad limitada: (a) Procesadores de pago (Stripe, Mercado Pago) para procesar tus pagos; (b) SUNAT para emisión de comprobantes electrónicos; (c) Apple Inc. para gestión MDM/Apple Business Manager y procesamiento de garantía AppleCare+; (d) Centrales de información de riesgos (Equifax-INFOCORP, Sentinel, Experian, Xchange CCL) en caso de mora prolongada superior a 30 días, conforme a la cláusula 19 de los Términos; (e) Empresas de cobranza extrajudicial y estudios de abogados en caso de incumplimiento; (f) Autoridades judiciales, MP, INDECOPI y SUNARP cuando la ley lo requiera; (g) Proveedores de logística para coordinar entregas. Cesión de créditos: FLUX puede ceder los créditos derivados del contrato a terceros (factoring, cobranza profesional) sin necesidad de nuevo consentimiento, conforme a la cláusula 20 de los Términos.",
          },
          {
            title: "6. Reporte a centrales de riesgo (consentimiento PDP)",
            content: "Al aceptar los Términos y Condiciones, otorgás consentimiento expreso, libre, inequívoco e informado para que FLUX reporte a las centrales privadas de información de riesgos autorizadas por la SBS — incluyendo de manera enunciativa: Equifax Perú (INFOCORP), Sentinel Perú, Experian Perú y Xchange Perú (CCL) — la siguiente información: identidad, monto adeudado, días de mora, tipo de deuda y, cuando aplique, condición de no devolución del equipo. El reporte podrá iniciarse a partir del día 31 de mora, previa notificación al correo registrado con 48 horas de anticipación. La información reportada se mantiene hasta 5 años contados desde la cancelación íntegra de la deuda.",
          },
          {
            title: "7. Tus derechos (ARCO)",
            content: "Como titular de tus datos tenés derecho a: Acceder, Rectificar, Cancelar y Oponerte al tratamiento (ARCO), conforme a los artículos 18 al 26 de la Ley 29733. Ejercé tus derechos escribiendo a hola@fluxperu.com con asunto 'Derechos ARCO' indicando tu nombre completo, DNI/RUC y derecho que ejercés. Respondemos en un plazo máximo de 15 días hábiles. Importante: la cancelación de datos no extingue por sí misma una obligación de pago vigente — si hay mora, FLUX puede mantener los datos necesarios para gestionar la cobranza por el plazo legal aplicable.",
          },
          {
            title: "8. Plazo de conservación",
            content: "Los datos se conservan durante toda la vigencia del contrato y por los siguientes plazos legales posteriores: 5 años para datos relacionados con SUNAT y obligaciones tributarias; 5 años después de la cancelación de deuda para reportes a centrales de riesgo; 10 años para auditoría de firma digital y aceptación de Términos; lo que indique la ley para acciones civiles o penales en curso.",
          },
          {
            title: "9. Seguridad",
            content: "Implementamos medidas técnicas y organizativas: cifrado SSL/TLS en tránsito, cifrado en reposo de datos sensibles, almacenamiento en servidores Vercel + Neon Postgres con backups encriptados, acceso restringido al personal autorizado por necesidad operativa, doble factor de autenticación para acceso administrativo y registro de auditoría de cambios sobre datos personales. En caso de incidente de seguridad que afecte tus datos, te notificaremos en un plazo máximo de 72 horas conforme al Reglamento.",
          },
          {
            title: "10. Cookies y tecnologías de seguimiento",
            content: "Usamos cookies esenciales para el funcionamiento del sitio (sesión, carrito, idioma) y cookies analíticas (Google Analytics 4, Google Tag Manager) y de marketing (Meta Pixel) para mejorar la experiencia y medir conversiones. Podés deshabilitar las cookies no esenciales desde la configuración de tu navegador o desde el banner de consentimiento de cookies.",
          },
          {
            title: "11. Transferencia internacional",
            content: "Algunos de nuestros proveedores procesan datos fuera del Perú: Vercel y Neon (Estados Unidos), Stripe (Estados Unidos), Apple Inc. (Estados Unidos). Todos cumplen con estándares de seguridad equivalentes o superiores a la Ley 29733. La aceptación de estos Términos implica el consentimiento expreso para esta transferencia conforme al Art. 15 Ley 29733.",
          },
          {
            title: "12. Modificaciones",
            content: "FLUX puede actualizar esta Política con notificación al cliente vía correo electrónico al menos 30 días antes de la entrada en vigor. La versión actual y su fecha de última actualización están siempre disponibles en fluxperu.com/privacidad.",
          },
          {
            title: "13. Contacto del responsable",
            content: "Para cualquier consulta sobre el tratamiento de tus datos personales o el ejercicio de tus derechos: hola@fluxperu.com. Si considerás que tus derechos no han sido atendidos adecuadamente, podés presentar reclamo ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos.",
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
