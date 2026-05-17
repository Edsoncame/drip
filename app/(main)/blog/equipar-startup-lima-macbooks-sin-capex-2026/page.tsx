import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "equipar-startup-lima-macbooks-sin-capex-2026";

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

const CONTENT = `<p>Fundaste una startup en Lima. Ya tenés el producto, el equipo inicial y — si tuviste suerte — algo de capital. Ahora viene la pregunta que nadie te enseña en los libros de emprendimiento: <em>¿cómo le doy un MacBook a cada persona nueva que entra, sin que eso te consuma el runway?</em></p>

<p>Equipar un equipo de 10 personas con MacBooks en Perú puede costarte entre S/ 130,000 y S/ 180,000 de golpe si comprás los equipos. Para una startup que recién consiguió su primer cheque de inversión o que está bootstrapped con clientes pagantes, ese desembolso no es trivial. Es la diferencia entre tener o no tener 3-4 meses adicionales de runway.</p>

<p>Esta guía es para founders, CEOs y Heads of Operations que necesitan resolver el tema de equipamiento de manera inteligente — sin cortar esquinas en la calidad del hardware y sin congelar el capital que necesitás para crecer.</p>

<h2>El problema real: el costo de equipar no es solo el precio del hardware</h2>

<p>El precio de lista de una MacBook Air M4 en el Apple Store de Estados Unidos es $1,099 USD. Pero ese no es el precio que pagás en Lima.</p>

<p>Cuando importás o comprás en el mercado local, el precio real incluye:</p>

<ul>
  <li><strong>Precio de importación + aranceles:</strong> El arancel para laptops en Perú es 0% (SA 8471.30.00), pero el IGV de importación (16% + 2% IPM) se aplica sobre el valor CIF.</li>
  <li><strong>Margen del distribuidor local:</strong> Los distribuidores autorizados Apple en Lima (iShop, PC Factory) tienen márgenes que encarecen el equipo entre 15% y 25% sobre el precio directo de Apple.</li>
  <li><strong>Precio de mercado real MacBook Air M4 13" en Lima (2026):</strong> entre S/ 6,800 y S/ 7,500 según el distribuidor y la configuración.</li>
</ul>

<p>Para 10 equipos, estamos hablando de S/ 68,000 a S/ 75,000 solo en hardware. A eso sumás el tiempo de configuración, el sistema de gestión (MDM), los seguros si sos cuidadoso, y la gestión del activo cuando un empleado sale.</p>

<p><strong>El problema no es solo el precio.</strong> Es que ese dinero deja de estar disponible para lo que realmente mueve la aguja de una startup: producto, marketing, ventas y talento.</p>

<h2>La lógica financiera del renting para startups</h2>

<p>Una startup no es una empresa madura. No tiene flujos predecibles ni un historial de crecimiento estable. Por eso, los principios de asignación de capital de una startup son distintos a los de una empresa corporativa de 200 personas.</p>

<p>El principio central es: <strong>no inmovilizás capital en activos que no generan ingresos directamente</strong>. Una laptop es un habilitador — no un generador de ingresos por sí solo. Lo que genera ingresos es el ingeniero que la usa, el diseñador que crea con ella, el account manager que la lleva a reuniones.</p>

<p>El renting convierte un gasto de capital (CAPEX) en un gasto operativo (OPEX). Esto tiene tres consecuencias concretas para una startup peruana:</p>

<ul>
  <li><strong>Preservación del runway:</strong> En lugar de desembolsar S/ 75,000 hoy, pagás S/ 1,700-1,900/mes por 10 equipos Air M4 en plan 24 meses. Eso es S/ 1,700 que salés cada mes, no S/ 75,000 que se van de golpe.</li>
  <li><strong>Gasto 100% deducible:</strong> La cuota mensual de renting es gasto operativo deducible bajo el Art. 37 de la Ley del Impuesto a la Renta (D.Leg. 774). No depreciás activos — declarás el gasto en el mes que ocurre.</li>
  <li><strong>Flexibilidad real:</strong> Si tu startup pasa de 10 a 25 personas en 6 meses, agregás equipos. Si hacés un layoff doloroso, devolvés sin penalidad de valor residual. El renting se adapta a la curva de crecimiento real, no a la proyectada.</li>
</ul>

<h2>¿Cuánto cuesta realmente equipar tu startup con MacBooks? Números 2026</h2>

<p>Tomemos el caso de una startup de software en Lima con 8 personas (5 developers, 1 diseñador, 1 PM, 1 CEO) que necesita MacBooks para todos.</p>

<h3>Escenario A: Compra directa</h3>

<ul>
  <li>5 MacBook Pro 14" M4 (developers + PM): S/ 9,200 c/u × 5 = <strong>S/ 46,000</strong></li>
  <li>2 MacBook Air M4 (CEO + diseñador): S/ 7,200 c/u × 2 = <strong>S/ 14,400</strong></li>
  <li>1 MacBook Pro 14" M4 Pro (diseñador senior): S/ 11,500 = <strong>S/ 11,500</strong></li>
  <li><strong>Total CAPEX inicial: S/ 71,900</strong></li>
  <li>Configuración IT (8h × S/ 60/h): S/ 480</li>
  <li>MDM primer año (Mosyle Business, 8 equipos × $4/mes × 12): S/ 1,824</li>
  <li><strong>Costo año 1 total: S/ 74,204</strong></li>
</ul>

<h3>Escenario B: Renting con FLUX (plan 24 meses)</h3>

<ul>
  <li>5 MacBook Pro 14" M4 a $115/mes: $575/mes</li>
  <li>3 MacBook Air M4 a $85/mes: $255/mes</li>
  <li><strong>Total mensual: $830/mes (≈ S/ 3,154/mes)</strong></li>
  <li>MDM incluido en el contrato: S/ 0 adicional</li>
  <li>Configuración: 30 min por equipo (con MDM pre-configurado) = S/ 0 prácticamente</li>
  <li><strong>Costo año 1: S/ 37,848</strong></li>
  <li>IGV crédito fiscal recuperable en año 1: ≈ S/ 5,786</li>
  <li><strong>Costo neto año 1 post-crédito fiscal: ≈ S/ 32,062</strong></li>
</ul>

<p><strong>Diferencia año 1: S/ 42,142 más en caja</strong> si optás por renting. Para una startup, eso puede ser el sueldo de un developer senior durante 6 meses, o el presupuesto de marketing para validar un canal de adquisición nuevo.</p>

<p>A 24 meses, el costo total del renting supera al de la compra (porque estás pagando por el servicio de uso y soporte). Pero en los primeros 12-18 meses — el período más crítico para una startup — el renting libera capital que puede ser la diferencia entre sobrevivir o no.</p>

<h2>El tema de los equipos ociosos: el costo oculto que nadie mide</h2>

<p>Las startups en etapa temprana rotan talento. No es una opinión — es una realidad del mercado tech en Lima. La rotación en roles de software y diseño puede estar entre 20% y 35% anual.</p>

<p>Cada vez que alguien sale de tu empresa y compraste el equipo, pasan varias cosas:</p>

<ol>
  <li>El equipo queda ocioso mientras encontrás el siguiente hire (puede ser 2-8 semanas).</li>
  <li>Tenés que borrar los datos del equipo de manera segura (si no tenés MDM, esto es manual y arriesgado).</li>
  <li>Si el nuevo hire tiene un perfil distinto, puede que el equipo no sea el adecuado (un developer necesita Pro; un ops no).</li>
  <li>Si decidís no reemplazar ese rol, el equipo queda en un cajón o lo vendés con pérdida.</li>
</ol>

<p>Con renting, cuando un empleado sale, devolvés el equipo o lo reasignás. Si el siguiente hire necesita un tier diferente, pedís el modelo correcto. Sin depósito, sin gestión de activos, sin equipo ocioso acumulando polvo.</p>

<h2>Cómo estructurar el equipamiento de tu startup por etapa de crecimiento</h2>

<p>No todas las startups tienen las mismas necesidades. Acá hay una guía práctica por etapa:</p>

<h3>Pre-seed / Bootstrapped (1-5 personas)</h3>

<p>En esta etapa, el founder probablemente ya tiene su propio equipo. El tema es: <em>¿qué le doy al primer hire?</em></p>

<p>Recomendación: renting en plan 8 meses para validar si el rol se consolida. Si en 8 meses la persona sigue y el rol creció, renovás a plan 24 meses con precio menor. Si el rol cambió, actualizás el equipo sin pérdida.</p>

<h3>Seed / Series A temprana (5-20 personas)</h3>

<p>Acá empieza la contratación acelerada. La lógica es: <strong>estandarizá el hardware por rol, no por persona</strong>.</p>

<ul>
  <li>Developers / Engineers: MacBook Pro 14" M4 (mínimo). El M4 Pro si trabajan con compilaciones pesadas o modelos de ML.</li>
  <li>Diseñadores UX/UI: MacBook Air M4 o Pro 14" M4 según el tipo de trabajo (motion design o 3D → Pro).</li>
  <li>Comerciales / Ops / Marketing: MacBook Air M4. No necesitan más.</li>
  <li>C-suite: MacBook Pro 14" M4. Movilidad + presentaciones + videollamadas simultáneas.</li>
</ul>

<p>Con renting podés mezclar modelos en el mismo contrato. Cada equipo tiene su canon mensual según el modelo — no hay una cuota única para todos.</p>

<h3>Series A / B (20-100 personas)</h3>

<p>A este nivel, el argumento del renting cambia: ya tenés más capital para comprar si quisieras, pero el argumento operativo se vuelve más fuerte. Gestionar una flota de 50+ MacBooks sin MDM profesional es una carga operativa real para el equipo de IT o la persona que lo haga.</p>

<p>El renting con MDM incluido (Apple Business Manager + Mosyle, Jamf o Kandji) resuelve el ciclo completo: aprovisionamiento automático, gestión de apps, borrado remoto, offboarding seguro. Sin ese sistema, cada onboarding de un nuevo equipo toma 3-4 horas manuales de IT.</p>

<h2>El proceso de contratación: de la decisión a los equipos en tu oficina</h2>

<p>Una de las fricciones más comunes al equipar una startup es el tiempo. Procurement corporativo tradicional puede tardar semanas o meses entre la decisión y la entrega. Con FLUX, el proceso completo es:</p>

<ol>
  <li><strong>Día 0 — Decisión:</strong> Entrás a <a href="/laptops">/laptops</a>, ves los precios, calculás cuántos equipos necesitás y en qué plazo. O llenás el formulario en <a href="/empresas#cotizar">/empresas</a> si necesitás una propuesta personalizada con volumen.</li>
  <li><strong>Día 0-1 — Contrato digital:</strong> El contrato se firma electrónicamente (Ley N° 27269). No pedimos garantía ni depósito. Los datos que necesitamos: RUC de la empresa, razón social y dirección de entrega en Lima.</li>
  <li><strong>Día 1-2 — Configuración MDM:</strong> Si ya usás Apple Business Manager, los equipos llegan inscriptos a tu organización. Si no, te ayudamos a configurarlo. El equipo llega listo para usar en menos de 30 minutos desde que sale de la caja.</li>
  <li><strong>Día 2-3 — Entrega:</strong> Entrega en Lima en 24-48 horas hábiles desde la firma del contrato.</li>
  <li><strong>Día 30 — Primera factura:</strong> Factura electrónica SUNAT automática. XML + PDF. Lista para tu contador.</li>
</ol>

<p>Sin reuniones de "te llamamos para coordinar". Sin esperas de aprobación crediticia. Sin formularios para el banco.</p>

<h2>Preguntas frecuentes de founders peruanos</h2>

<h3>¿Necesito un RUC activo para contratar?</h3>
<p>Sí. El contrato se firma a nombre de la empresa con RUC activo. Tika Services S.A.C. (RUC 20605702512) emite la factura electrónica mensual a tu empresa.</p>

<h3>¿Qué pasa si necesito MacBooks urgente esta semana?</h3>
<p>Con firma del contrato hoy, los equipos pueden estar en tu oficina en Lima en 48 horas hábiles. Si el lunes firmás, el miércoles o jueves ya llegaron.</p>

<h3>¿Puedo mezclar modelos (Air + Pro) en el mismo contrato?</h3>
<p>Sí. Cada equipo tiene su propio ítem en el contrato con su canon mensual correspondiente. Podés tener 5 Pro y 3 Air sin problema.</p>

<h3>¿Qué pasa si en 6 meses necesito 10 equipos más?</h3>
<p>Se hace una adenda al contrato original. Los nuevos equipos tienen su propia fecha de inicio y duración. No tenés que esperar que venza el contrato original.</p>

<h3>¿Cómo manejo el offboarding cuando alguien sale?</h3>
<p>Con MDM activo: el equipo se puede borrar remotamente antes o durante la devolución. El nuevo empleado recibe un equipo limpio, configurado con las apps de tu empresa en menos de 30 minutos. Sin IT manual.</p>

<h3>¿Los equipos tienen AppleCare?</h3>
<p>Sí. Los contratos de FLUX incluyen cobertura de garantía del fabricante y los equipos cuentan con AppleCare. Si el hardware falla por defecto de fabricación, se repone sin costo adicional para el cliente.</p>

<h2>Lo que no te dice nadie: el equipo como parte del employer branding</h2>

<p>En el mercado de talento tech en Lima (y en general en Latinoamérica), <strong>el equipo que una empresa le da a sus empleados es parte del employer branding</strong>. No es vanidad — es funcional.</p>

<p>Un developer que trabaja en un equipo de Mac no considera seriamente una oferta donde le van a dar una laptop Windows de gama media. No es capricho: el ecosistema de desarrollo en Mac (Homebrew, terminal nativa, integración con iOS/iPadOS si trabajan en apps móviles, rendimiento de compilación en M4) es objetivamente superior para muchos roles tech.</p>

<p>Si querés atraer talento de primer nivel en Lima, tener MacBooks en tu empresa — y poder decirlo en la oferta de trabajo — es un diferenciador real. No el único, pero sí uno que aparece en las conversaciones.</p>

<p>Con renting, ese diferenciador está disponible desde el primer hire, sin esperar a tener el capital para comprar.</p>

<h2>Conclusión: equipar bien desde el inicio es una decisión estratégica</h2>

<p>Una startup que equipa bien a su equipo desde el inicio tiene menos fricción en el onboarding, menos problemas técnicos en el día a día, y más capacidad para competir por talento. El dilema no es "MacBook o no MacBook" — es "¿cómo pago por esto sin comprometer mi runway?"</p>

<p><strong>Tres puntos para llevarte:</strong></p>

<ul>
  <li><strong>El renting convierte CAPEX en OPEX</strong> — y para una startup, eso puede ser la diferencia entre tener o no tener 3-4 meses adicionales de runway.</li>
  <li><strong>La cuota mensual es 100% deducible como gasto operativo</strong> (Art. 37 LIR) y el IGV es crédito fiscal — tu contador lo puede confirmar.</li>
  <li><strong>La flexibilidad es estructural:</strong> sumás equipos cuando crecés, devolvés cuando necesitás reducir, actualizás modelo cuando hay rotación de rol.</li>
</ul>

<p>Si querés ver los números concretos para tu startup — cuántos equipos, qué modelos, qué plazo — podés <a href="/empresas#cotizar">cotizar en FLUX en minutos</a>. Sin formularios bancarios, sin reuniones previas, sin depósito de garantía.</p>

<p><em>¿Ya tenés claro que el renting es para vos pero querés entender qué modelo elegir? Mirá nuestra <a href="/blog/macbook-air-m4-vs-macbook-pro-m4">comparativa MacBook Air M4 vs Pro M4</a> para decidir según el rol.</em></p>

<p><em>Referencias: D.Leg. 774 (Art. 37 y 57), D.S. 122-94-EF (Art. 22 RLIR), Ley N° 27269 (firma electrónica), precios de mercado Lima abril-mayo 2026 (iShop, PC Factory), tipo de cambio referencial S/ 3.80/USD (BCP mayo 2026).</em></p>`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
