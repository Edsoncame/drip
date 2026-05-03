import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "equipar-equipo-remoto-peru-macbook-2026";

export async function generateMetadata(): Promise<Metadata> {
  const post = getBlogPost(SLUG);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${BASE}/blog/${SLUG}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

const CONTENT = `<p>Contratar talento remoto en Perú ya no es una excepción: es el modelo operativo de decenas de startups, agencias y consultoras limeñas. Pero hay una pregunta que vuelve con cada nuevo empleado:</p>

<p><strong>¿Cómo llega el equipo correcto a una persona que trabaja desde Arequipa, Cusco o incluso el extranjero?</strong></p>

<p>La respuesta usual —comprar la laptop, coordinar el envío, configurarla manualmente— tarda entre 2 y 6 semanas. Y cada semana de espera tiene un costo real: el sueldo del empleado que no puede trabajar, la frustración del manager que espera productividad, y el riesgo de que el talento recién contratado empiece a dudar.</p>

<p>Esta guía cubre cómo equipar un equipo remoto con MacBooks de forma eficiente: qué modelo elegir según el rol, cómo llega el equipo sin que IT tenga que tocar nada, y cómo gestionar la flota cuando está dispersa en diferentes ciudades o países.</p>

<h2>Por qué el modelo clásico de compra no funciona para equipos remotos</h2>

<p>Comprar laptops para equipos presenciales ya tiene sus problemas. Para equipos remotos, esos problemas se multiplican.</p>

<p><strong>El problema logístico.</strong> Un equipo de compras corporativas en Lima tarda entre 3 y 8 semanas en completar una orden: solicitud interna, aprobación de presupuesto, orden de compra, importación o stock disponible, facturación. Si el empleado está en provincia, hay que sumar el tiempo y costo de envío, más el riesgo de daño en tránsito.</p>

<p><strong>El problema de configuración.</strong> Una laptop nueva no está lista para trabajar el día uno. Hay que instalarle aplicaciones, conectarla al directorio de la empresa, configurar VPN, activar cifrado. Hacer esto a distancia —a través de llamada o TeamViewer— es lento y propenso a errores.</p>

<p><strong>El problema de inventario muerto.</strong> Si el empleado renuncia a los 3 meses, quedas con una laptop que hay que recuperar, reformatear y reasignar. Eso es capital inmovilizado que no estaba trabajando para ti.</p>

<p>El alquiler mensual con MDM incluido resuelve los tres problemas. A continuación, cómo.</p>

<h2>Qué modelo de MacBook necesita cada rol remoto</h2>

<p>No todos los empleados remotos necesitan el mismo equipo. Elegir el modelo correcto reduce el costo mensual sin sacrificar productividad.</p>

<h3>MacBook Air M4 (desde $85/mes) — para la mayoría de roles</h3>

<p>El Air M4 es el equipo correcto para el 70-80% de los perfiles remotos en una empresa de servicios o tecnología:</p>

<ul>
  <li>Developers backend / frontend (excepto los que compilan grandes proyectos todo el día)</li>
  <li>Product managers, project managers, scrum masters</li>
  <li>Diseñadores UX/UI que trabajan principalmente en Figma o herramientas web</li>
  <li>Analistas de datos con Excel, Google Sheets, Looker</li>
  <li>Equipos de ventas, customer success, operaciones</li>
  <li>Redactores, content managers, community managers</li>
</ul>

<p>El M4 tiene 10 núcleos de GPU y hasta 32 GB de RAM unificada. Para trabajo de oficina, videoconferencias y multitarea intensiva, es más que suficiente.</p>

<h3>MacBook Pro M4 / M5 (desde $115/mes) — para roles de alta demanda técnica</h3>

<p>El Pro tiene más núcleos de procesamiento y opciones de hasta 64 GB RAM. Es el equipo correcto para:</p>

<ul>
  <li>Developers que compilan proyectos pesados (React Native builds, proyectos Java/Kotlin enterprise, pipelines CI/CD locales)</li>
  <li>Diseñadores gráficos y de motion con After Effects, Cinema 4D, Figma con prototipos complejos</li>
  <li>Productores audiovisuales que editan video en Premiere o Final Cut Pro</li>
  <li>Data scientists con modelos ML locales, PyTorch, Jupyter con datasets grandes</li>
  <li>Arquitectos y dibujantes técnicos con AutoCAD, Revit, SketchUp</li>
</ul>

<p>La diferencia de precio entre Air y Pro es de $30/mes por equipo. Para 5 equipos durante 12 meses, eso es $1,800. Vale la pena gastarlos si el perfil lo justifica; no si no.</p>

<h2>Cómo llega el equipo a un empleado remoto en Perú</h2>

<p>Este es el punto donde la mayoría de empresas pierde tiempo. Con FLUX, el proceso funciona así:</p>

<h3>Paso 1: Cotización en 3 minutos</h3>

<p>En <a href="/empresas#cotizar">fluxperu.com/empresas</a> defines el modelo, la cantidad de equipos y el plazo del contrato (8, 16 o 24 meses). Recibes la propuesta por WhatsApp o email en menos de 30 minutos.</p>

<h3>Paso 2: Firma digital del contrato</h3>

<p>El contrato se firma digitalmente bajo <strong>Ley N° 27269</strong> (Ley de Firma Electrónica del Perú). No hay que imprimir ni ir a ninguna oficina.</p>

<h3>Paso 3: Entrega en 24-48 horas en Lima</h3>

<p>Para empleados en Lima, el equipo llega entre 24 y 48 horas desde la confirmación del pedido. La dirección de entrega puede ser el domicilio del empleado.</p>

<p>Para <strong>empleados en provincia</strong>, coordinamos el envío con courier de confianza. El tiempo varía según la ciudad (Arequipa, Trujillo, Cusco: generalmente 2-4 días hábiles adicionales).</p>

<h3>Paso 4: Encendido listo para trabajar (con MDM)</h3>

<p>Si tu empresa usa MDM —que FLUX incluye sin costo adicional en el plan empresarial—, el equipo puede llegar <strong>preconfigurado a través de Apple Automated Device Enrollment (ADE)</strong>. El empleado enciende el equipo, ingresa sus credenciales corporativas, y en 15-20 minutos tiene instaladas todas las apps y configuraciones de la empresa. Sin llamadas de soporte. Sin IT manual.</p>

<p>Este proceso se llama <strong>zero-touch deployment</strong> y es el estándar que usan empresas globales de tecnología para onboarding remoto.</p>

<h2>Gestión de la flota cuando está dispersa</h2>

<p>Tener 10 MacBooks en 10 ubicaciones diferentes parece caótico. Con las herramientas correctas, es manejable desde un dashboard.</p>

<h3>MDM: el centro de control de tu flota remota</h3>

<p>Un <strong>Mobile Device Management (MDM)</strong> como Mosyle Business (desde $1 USD/dispositivo/mes) o Jamf Pro permite:</p>

<ul>
  <li>Ver el estado de todos los equipos en tiempo real: modelo, versión de macOS, espacio disponible, última conexión</li>
  <li>Enviar actualizaciones de software de forma silenciosa, sin interrumpir al empleado</li>
  <li>Aplicar políticas de seguridad: contraseña mínima, bloqueo automático, cifrado FileVault activo</li>
  <li>Bloquear o borrar un equipo de forma remota si se pierde o el empleado sale de la empresa</li>
  <li>Instalar o desinstalar apps corporativas sin que el empleado tenga que hacer nada</li>
</ul>

<p>Para equipos remotos, el MDM no es un lujo: es el equivalente digital de tener IT presente en cada ubicación.</p>

<h3>Separar el entorno personal del corporativo</h3>

<p>Uno de los errores más frecuentes en equipos remotos: los empleados usan su Apple ID personal en el equipo de empresa. Cuando el empleado renuncia, sus archivos se van con él en iCloud personal.</p>

<p>La solución es <strong>Apple Business Manager (ABM)</strong> + <strong>Cuentas de Apple Gestionadas</strong>. Con ABM, cada empleado recibe una cuenta <code>@tuempresa.com</code> separada de su cuenta personal, que el administrador puede desactivar el día que sale de la empresa. Los archivos corporativos quedan en el entorno de la empresa, no en el iCloud personal del empleado.</p>

<p>Configurar ABM toma entre 2 y 4 horas la primera vez. El proceso completo está documentado en nuestra <a href="/blog/apple-business-manager-peru-guia-configuracion-2026">guía de Apple Business Manager para Perú</a>.</p>

<h3>Offboarding remoto: recuperar el equipo sin fricciones</h3>

<p>Cuando un empleado remoto sale de la empresa, el proceso de recuperación del equipo tiene que ser claro desde el contrato:</p>

<ol>
  <li><strong>Desactivar el Apple ID gestionado</strong> del empleado desde ABM — acceso a datos corporativos cortado inmediatamente</li>
  <li><strong>Coordinar el pickup</strong> en la ubicación del empleado para devolución del equipo</li>
  <li><strong>Borrado certificado</strong> cuando el equipo llega a Lima: crypto-erase + restauración a fábrica</li>
</ol>

<p>El certificado de borrado queda disponible si lo necesitas para auditorías o cumplimiento normativo.</p>

<h2>Cuánto cuesta equipar un equipo remoto de 5 personas: números reales</h2>

<p>Para hacer el análisis concreto, tomemos un equipo de 5 personas: 3 developers y 2 project managers, todos remotos.</p>

<table>
  <thead>
    <tr>
      <th>Opción</th>
      <th>Costo inicial</th>
      <th>Costo mensual</th>
      <th>Total 24 meses</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Compra (5 × MacBook Air M4)</td>
      <td>S/ 27,495</td>
      <td>S/ 0</td>
      <td>S/ 27,495 + mantenimiento</td>
    </tr>
    <tr>
      <td>Alquiler FLUX (plan 24 meses)</td>
      <td>S/ 0</td>
      <td>S/ 1,433/mes*</td>
      <td>S/ 34,390*</td>
    </tr>
  </tbody>
</table>

<p><em>*Plan 24 meses con descuento por volumen. Cotizar en <a href="/empresas#cotizar">fluxperu.com/empresas</a>.</em></p>

<p><strong>Pero la comparación no termina ahí.</strong> A la compra hay que sumarle:</p>

<ul>
  <li><strong>Depreciación contable parcial:</strong> el Art. 22 del RLIR permite depreciar equipos al 25% anual. En 24 meses solo depreciaste el 50% — el resto sigue en el balance como activo fijo</li>
  <li><strong>Costo de mantenimiento:</strong> una falla de hardware fuera de garantía en Perú puede costar entre S/ 800 y S/ 2,000 por equipo</li>
  <li><strong>Costo de IT:</strong> configuración, actualizaciones y recuperación manual de cada equipo</li>
  <li><strong>Costo de fricción por persona nueva:</strong> con un sueldo developer senior de S/ 7,000/mes, 2 semanas sin equipo = S/ 3,500 perdidos</li>
</ul>

<p>Con el alquiler, el 100% del costo mensual es gasto deducible en el período (<strong>Art. 37 LIR</strong>, principio de causalidad). No hay activo en el balance bajo NIIF 16 (excepción de bajo valor, párrafo 5a, activos bajo ~USD 5,000).</p>

<h2>Lista de verificación: antes del primer día del empleado remoto</h2>

<p>Usa esta lista para asegurarte de que el onboarding remoto es limpio desde el inicio:</p>

<ul>
  <li>☐ Equipo solicitado con al menos 72 horas de anticipación al primer día</li>
  <li>☐ Dirección de entrega confirmada (domicilio del empleado o dirección de trabajo)</li>
  <li>☐ Apple Business Manager configurado en tu empresa (<a href="/blog/apple-business-manager-peru-guia-configuracion-2026">ver guía</a>)</li>
  <li>☐ Cuenta de Apple Gestionada creada para el nuevo empleado</li>
  <li>☐ Perfil MDM con las políticas de tu empresa listo para despliegue</li>
  <li>☐ Lista de apps corporativas a instalar definida (Slack, Zoom, VPN, herramienta de PM)</li>
  <li>☐ Contrato de uso de equipo firmado digitalmente con el empleado</li>
  <li>☐ Proceso de devolución y offboarding documentado en el handbook de la empresa</li>
</ul>

<p>Con esta lista en orden, el primer día del empleado remoto puede empezar con la MacBook lista para trabajar. Sin IT manual. Sin esperas.</p>

<h2>Conclusión</h2>

<p>Equipar un equipo remoto con MacBooks en Perú no tiene que ser complicado ni lento. El modelo clásico de compra —por sus fricciones de procurement, configuración y recuperación— no está diseñado para la velocidad que exige una empresa que contrata talento distribuido.</p>

<p>El alquiler mensual con entrega directa al domicilio del empleado, MDM incluido y zero-touch deployment reduce el tiempo de onboarding de semanas a horas. Cuando el empleado sale, el proceso de recuperación y borrado certificado es igualmente eficiente.</p>

<p><strong>¿Cuántos equipos necesita tu equipo remoto ahora?</strong> <a href="/empresas#cotizar">Cotiza en menos de 3 minutos</a> — recibes propuesta en el día. También puedes escribirnos por <a href="https://wa.me/51900164769">WhatsApp al +51 900 164 769</a>.</p>

<p><strong>Artículos relacionados:</strong></p>
<ul>
  <li><a href="/blog/apple-business-manager-peru-guia-configuracion-2026">Apple Business Manager en Perú: guía de configuración 2026</a></li>
  <li><a href="/blog/mdm-macbook-empresas-peru-guia-completa">MDM para MacBooks en empresas peruanas: guía completa</a></li>
  <li><a href="/blog/proteger-datos-empresa-macbook-alquilada-durante-contrato">Cómo proteger los datos de tu empresa en una MacBook alquilada</a></li>
</ul>`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
