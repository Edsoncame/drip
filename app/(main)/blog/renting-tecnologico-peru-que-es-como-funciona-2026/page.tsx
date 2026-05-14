import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "renting-tecnologico-peru-que-es-como-funciona-2026";

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

const CONTENT = `<p>Hay una pregunta que recibo seguido cuando alguien pide una cotización a FLUX: <em>"¿Esto es leasing o es alquiler?"</em></p>

<p>La pregunta es válida. En Perú, los términos "leasing", "renting" y "alquiler de equipos" se usan de forma intercambiable, a veces incorrectamente, y eso genera confusión a la hora de tomar decisiones financieras, contables y tributarias.</p>

<p>Este artículo pone orden en esa terminología. Explica qué es exactamente el renting tecnológico, en qué se diferencia del leasing operativo y del leasing financiero, cuál es el marco legal en Perú, cuándo conviene cada opción y por qué empresas de 10 a 150 personas están migrando hacia este modelo.</p>

<h2>¿Qué es el renting tecnológico?</h2>

<p>El <strong>renting tecnológico</strong> es un contrato de uso temporal de equipos (laptops, tablets, servidores, impresoras) bajo un canon mensual fijo, sin opción de compra al final del contrato y sin transferencia de riesgos de propiedad al usuario.</p>

<p>En términos simples: usás el equipo, pagás una cuota mensual, y al vencer el plazo lo devolvés. No hay cuota inicial, no hay activo en tu balance, no hay gestión de depreciación.</p>

<p><strong>Tres características lo distinguen de otros modelos:</strong></p>
<ul>
  <li><strong>Sin opción de compra obligatoria.</strong> Podés renovar, devolver o actualizar el equipo al terminar el contrato.</li>
  <li><strong>El equipo sigue siendo propiedad del proveedor.</strong> Vos sos usuario, no propietario. Esto tiene consecuencias contables relevantes.</li>
  <li><strong>El mantenimiento y la reposición suelen estar incluidos.</strong> En contratos bien estructurados, si el equipo falla, el proveedor lo repone.</li>
</ul>

<p>El renting tecnológico no es un concepto nuevo: en Europa, más del 60% de las empresas medianas gestionan sus equipos informáticos bajo contratos de renting (Fuente: IDC Europe Financing Index 2024). En Latinoamérica, el modelo está creciendo, con Colombia, Chile y México a la delantera. Perú está en etapa temprana — y esa es la oportunidad.</p>

<h2>La confusión terminológica en Perú: renting vs. leasing vs. alquiler</h2>

<p>En Perú, el término "leasing" es el más difundido, pero se usa para referirse a tres figuras jurídicas distintas. Aclarar esto no es un detalle técnico — afecta cómo declarás tus impuestos, cómo llevás la contabilidad y qué flexibilidad tenés.</p>

<h3>Leasing financiero (arrendamiento financiero)</h3>

<p>Regulado por el <strong>Decreto Legislativo N° 299</strong>. Es una operación financiera donde:</p>
<ul>
  <li>El banco o empresa financiera compra el activo a nombre de la empresa.</li>
  <li>La empresa lo usa y paga cuotas mensuales que incluyen capital + intereses.</li>
  <li>Al final del contrato, la empresa <strong>tiene la opción de compra</strong> al precio residual pactado.</li>
  <li>El activo se activa en el balance del arrendatario desde el inicio.</li>
  <li>La empresa asume el riesgo de obsolescencia y mantenimiento.</li>
</ul>
<p><strong>Quién lo usa:</strong> Empresas que quieren el activo en su balance para financiar maquinaria, vehículos o equipos de alto valor. Requiere evaluación crediticia, garantías y proceso de aprobación que puede tardar semanas.</p>

<h3>Leasing operativo (arrendamiento operativo)</h3>

<p>No está regulado por el D.Leg. 299. Es un contrato civil de uso. Características:</p>
<ul>
  <li>Sin opción de compra (o con opción a precio de mercado, no residual).</li>
  <li>El activo <strong>no se activa en el balance</strong> del usuario bajo las condiciones habituales.</li>
  <li>El proveedor asume el riesgo de obsolescencia.</li>
  <li>La cuota mensual es gasto operativo, deducible en su totalidad como arrendamiento (Art. 37 LIR).</li>
</ul>

<h3>Renting tecnológico</h3>

<p>El renting es, en la práctica, un <strong>leasing operativo con servicios adicionales incluidos</strong>. La diferencia es que el contrato de renting típicamente incluye seguro del equipo, soporte técnico, reposición en caso de falla, gestión MDM (en proveedores especializados como FLUX) y factura electrónica automática.</p>

<h3>Tabla comparativa</h3>

<table>
  <thead>
    <tr>
      <th>Dimensión</th>
      <th>Leasing Financiero</th>
      <th>Leasing Operativo</th>
      <th>Renting Tecnológico</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Marco legal</td>
      <td>D.Leg. 299</td>
      <td>Código Civil</td>
      <td>Código Civil</td>
    </tr>
    <tr>
      <td>Opción de compra</td>
      <td>Sí (precio residual)</td>
      <td>No (o precio de mercado)</td>
      <td>No (o precio de mercado)</td>
    </tr>
    <tr>
      <td>Activo en balance</td>
      <td>Sí</td>
      <td>Depende (NIIF 16)</td>
      <td>No (excepción bajo valor)</td>
    </tr>
    <tr>
      <td>Riesgo de obsolescencia</td>
      <td>Empresa</td>
      <td>Proveedor</td>
      <td>Proveedor</td>
    </tr>
    <tr>
      <td>Evaluación crediticia</td>
      <td>Sí (banco)</td>
      <td>No necesaria</td>
      <td>No necesaria</td>
    </tr>
    <tr>
      <td>Servicios incluidos</td>
      <td>No</td>
      <td>Parcialmente</td>
      <td>Sí (mantenimiento, soporte, MDM)</td>
    </tr>
    <tr>
      <td>Deducible como gasto</td>
      <td>Depreciación + intereses</td>
      <td>Cuota completa</td>
      <td>Cuota completa</td>
    </tr>
  </tbody>
</table>

<h2>El marco legal del renting en Perú</h2>

<p>Uno de los errores más frecuentes es aplicar el D.Leg. 299 a un contrato de renting. No corresponde. El renting tecnológico en Perú opera bajo el <strong>Código Civil (arrendamiento)</strong> para efectos contractuales.</p>

<p>Para efectos tributarios, aplican:</p>

<p><strong>Artículo 37 del D.Leg. 774 (Ley del Impuesto a la Renta):</strong> Los gastos necesarios para generar renta de tercera categoría son deducibles bajo el principio de causalidad. El arrendamiento de equipos para uso operativo cumple este principio. Es gasto del período en que se devengó (Art. 57 LIR).</p>

<p><strong>Artículo 18 del D.Leg. 821 (Ley del IGV):</strong> El IGV pagado en la cuota mensual de renting es crédito fiscal, siempre que el comprobante sea factura electrónica válida ante SUNAT y el gasto sea de naturaleza operativa.</p>

<p><strong>NIIF 16 — excepción de bajo valor (párrafo 5a):</strong> El párrafo 5a establece una excepción explícita para activos de bajo valor cuyo valor de mercado nuevo no supera los USD 5,000. En la práctica para la mayoría de empresas peruanas, la cuota mensual de renting es gasto operativo, el IGV es crédito fiscal, y el equipo no entra al balance.</p>

<h2>¿Por qué el renting tecnológico está creciendo en Perú?</h2>

<p>Hay cuatro razones concretas:</p>

<h3>1. La tecnología se vuelve obsoleta antes de que termine de depreciarse</h3>

<p>La vida útil tributaria de un equipo de cómputo en Perú es <strong>4 años</strong> (depreciación 25% anual, Art. 22 RLIR). En la práctica, el ciclo de renovación real de una laptop en trabajo intensivo es 3 años. El chip M4 tiene un 35% más de rendimiento que el M1 (Fuente: Apple benchmark 2024). Comprar hoy significa quedarte con un activo rezagado que todavía no terminaste de depreciar.</p>

<h3>2. El capital inmovilizado tiene un costo real</h3>

<p>Comprar 10 MacBook Air M4 en Lima cuesta aproximadamente S/ 181,300. Ese capital podría estar en capital de trabajo, marketing o talento. El <strong>costo de oportunidad</strong> del capital inmovilizado en laptops no aparece en el estado de resultados, pero existe.</p>

<h3>3. La gestión de flotas es más costosa de lo que parece</h3>

<p>Comprar equipos implica: inventariado, seguros, mantenimiento, rotación cuando un empleado sale, venta o disposición al final de su vida útil y gestión de garantías con Apple. Con renting bien estructurado (con MDM incluido), el onboarding de un nuevo equipo toma menos de 30 minutos.</p>

<h3>4. La flexibilidad es estructural para empresas en crecimiento</h3>

<p>Una empresa que crece de 10 a 40 personas en 18 meses no sabe exactamente cuántos equipos va a necesitar. El renting permite escalar en incrementos de 1, ajustar el tier de equipo según el rol que entra, y reducir si hay una restructuración.</p>

<h2>¿Para qué tipo de empresa tiene más sentido el renting?</h2>

<h3>El renting conviene cuando:</h3>
<ul>
  <li>Tu equipo usa MacBooks y el precio de compra supera tus posibilidades de CAPEX inmediato.</li>
  <li>Rotás empleados con frecuencia (equipos tech, diseño, comerciales).</li>
  <li>Estás en modo crecimiento rápido y no querés comprometer capital en activos.</li>
  <li>No tenés un equipo IT dedicado y querés que alguien más gestione el MDM y el soporte.</li>
</ul>

<h3>Comprar tiene sentido cuando:</h3>
<ul>
  <li>Tenés más de 5 años de estabilidad operativa y tu flota es predecible.</li>
  <li>Usás Windows exclusivamente.</li>
  <li>Podés negociar precios corporativos directamente con distribuidores Apple (a partir de 50+ unidades).</li>
</ul>

<h2>Cómo funciona el renting tecnológico en la práctica (el proceso FLUX)</h2>

<p><strong>Paso 1 — Cotización (día 0):</strong> Seleccionás el modelo (Air M4, Pro M4 o Pro M5), la cantidad de equipos y el plazo (8, 16 o 24 meses). En <a href="/laptops">fluxperu.com/laptops</a> podés ver los precios directamente, sin formulario ni llamada previa.</p>

<p><strong>Paso 2 — Contrato (días 1-2):</strong> El contrato es digital (firma electrónica bajo Ley N° 27269). Sin garantías ni depósitos. Sin evaluación crediticia bancaria. Solo necesitamos: RUC, razón social y dirección de entrega.</p>

<p><strong>Paso 3 — Entrega (días 2-3):</strong> Los equipos se entregan en Lima en 24-48 horas hábiles. Vienen con MDM pre-configurado si el cliente lo requiere (Apple Business Manager + Mosyle Business).</p>

<p><strong>Paso 4 — Facturación (mensual):</strong> La factura electrónica (XML + PDF) se emite automáticamente cada mes. Válida ante SUNAT, con el detalle del canon de arrendamiento para tu declaración de IR.</p>

<p><strong>Paso 5 — Renovación o devolución:</strong> Al terminar el contrato podés renovar (con opción a actualizar al modelo de siguiente generación), devolver los equipos sin costo adicional, o acordar una opción de compra a precio de mercado.</p>

<h2>Preguntas frecuentes que hacen los CFOs y contadores</h2>

<p><strong>¿El canon de renting es 100% deducible como gasto operativo?</strong><br>
Sí, bajo el principio de causalidad del Art. 37 LIR. Siempre que el equipo sea usado en la generación de renta de tercera categoría y la factura electrónica sea válida ante SUNAT.</p>

<p><strong>¿El IGV de las cuotas es crédito fiscal?</strong><br>
Sí. El IGV de la factura mensual de renting se recupera en la declaración mensual (PDT 621). En 10 equipos Air M4 a 24 meses, el crédito fiscal acumulado supera los S/ 11,000.</p>

<p><strong>¿Tengo que activar los equipos en mi balance?</strong><br>
En la mayoría de casos para empresas MYPES, no. Bajo la excepción de bajo valor del párrafo 5a de la NIIF 16, los activos por debajo de USD 5,000 de valor nuevo pueden mantenerse como gasto operativo. Para empresas con auditoría bajo NIIF completa, conviene revisar con su auditor.</p>

<p><strong>¿Puedo agregar equipos en mitad del contrato?</strong><br>
Sí. Los contratos permiten adendas para agregar equipos. Cada nuevo equipo tiene su propia fecha de inicio y duración. Útil para empresas que contratan de a dos o tres personas por mes.</p>

<h2>Referencia de precios: renting tecnológico en Perú (2026)</h2>

<table>
  <thead>
    <tr>
      <th>Modelo</th>
      <th>Plan 8 meses</th>
      <th>Plan 16 meses</th>
      <th>Plan 24 meses</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>MacBook Air 13" M4</td>
      <td>~$115/mes</td>
      <td>~$99/mes</td>
      <td>$85/mes</td>
    </tr>
    <tr>
      <td>MacBook Pro 14" M4</td>
      <td>~$155/mes</td>
      <td>~$133/mes</td>
      <td>$115/mes</td>
    </tr>
    <tr>
      <td>MacBook Pro 14" M5</td>
      <td>~$185/mes</td>
      <td>~$158/mes</td>
      <td>$135/mes</td>
    </tr>
  </tbody>
</table>

<p><em>Precios en USD. Factura electrónica SUNAT incluida. Ver precios actualizados en <a href="/laptops">/laptops</a>.</em></p>

<h2>Conclusión: el renting tecnológico es una decisión financiera, no solo operativa</h2>

<p>El renting de laptops no es "alquilar porque no tenés plata para comprar". Es una decisión de asignación eficiente del capital, respaldada por un marco legal claro en Perú, con ventajas tributarias concretas y con una lógica operativa que reduce la fricción de gestionar activos en una empresa que crece.</p>

<p><strong>Tres cosas para recordar:</strong></p>
<ul>
  <li><strong>Renting ≠ leasing financiero.</strong> Son figuras legales distintas. El renting no requiere banco, no activa el equipo en tu balance y no implica opción de compra obligatoria.</li>
  <li><strong>La cuota de renting es gasto 100% deducible</strong> (Art. 37 LIR) y el IGV es crédito fiscal.</li>
  <li><strong>El costo real del renting incluye lo que ahorrás</strong> en gestión, depreciación, seguros y tiempo IT — no solo la cuota mensual.</li>
</ul>

<p>Si querés ver los números de tu caso específico — cantidad de equipos, plazo, modelos — en <a href="/empresas#cotizar">FLUX podés cotizar en minutos</a>, sin formularios complejos ni llamadas de coordinación.</p>`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
