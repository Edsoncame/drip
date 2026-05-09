import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "renting-tecnologico-peru-guia-2026";

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

const CONTENT = `<p>Cada año, miles de empresas en Lima enfrentan la misma decisión: necesitan renovar o ampliar su flota de equipos tecnológicos, pero el presupuesto de capital no alcanza — o simplemente no quieren inmovilizarlo en activos que en tres años valen la mitad.</p>

<p>La solución que están adoptando se llama <strong>renting tecnológico</strong>. Y aunque en el mercado peruano se usan los términos "renting", "leasing operativo" y "alquiler de equipos" casi como sinónimos, hay diferencias importantes que un gerente o contador debería entender antes de firmar un contrato.</p>

<p>Esta guía explica qué es el renting tecnológico, cómo se diferencia del leasing, qué dice la legislación peruana al respecto, y en qué casos es la mejor decisión financiera para tu empresa.</p>

<h2>¿Qué es el renting tecnológico?</h2>

<p><strong>El renting tecnológico es un contrato de arrendamiento operativo de equipos</strong> — laptops, servidores, tablets, accesorios — por un plazo definido (generalmente 6 a 36 meses), en el que la empresa paga una cuota mensual fija y devuelve los equipos al vencimiento.</p>

<p>El proveedor mantiene la propiedad de los equipos durante todo el contrato. La empresa usuaria registra el gasto como arrendamiento operativo, no como activo en su balance.</p>

<p>En términos prácticos, el renting tecnológico tiene tres características que lo definen:</p>

<ul>
  <li><strong>Cuota fija mensual todo incluido</strong> — sin sorpresas de mantenimiento ni depreciación contable</li>
  <li><strong>Flexibilidad al vencimiento</strong> — devolver, renovar o cambiar por equipos más nuevos</li>
  <li><strong>Sin opción de compra obligatoria</strong> — aunque algunos proveedores la ofrecen como opción adicional</li>
</ul>

<p>Esta última característica es clave. La distingue del leasing financiero, donde la opción de compra es parte estructural del contrato.</p>

<h2>Renting vs Leasing: las diferencias que tu contador necesita conocer</h2>

<p>En Perú, los términos se confunden con frecuencia. El mercado llama "leasing" a casi cualquier forma de financiamiento de activos, pero legalmente son instrumentos distintos con implicancias tributarias y contables diferentes.</p>

<table>
  <thead>
    <tr>
      <th>Dimensión</th>
      <th>Renting Tecnológico</th>
      <th>Leasing Operativo</th>
      <th>Leasing Financiero</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Marco legal</strong></td>
      <td>Arrendamiento civil (Código Civil)</td>
      <td>Arrendamiento operativo (NIIF 16)</td>
      <td>D.Leg. 299 (Ley de Arrendamiento Financiero)</td>
    </tr>
    <tr>
      <td><strong>Propietario del equipo</strong></td>
      <td>Proveedor</td>
      <td>Proveedor</td>
      <td>Banco / empresa financiera</td>
    </tr>
    <tr>
      <td><strong>Opción de compra</strong></td>
      <td>Opcional (no estructural)</td>
      <td>No contemplada</td>
      <td>Sí — obligatoria al vencimiento</td>
    </tr>
    <tr>
      <td><strong>Registro contable NIIF</strong></td>
      <td>Off-balance (excepción bajo valor)</td>
      <td>NIIF 16 (puede activarse en balance)</td>
      <td>Activo por derecho de uso + pasivo financiero</td>
    </tr>
    <tr>
      <td><strong>Deducibilidad IR</strong></td>
      <td>Cuota como gasto operativo (Art. 37 LIR)</td>
      <td>Cuota como gasto operativo (Art. 37 LIR)</td>
      <td>Depreciación acelerada (beneficio D.Leg. 299)</td>
    </tr>
    <tr>
      <td><strong>Intermediario</strong></td>
      <td>Proveedor tecnológico directo</td>
      <td>Empresa de renting / leasing</td>
      <td>Banco o empresa financiera regulada SBS</td>
    </tr>
    <tr>
      <td><strong>Documentación requerida</strong></td>
      <td>Mínima (contrato + factura electrónica)</td>
      <td>Media</td>
      <td>Alta (estados financieros, historial crediticio)</td>
    </tr>
    <tr>
      <td><strong>Flexibilidad</strong></td>
      <td>Alta</td>
      <td>Media</td>
      <td>Baja — compromisos a largo plazo</td>
    </tr>
  </tbody>
</table>

<h3>¿Por qué el D.Leg. 299 no aplica al renting?</h3>

<p>El <strong>Decreto Legislativo 299</strong>, promulgado en 1984 y actualizado en varias ocasiones, regula específicamente el <strong>arrendamiento financiero</strong> en Perú. Sus características: interviene una empresa financiera regulada por la SBS como arrendador, el arrendatario tiene derecho de compra al valor residual, y los bienes se activan en el balance del arrendatario desde el inicio.</p>

<p>El renting tecnológico no entra dentro de este marco porque el arrendador es un proveedor tecnológico (no una empresa financiera) y no existe opción de compra obligatoria. El sustento legal es el <strong>Código Civil peruano</strong> (contrato de arrendamiento) y el <strong>D.S. 055-99-EF</strong> (IGV). La deducibilidad tributaria se rige por el <strong>Art. 37 del D.Leg. 774 (LIR)</strong>.</p>

<h2>Cómo se trata contablemente el renting de equipos en Perú</h2>

<p>Este punto suele generar más preguntas que cualquier otro. La respuesta depende del valor y duración del contrato.</p>

<h3>NIIF 16 y la excepción de bajo valor</h3>

<p>Desde que el Perú adoptó las NIIF, el estándar <strong>NIIF 16 (Arrendamientos)</strong> obliga a reconocer en el balance un activo por derecho de uso y el pasivo correspondiente para la mayoría de arrendamientos. Sin embargo, el <strong>párrafo 5(a) de NIIF 16 establece una excepción para activos de bajo valor</strong> — activos cuyo valor nuevo es menor a USD 5,000.</p>

<p><strong>Los equipos del renting tecnológico típicamente califican para esta excepción.</strong> Una MacBook Air M4 tiene un precio de referencia en Perú de aproximadamente USD 1,200-1,500. Incluso la MacBook Pro 14" M5 se sitúa por debajo del umbral NIIF 16.</p>

<p>Esto significa que la empresa registra la cuota mensual directamente como gasto en el período, sin activar nada en el balance. El registro contable recomendado:</p>

<ul>
  <li>Dr. <strong>6361 — Arrendamiento de equipo de cómputo</strong> (base imponible)</li>
  <li>Dr. <strong>4011 — IGV por pagar</strong> (crédito fiscal 18%)</li>
  <li>Cr. <strong>4212 — Cuentas por pagar comerciales</strong> (total factura)</li>
</ul>

<h3>La factura electrónica como sustento obligatorio</h3>

<p>Para deducir el gasto de arrendamiento en el IR de tercera categoría, el documento sustentatorio debe ser una <strong>factura electrónica emitida por el proveedor ante SUNAT</strong> a nombre de la empresa (Resolución de Superintendencia 007-99/SUNAT y modificatorias). Una boleta de venta o recibo no son suficiente sustento para deducir gastos corporativos.</p>

<p>Verifica que tu proveedor de renting emita facturas electrónicas vinculadas a tu RUC en cada cuota mensual.</p>

<h2>¿Por qué el renting tecnológico está creciendo en Lima?</h2>

<p>Hay cuatro razones estructurales que explican el crecimiento del renting en el mercado peruano, especialmente entre empresas de 10 a 100 personas.</p>

<h3>1. El costo real de comprar es más alto de lo que parece</h3>

<p>Una MacBook Air M4 en tiendas autorizadas en Perú cuesta entre S/5,200 y S/5,800 (según configuración, al tipo de cambio de mayo 2026). Para una empresa que necesita equipar a 10 empleados, eso es entre S/52,000 y S/58,000 de CAPEX inmediato.</p>

<p>Ese monto no incluye seguro de equipos, soporte técnico, configuración inicial (instalación de software, políticas de seguridad), ni el costo de oportunidad del capital inmovilizado. Con renting, esos 10 equipos cuestan aproximadamente S/3,200/mes. En 12 meses: S/38,400 — con la opción de renovar por equipos más nuevos al vencimiento.</p>

<h3>2. La tecnología se vuelve obsoleta en 3-4 años</h3>

<p><strong>La tasa de depreciación tributaria de los equipos de procesamiento de datos es 25% anual</strong> (Art. 22 del D.S. 122-94-EF, Reglamento de la LIR). Eso implica una vida útil tributaria de 4 años. En la práctica, el ciclo real de obsolescencia en equipos Apple está entre 3 y 5 años. Con renting, simplemente renovás al vencimiento del contrato.</p>

<h3>3. La rotación de personal hace que los activos queden ociosos</h3>

<p>Perú tiene una tasa de rotación de personal en sectores tecnológicos y de servicios que oscila entre 20% y 35% anual. Cuando un empleado sale, la laptop queda en el almacén — pero el activo sigue figurando en el balance, depreciándose, y generando un costo de oportunidad real. Con renting, si un empleado sale, simplemente dejás de pagar esa cuota al vencimiento del período mínimo pactado.</p>

<h3>4. Los equipos Mac tienen un diferencial de productividad documentado</h3>

<p>Los equipos Apple con chip M4 y M5 muestran ventajas de rendimiento en tareas profesionales que impactan directamente en horas de trabajo. Export de video 4K en Final Cut Pro (30 minutos): MacBook Air M4 tarda ~6 minutos vs laptop Intel i9 comparable ~28 minutos (fuente: Puget Systems, 2025). Para equipos de desarrollo, diseño o producción audiovisual, estas diferencias se traducen en horas productivas adicionales por semana.</p>

<h2>¿En qué casos el renting tecnológico conviene más que comprar?</h2>

<p>No es una solución universal. Hay escenarios donde claramente conviene, y otros donde la compra directa puede tener más sentido.</p>

<h3>Conviene más el renting cuando:</h3>

<ul>
  <li><strong>Tienes un equipo en crecimiento.</strong> Si en los próximos 12 meses vas a contratar 3-5 personas más, el renting te permite escalar sin nuevo CAPEX cada vez.</li>
  <li><strong>Tienes alta rotación de personal.</strong> Evitás equipos ociosos en el almacén.</li>
  <li><strong>Necesitás tecnología actualizada de forma continua.</strong> Al vencer el contrato, renovás por el modelo más nuevo.</li>
  <li><strong>Querés optimizar tu posición tributaria.</strong> El gasto mensual es 100% deducible en el período en que se devenga (Art. 57 LIR), sin depender del calendario de depreciación.</li>
  <li><strong>No querés comprometer capital en equipos.</strong> Podés usar ese capital en crecimiento, marketing o producto.</li>
  <li><strong>Necesitás factura electrónica con tu RUC en cada cuota.</strong> El renting genera sustento tributario limpio cada mes.</li>
</ul>

<h3>Puede ser más conveniente comprar cuando:</h3>

<ul>
  <li>Tu empresa es muy estable, sin crecimiento proyectado ni rotación de personal.</li>
  <li>Los equipos son de uso muy básico (ofimática simple) donde la obsolescencia es lenta.</li>
  <li>Ya tienes capital disponible y no hay mejor uso para él.</li>
  <li>El volumen es de 1-2 equipos solamente — el overhead administrativo puede no justificarse.</li>
</ul>

<h2>Qué incluye (y qué no incluye) un contrato de renting tecnológico</h2>

<p>Un contrato de renting bien estructurado debe especificar claramente:</p>

<h3>Lo que sí debe incluir:</h3>

<ul>
  <li>Modelo y especificación técnica exacta del equipo</li>
  <li>Cuota mensual fija (en soles o dólares con regla de conversión)</li>
  <li>Plazo mínimo y condiciones de renovación</li>
  <li>Condiciones de devolución al vencimiento</li>
  <li>Proceso en caso de daño accidental (¿quién cubre qué?)</li>
  <li>Condiciones de reemplazo por equipo equivalente en caso de falla</li>
</ul>

<h3>Señales de alerta en un contrato:</h3>

<ul>
  <li>Cláusulas de renovación automática sin notificación previa</li>
  <li>Penalidades desproporcionadas por devolución anticipada</li>
  <li>Sin cláusula de reemplazo por falla técnica</li>
  <li>Proveedor que no emite factura electrónica o emite boleta</li>
</ul>

<h2>El mercado de renting tecnológico en Perú: quiénes ofrecen el servicio</h2>

<p>El mercado peruano de renting de equipos tecnológicos está dominado por dos tipos de proveedores.</p>

<p><strong>Proveedores generalistas (flota mixta, múltiples marcas):</strong> Empresas como Leasein, Renta Equipos Perú o la división de renting de grandes distribuidores tecnológicos. Operan principalmente con Windows (HP, Dell, Lenovo), atienden a empresas medianas y grandes (20+ equipos), y requieren evaluación crediticia y documentación financiera. No suelen estar especializados en Apple.</p>

<p><strong>Proveedores especializados en Apple:</strong> <a href="/laptops">FLUX</a> es el único proveedor en Perú especializado exclusivamente en MacBooks — Air M4, Pro M4 y Pro M5. Proceso 100% digital, sin evaluación crediticia, entrega en 24-48h en Lima, con MDM (gestión remota de dispositivos) incluido y factura electrónica automática en cada cuota. Desde $85/mes por MacBook Air M4.</p>

<h2>Preguntas frecuentes sobre renting tecnológico en Perú</h2>

<h3>¿Puedo deducir el renting de laptops si soy persona jurídica (tercera categoría)?</h3>
<p>Sí. El arrendamiento de equipos de cómputo es deducible como gasto operativo bajo el Art. 37 del D.Leg. 774 (LIR), siempre que cumpla el principio de causalidad (uso para generar renta) y esté sustentado con factura electrónica a nombre de la empresa.</p>

<h3>¿El renting de laptops activa un pasivo en el balance bajo NIIF 16?</h3>
<p>No, si el valor del equipo es menor a USD 5,000 (párrafo 5a NIIF 16). Todos los modelos de MacBook de gama profesional accesible califican para esta excepción de bajo valor.</p>

<h3>¿Cómo se maneja el IGV del renting?</h3>
<p>El IGV (18%) sobre la cuota mensual es crédito fiscal deducible para empresas inscritas en el régimen de IGV. Por ejemplo, si la cuota mensual es S/357 por una MacBook Air M4, el IGV crédito fiscal es S/64.26/mes por equipo — que se deduce de tu obligación de IGV mensual ante SUNAT.</p>

<h3>¿Qué pasa si necesito más equipos a mitad del contrato?</h3>
<p>Los proveedores de renting suelen manejar esto con contratos individuales por equipo o con addendas al contrato principal. En FLUX, podés agregar equipos en cualquier momento con el mismo proceso — sin trámites adicionales.</p>

<h2>Conclusión: el renting tecnológico como decisión estratégica</h2>

<p>El renting tecnológico en Perú no es solo una forma de financiar equipos. Es una decisión estratégica sobre cómo tu empresa gestiona su infraestructura tecnológica: con flexibilidad, sin carga de activos en el balance, y con previsibilidad en el flujo de caja.</p>

<p>Para empresas en crecimiento, con alta rotación de personal, o que necesitan mantener a su equipo en la tecnología más actualizada, el renting suele ser la opción más inteligente. La deducibilidad tributaria completa, la excepción NIIF 16 de bajo valor, y la eliminación del riesgo de obsolescencia hacen que el análisis financiero raramente favorezca la compra.</p>

<p><strong>Los puntos clave que llevarte:</strong></p>

<ul>
  <li>El renting tecnológico es legalmente distinto al leasing financiero (D.Leg. 299) — no requiere intermediario bancario ni opción de compra obligatoria</li>
  <li>El gasto es 100% deducible en IR bajo el principio de causalidad (Art. 37 LIR)</li>
  <li>Los equipos de bajo valor (&lt; USD 5,000) no activan pasivos en el balance (NIIF 16, párrafo 5a)</li>
  <li>La factura electrónica mensual es el sustento tributario obligatorio para deducir el gasto</li>
  <li>En Perú, FLUX es el único proveedor especializado en MacBooks con proceso 100% digital y MDM incluido</li>
</ul>

<p>¿Querés evaluar si el renting de MacBooks es la decisión correcta para tu empresa? <a href="/empresas#cotizar">Pedí una cotización sin compromiso</a> — respondemos en menos de 30 minutos en horario laboral.</p>`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
