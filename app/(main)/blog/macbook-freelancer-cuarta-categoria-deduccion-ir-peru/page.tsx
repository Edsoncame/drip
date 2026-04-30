import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "macbook-freelancer-cuarta-categoria-deduccion-ir-peru";

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

const CONTENT = `<p>Hay una pregunta que los freelancers peruanos rara vez se hacen: <strong>¿puedo deducir el alquiler de mi MacBook como gasto de cuarta categoría?</strong></p>

<p>La respuesta corta es: en la mayoría de los casos, no —porque la Ley del Impuesto a la Renta aplica una deducción forfetaria del 20% sobre las rentas de cuarta categoría sin permitir gastos adicionales a la mayoría de contribuyentes.</p>

<p>Pero la respuesta larga es más útil. Porque hay casos en que sí aplica una deducción real. Y porque la decisión de alquilar vs. comprar una MacBook tiene otras consecuencias tributarias y financieras que vale entender antes de desembolsar S/6,000 o más en un equipo.</p>

<h2>Cómo tributan los freelancers en Perú: el punto de partida</h2>

<p>Los ingresos por servicios independientes se gravan como <strong>rentas de cuarta categoría</strong> según el Artículo 33 del Decreto Legislativo N° 774 (Texto Único Ordenado de la Ley del Impuesto a la Renta).</p>

<p>Esto incluye a consultores que emiten recibos por honorarios (RxH), diseñadores, desarrolladores, copywriters, fotógrafos que trabajan por proyecto, y abogados, contadores o ingenieros que ejercen de forma independiente.</p>

<p>La mecánica de liquidación es la siguiente: <strong>Base imponible = Ingresos brutos × 80%</strong>. El 20% de deducción es automática y forfetaria. No importa si gastaste S/1,000 o S/50,000 en equipos —la deducción es siempre 20%.</p>

<p>Sobre esa base imponible se aplican las tasas progresivas acumulativas del IR:</p>

<ul>
<li><strong>Hasta 5 UIT (S/ 26,750):</strong> 8%</li>
<li><strong>5 a 20 UIT (S/ 26,750 – S/ 107,000):</strong> 14%</li>
<li><strong>20 a 35 UIT (S/ 107,000 – S/ 187,250):</strong> 17%</li>
<li><strong>35 a 45 UIT (S/ 187,250 – S/ 240,750):</strong> 20%</li>
<li><strong>Más de 45 UIT:</strong> 30%</li>
</ul>

<p><em>Usando UIT 2026 = S/ 5,350 conforme R.S. N° 000013-2026/SUNAT.</em></p>

<h2>La regla general: el 20% no incluye equipos reales</h2>

<p>La deducción del 20% fue diseñada para representar los gastos promedio de un trabajador independiente sin que SUNAT tenga que revisar cada comprobante. Si alquilás una MacBook para trabajar, ese gasto <strong>no se suma</strong> a tu deducción del 20%. Ya está "incluido" en el forfait, lo uses o no.</p>

<p>Desde una perspectiva de IR estricta, el freelancer típico no obtiene un beneficio tributario adicional por alquilar una laptop. La deducción es la misma. ¿Entonces no hay ninguna ventaja? No exactamente. El análisis cambia en tres casos específicos.</p>

<h2>Caso 1: El freelancer que también tiene rentas de tercera categoría</h2>

<p>Si como freelancer también operás a través de una empresa unipersonal, EIRL o sociedad, y esa entidad es quien alquila la MacBook, el gasto sí es deducible de la <strong>renta de tercera categoría</strong> bajo el Artículo 37 de la LIR — principio de causalidad.</p>

<p>Este es el caso más común entre consultores que formalizaron su práctica independiente como persona jurídica.</p>

<p><strong>Ejemplo concreto:</strong></p>
<ul>
<li>Consultora EIRL, régimen MYPE Tributario</li>
<li>Alquila 1 MacBook Air M4: $85/mes = S/ 319/mes (T/C S/3.75)</li>
<li>Gasto anual: S/ 3,828</li>
<li>IGV crédito fiscal: S/ 688/año (18% de S/ 3,828)</li>
<li>IR deducible: S/ 3,828 × 29.5% = <strong>S/ 1,129 de ahorro IR por año</strong></li>
</ul>

<p>El alquiler funciona como gasto operativo, reconocido en el período que se devengó (Art. 57 LIR). No hay activo que depreciar, no hay desembolso inicial.</p>

<h2>Caso 2: Cuarta + quinta categoría simultánea</h2>

<p>Algunos profesionales combinan trabajo dependiente (quinta categoría, en planilla) con servicios independientes (cuarta categoría). La renta global combinada puede hacer que el freelancer caiga en un tramo impositivo más alto.</p>

<p>En este escenario, <strong>minimizar los ingresos netos de cuarta categoría</strong> tiene más impacto. El alquiler de una MacBook sigue sin ser deducible adicional en cuarta categoría pura, pero la conversión a tercera (si el volumen lo justifica) sí abre esa posibilidad.</p>

<h2>Caso 3: Deducciones adicionales del Art. 46-A LIR</h2>

<p>Desde 2017, la Ley N° 30498 introdujo <strong>3 UIT adicionales</strong> (S/ 16,050 para 2026) por gastos específicos con comprobante de pago electrónico. Los gastos permitidos incluyen arrendamiento de inmuebles, servicios médicos, hoteles y restaurantes 4-5 tenedores, y servicios profesionales de abogados, contadores o ingenieros.</p>

<p><strong>Lo que NO está incluido:</strong> arrendamiento de equipos (laptops, cámaras, instrumentos). El alquiler de una MacBook no entra en este mecanismo. Es un punto técnico importante que muchos confunden.</p>

<h2>Entonces, ¿cuándo conviene alquilar para un freelancer?</h2>

<p>La deducción tributaria no es el argumento principal. Los argumentos financieros y operativos son más sólidos.</p>

<h3>El costo de oportunidad del capital</h3>

<p>Una MacBook Pro M4 nueva en Perú cuesta entre S/ 9,000 y S/ 14,000 según configuración (precios abril 2026). Para un freelancer con ingresos variables, <strong>inmovilizar S/ 12,000 en un activo que se deprecia</strong> tiene un costo real. Si ese capital estuviera en un depósito a plazo bancario (tasa promedio 6-8% anual), generaría entre S/ 720 y S/ 960 anuales. Si se reinvirtiera en cursos o certificaciones, el retorno puede ser mucho mayor.</p>

<p>Con el alquiler: no hay desembolso inicial, el equipo está cubierto ante fallas de hardware, podés cambiar de modelo si cambia tu tipo de trabajo, y podés devolver el equipo si necesitás reducir gastos.</p>

<h3>La depreciación real del equipo</h3>

<p>La depreciación tributaria de equipos de cómputo es 25% anual (Art. 22 RLIR, D.S. 122-94-EF). Pero la depreciación de mercado en Lima es más agresiva:</p>

<ul>
<li><strong>Hoy:</strong> MacBook Pro M4 ≈ S/ 13,000</li>
<li><strong>Año 1:</strong> ≈ S/ 10,500 (pérdida S/ 2,500)</li>
<li><strong>Año 2:</strong> ≈ S/ 8,200 (pérdida S/ 2,300)</li>
<li><strong>Año 3:</strong> ≈ S/ 6,500 (pérdida S/ 1,700)</li>
<li><strong>Año 4:</strong> ≈ S/ 5,000 (pérdida S/ 1,500)</li>
</ul>

<p>En 4 años habrás absorbido S/ 8,000 en depreciación de mercado. Eso es un costo real aunque no lo veas en ningún estado de resultados. Con el alquiler, no absorbés depreciación —tu capital siguió intacto o trabajando.</p>

<h3>Acceso al chip M4/M5 sin pago anticipado</h3>

<p>Para freelancers en diseño, video, desarrollo de software o arquitectura, <strong>el chip Apple M4 y M5 no son un lujo — son productividad directa</strong>. Un render que en una Mac Intel tardaba 28 minutos, en M4 tarda 6 (benchmark Puget Systems, ProRes 4K 30min). Una compilación en Xcode que tardaba 4 minutos, en M4 tarda menos de 2.</p>

<p>Si tu tarifa por hora es S/ 100, cada minuto que tardás más tiene un costo medible. Con alquiler, accedés al chip de última generación desde el primer mes sin un desembolso de S/ 12,000.</p>

<h2>Cuánto paga un freelancer que alquila vs. compra</h2>

<p>Veamos un caso concreto: <strong>diseñador UX, ingresos anuales S/ 84,000 brutos, cuarta categoría pura.</strong></p>

<ul>
<li>Ingresos brutos: S/ 84,000</li>
<li>Deducción 20%: -S/ 16,800</li>
<li>Renta neta de cuarta: S/ 67,200</li>
<li>Deducción 5 UIT: -S/ 26,750</li>
<li>Renta neta imponible: S/ 40,450</li>
<li>IR a pagar: ~S/ 4,500 aprox.</li>
</ul>

<p>Si alquila una MacBook Air M4 ($85/mes × 12 = S/ 3,825/año): el gasto de alquiler <strong>no modifica su liquidación de IR</strong>. Pero no desembolsa S/ 9,000 iniciales para comprar el equipo. Mantiene S/ 9,000 disponibles para capital de trabajo o inversión.</p>

<p><strong>Conclusión numérica:</strong> el alquiler no reduce el IR, pero mejora el flujo de caja en S/ 9,000 el año 1 y distribuye el costo en cuotas predecibles.</p>

<h2>Qué necesitás para alquilar en FLUX como freelancer</h2>

<p>FLUX no requiere documentación financiera compleja. El proceso es simple:</p>

<ol>
<li>Elegí el modelo: MacBook Air M4 (desde $85/mes) o MacBook Pro M4/M5 (desde $115/mes)</li>
<li>Seleccioná el plazo: 8, 16 o 24 meses</li>
<li>Completá el formulario en <a href="https://fluxperu.com/empresas">fluxperu.com/empresas</a></li>
<li>Recibís una cotización con el desglose mensual</li>
<li>Firmás el contrato digitalmente (Ley N° 27269 — firma electrónica válida en Perú)</li>
<li>Entrega en Lima en 24-48 horas</li>
</ol>

<p>Emitimos <strong>factura electrónica SUNAT</strong> por cada cuota. Si tu práctica independiente se formaliza como persona jurídica, esa factura es el sustento del gasto deducible de tercera categoría.</p>

<h2>Preguntas frecuentes</h2>

<h3>¿Puedo usar el alquiler para reducir las retenciones de cuarta categoría?</h3>
<p>No directamente. La retención del 8% se aplica sobre el ingreso bruto. El alquiler de un equipo no modifica la base de retención para rentas de cuarta categoría puras.</p>

<h3>¿El alquiler de una habitación para oficina en casa sí es deducible?</h3>
<p>El subarrendamiento de un espacio para oficina sí puede aplicar como deducción adicional bajo Ley N° 30498, con el comprobante del propietario del inmueble. Diferente al alquiler de equipos, que no está contemplado.</p>

<h3>¿Me conviene pasar a tercera categoría para deducir gastos reales?</h3>
<p>Depende del volumen de ingresos y del nivel de gastos operativos reales. Si tus gastos superan el 20% de tus ingresos, puede ser conveniente. Consultá con un contador tributarista —la transición tiene implicancias en RUC, régimen y obligaciones contables.</p>

<h3>¿FLUX emite factura a personas naturales con RUC?</h3>
<p>Sí. Si tenés RUC activo como persona natural con negocio, emitimos la factura a tu RUC. El tratamiento tributario posterior depende de tu régimen.</p>

<h2>Conclusión</h2>

<p>Para el freelancer de cuarta categoría pura, <strong>el alquiler de una MacBook no genera una deducción adicional de IR</strong> más allá del 20% forfetario ya establecido por ley. Ese es el punto técnico que más se confunde.</p>

<p>Pero la decisión de alquilar vs. comprar no es solo tributaria. Es una decisión de flujo de caja, de riesgo tecnológico y de acceso a potencia cuando la necesitás. En esos tres frentes, el alquiler tiene ventajas concretas para un freelancer que quiere mantener su capital líquido y su equipo siempre actualizado.</p>

<p>Si tenés ingresos como persona jurídica —aunque sea una EIRL pequeña— la factura de FLUX sí es gasto deducible de tercera categoría y los números cambian significativamente.</p>

<p>¿Querés ver cuánto te costaría equiparte con una MacBook Air M4 en 12 o 24 meses? <a href="https://fluxperu.com/empresas#cotizar">Calculá tu cotización aquí →</a></p>`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
