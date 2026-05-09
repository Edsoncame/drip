import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "cuanto-cuesta-mac-peru";

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

const CONTENT = `<p>Un Mac en Perú cuesta entre <strong>S/ 2,300 y S/ 10,000+</strong> dependiendo del modelo. El <strong>MacBook Air M4</strong> parte desde <strong>$1,099 USD (≈ S/ 4,200)</strong> en tiendas autorizadas. El <strong>MacBook Pro M4</strong> desde <strong>$1,599 USD (≈ S/ 6,100)</strong>. En esta guía te mostramos los precios actualizados de todos los modelos disponibles en Lima y qué alternativas existen si no querés pagar ese monto de golpe.</p>

<h2>Precios de MacBook Air en Perú (2026)</h2>

<p>El MacBook Air es el modelo más popular de Apple y el más accesible de la línea portátil. En 2026 existen dos generaciones activas: el <strong>Air M4</strong> (lanzado en 2025) y el nuevo <strong>Air M5</strong>. Ambos están disponibles en Perú a través de resellers autorizados.</p>

<table>
  <thead>
    <tr>
      <th>Modelo</th>
      <th>Especificaciones</th>
      <th>Precio Apple.com (USD)</th>
      <th>Precio aprox. en Lima (S/)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>MacBook Air 13" M4</td>
      <td>16 GB RAM / 256 GB SSD</td>
      <td>~$1,099</td>
      <td>≈ S/ 4,200–4,600</td>
    </tr>
    <tr>
      <td>MacBook Air 13" M4</td>
      <td>16 GB RAM / 512 GB SSD</td>
      <td>~$1,299</td>
      <td>≈ S/ 4,900–5,300</td>
    </tr>
    <tr>
      <td>MacBook Air 13" M5</td>
      <td>16 GB RAM / 512 GB SSD</td>
      <td>~$1,299</td>
      <td>≈ S/ 4,900–5,500</td>
    </tr>
    <tr>
      <td>MacBook Air 15" M5</td>
      <td>16 GB RAM / 512 GB SSD</td>
      <td>~$1,499</td>
      <td>≈ S/ 5,700–6,200</td>
    </tr>
  </tbody>
</table>

<p><em>Nota: Los rangos en soles incluyen el IGV del 18% más los márgenes de importación y retail locales. Verificar precios actualizados en Falabella.com.pe o Ripley.com.pe antes de comprar.</em></p>

<h3>¿Dónde comprar MacBook Air en Lima?</h3>
<ul>
  <li><strong>Isoppo / iShop</strong> — tiendas especializadas Apple con garantía oficial</li>
  <li><strong>Falabella / Ripley</strong> — disponibles en cuotas con tarjeta CMR o Ripley</li>
  <li><strong>apple.com/la</strong> — compra directa con envío desde USA (sin soporte local ni garantía peruana)</li>
</ul>

<h2>Precios de MacBook Pro en Perú (2026)</h2>

<p>El MacBook Pro está orientado a profesionales que necesitan mayor potencia: video 4K, desarrollo de software, diseño 3D, renderizado. En Lima, el precio de entrada del Pro es considerablemente más alto que el Air.</p>

<table>
  <thead>
    <tr>
      <th>Modelo</th>
      <th>Especificaciones</th>
      <th>Precio Apple.com (USD)</th>
      <th>Precio aprox. en Lima (S/)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>MacBook Pro 14" M4</td>
      <td>16 GB RAM / 512 GB SSD</td>
      <td>~$1,599</td>
      <td>≈ S/ 6,100–6,800</td>
    </tr>
    <tr>
      <td>MacBook Pro 14" M4 Pro</td>
      <td>24 GB RAM / 1 TB SSD</td>
      <td>~$1,999</td>
      <td>≈ S/ 7,600–8,500</td>
    </tr>
    <tr>
      <td>MacBook Pro 14" M5</td>
      <td>16 GB RAM / 256 GB SSD</td>
      <td>~$1,599</td>
      <td>≈ S/ 6,100–6,800</td>
    </tr>
    <tr>
      <td>MacBook Pro 14" M5 Pro</td>
      <td>24 GB RAM / 1 TB SSD</td>
      <td>~$2,199</td>
      <td>≈ S/ 8,400–9,200</td>
    </tr>
    <tr>
      <td>MacBook Pro 16" M5</td>
      <td>24 GB RAM / 1 TB SSD</td>
      <td>~$2,499</td>
      <td>≈ S/ 9,500–10,500</td>
    </tr>
  </tbody>
</table>

<p>Si tu trabajo involucra edición de video profesional, simulaciones o compilación de software intensiva, el Pro justifica su precio. Para el resto de casos — diseño gráfico, productividad, programación web — el <a href="/laptops/macbook-air-13-m4">MacBook Air M4</a> suele ser suficiente y cuesta S/ 1,900–2,400 menos.</p>

<h2>Precios de Mac mini, iMac y MacBook Neo en Perú (2026)</h2>

<p>Apple tiene más opciones más allá de los portátiles. Si no necesitás movilidad, el Mac mini es la forma más económica de entrar al ecosistema macOS.</p>

<h3>Mac mini M4</h3>
<ul>
  <li>Base (16 GB / 256 GB): <strong>~$599 USD → ≈ S/ 2,300–2,700</strong> en Lima</li>
  <li>Pro (24 GB / 512 GB): ~$1,399 USD → ≈ S/ 5,300–6,000</li>
</ul>

<h3>iMac M4</h3>
<ul>
  <li>Base (16 GB / 256 GB): <strong>~$1,299 USD → ≈ S/ 4,900–5,500</strong></li>
  <li>Con más RAM/almacenamiento: hasta S/ 8,000+</li>
</ul>

<h3>MacBook Neo 13" (Apple A16 Pro) — el más accesible</h3>
<p>El MacBook Neo es el modelo de entrada de Apple lanzado en 2026. Con chip A16 Pro, 8 GB de RAM y 256 GB de almacenamiento, pesa solo 1.23 kg y ofrece hasta 16 horas de batería. Su precio referencial en tiendas es de <strong>~$799–$899 USD (≈ S/ 3,000–3,500)</strong>.</p>
<p>En FLUX, el MacBook Neo está disponible desde <strong>$60/mes en plan de 24 meses</strong> — la forma más económica de acceder a una Mac nueva en Lima.</p>

<h2>¿Por qué los Macs son más caros en Perú que en USA?</h2>

<p>Es la pregunta que todos se hacen. La diferencia de precio no es arbitraria — tiene explicaciones concretas:</p>

<ol>
  <li><strong>IGV del 18%</strong> — se aplica sobre el valor de importación CIF (costo + seguro + flete). Es el factor más importante.</li>
  <li><strong>Aranceles de importación</strong> — las laptops tienen <strong>0% de arancel</strong> en Perú gracias al TLC con USA. Pero el IGV sí se paga sobre el CIF.</li>
  <li><strong>Margen del importador y retail</strong> — entre 15–25% sobre el precio base. Isoppo, iShop, Falabella y Ripley añaden su margen operativo.</li>
  <li><strong>Tipo de cambio</strong> — las fluctuaciones del dólar afectan el precio final en soles. Un sol más débil = Mac más cara.</li>
  <li><strong>Garantía y soporte local</strong> — los resellers autorizados ofrecen reparación y soporte en Lima, lo que justifica parte del premium frente a comprar en USA.</li>
</ol>

<p><strong>Dato concreto:</strong> Un MacBook Air M4 cuesta $1,099 en apple.com/us. En Perú, con IGV + margen retail, puede llegar a S/ 4,200–4,600 (equivalente a ~$1,100–$1,200 USD al tipo de cambio actual de ≈ S/ 3.83 x USD). La diferencia no es dramática, pero sí existe.</p>

<h2>¿Dónde comprar un Mac en Lima? Opciones comparadas</h2>

<table>
  <thead>
    <tr>
      <th>Canal</th>
      <th>Ventaja</th>
      <th>Desventaja</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Falabella / Ripley</strong></td>
      <td>Cuotas sin interés con su tarjeta, presencia en centros comerciales</td>
      <td>Menor variedad de modelos y configuraciones</td>
    </tr>
    <tr>
      <td><strong>Isoppo / iShop</strong></td>
      <td>Tiendas especializadas Apple, garantía oficial en Lima</td>
      <td>Precios algo más altos que retail masivo</td>
    </tr>
    <tr>
      <td><strong>MercadoLibre</strong></td>
      <td>Precios menores (reacondicionados o importados por usuarios)</td>
      <td>Riesgo en garantía, posibles equipos sin soporte Apple local</td>
    </tr>
    <tr>
      <td><strong>apple.com/la</strong></td>
      <td>Catálogo completo, última configuración disponible</td>
      <td>Envío desde USA, sin garantía Apple servicio técnico Perú</td>
    </tr>
    <tr>
      <td><strong>FLUX</strong></td>
      <td>Sin pagar S/ 4,000–10,000 por adelantado, desde $85/mes con entrega en Lima 24–48h</td>
      <td>El equipo no es tuyo al terminar el plan (alquiler operativo)</td>
    </tr>
  </tbody>
</table>

<h2>¿Y si no quiero pagar S/ 4,000–10,000 de golpe?</h2>

<p>Si los precios anteriores te generaron dudas, no estás solo. Comprar un MacBook en Perú implica una inversión fuerte: S/ 4,200 para el Air más básico, S/ 6,100 para el Pro. Y eso sin contar accesorios, garantía extendida o la depreciación del equipo. Por eso cada vez más empresas y profesionales en Lima optan por una alternativa: <strong>alquilar la Mac en lugar de comprarla</strong>.</p>

<p>Con <a href="/alquiler-macbook-empresas-lima">el alquiler mensual de FLUX</a>, podés usar un MacBook Air M4, MacBook Pro M4 o MacBook Pro M5 desde el primer día sin inversión inicial. Beneficios concretos:</p>

<ul>
  <li><strong>Sin inversión inicial</strong> — pagás solo el primer mes al contratar</li>
  <li><strong>100% deducible como gasto operativo</strong> — la cuota mensual se registra como gasto en tu contabilidad, no como activo fijo. Ventaja tributaria real frente a la compra (que solo permite depreciación parcial anual)</li>
  <li><strong>Entrega en Lima en 24–48 horas</strong> — equipo configurado y listo para usar</li>
  <li><strong>Sin riesgo de obsolescencia</strong> — podés renovar tu flota cuando Apple lanza nuevos chips</li>
</ul>

<h3>Comprar vs. alquilar: el cálculo real</h3>

<table>
  <thead>
    <tr>
      <th></th>
      <th>Comprar MacBook Air M4</th>
      <th>Alquilar con FLUX</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Inversión inicial</td>
      <td>S/ 4,200 (≈ $1,099)</td>
      <td><strong>$0</strong></td>
    </tr>
    <tr>
      <td>Costo mensual</td>
      <td>$0 (ya pagado)</td>
      <td>$85/mes (plan 24 meses)</td>
    </tr>
    <tr>
      <td>Costo total en 24 meses</td>
      <td>~$1,099</td>
      <td>$2,040</td>
    </tr>
    <tr>
      <td>Deducible SUNAT</td>
      <td>Parcial (depreciación anual ~25%)</td>
      <td><strong>100% gasto operativo cada mes</strong></td>
    </tr>
    <tr>
      <td>Equipo al cabo de 2 años</td>
      <td>El mismo (puede estar desactualizado)</td>
      <td>Opción de renovar al próximo modelo</td>
    </tr>
    <tr>
      <td>Soporte técnico</td>
      <td>Por tu cuenta o AppleCare (+$249)</td>
      <td>Incluido</td>
    </tr>
  </tbody>
</table>

<p><em>Ser honesto importa: comprar sale más barato si mantenés el equipo más de 2 años y el uso es estable. La ventaja de FLUX no es el precio total — es la <strong>liquidez, la deducibilidad fiscal completa y la posibilidad de actualización</strong>. Para empresas con flujo de caja ajustado o equipos en crecimiento, el alquiler operativo tiene mucho sentido financiero.</em></p>

<p>¿Querés saber más sobre los <a href="/blog/beneficios-tributarios-alquiler-equipos-peru">beneficios tributarios del alquiler de equipos en Perú</a>? Te explicamos cómo funciona según SUNAT.</p>

<h2>Preguntas frecuentes sobre el precio de los Macs en Perú</h2>

<h3>¿Cuánto cuesta el MacBook Air M4 en Perú en soles?</h3>
<p>El MacBook Air M4 de 13 pulgadas cuesta aproximadamente <strong>S/ 4,200–4,600</strong> en tiendas autorizadas de Lima. El precio varía según el reseller y el tipo de cambio del día. En dólares, su precio base en el Apple Store es $1,099 USD.</p>

<h3>¿Cuánto cuesta el MacBook Pro M4 en Perú?</h3>
<p>El MacBook Pro 14" M4 parte desde aproximadamente <strong>S/ 6,100–6,800</strong> en Lima. Con configuraciones superiores (más RAM o almacenamiento), puede superar los S/ 8,000.</p>

<h3>¿Se puede comprar MacBook en cuotas en Perú?</h3>
<p>Sí. Falabella y Ripley ofrecen cuotas con tarjeta CMR/Ripley, generalmente de 12 a 24 cuotas. También existe la opción de <a href="/como-funciona">alquiler mensual como el de FLUX</a>, que permite usar un MacBook desde $85/mes sin ningún pago inicial ni trámite de crédito.</p>

<h3>¿Hay Apple Store oficial en Perú?</h3>
<p>No existe una Apple Store física en Perú. Los Macs se venden a través de <strong>Apple Authorized Resellers</strong> como Isoppo, iShop, y tiendas retail como Falabella y Ripley. También se puede comprar en apple.com/la con envío desde USA, pero sin garantía de servicio técnico local.</p>

<h3>¿Por qué el Mac es más caro en Perú que en USA?</h3>
<p>La diferencia de precio se debe principalmente al <strong>IGV peruano del 18%</strong> que se aplica sobre el valor de importación, más los márgenes de los distribuidores locales (15–25%). Los aranceles de laptops son 0% por el TLC Perú–USA, pero el IGV sí encarece el precio final en soles.</p>

<h3>¿Cuánto cuesta un Mac por mes si lo alquilo?</h3>
<p>A través de FLUX, el alquiler mensual de un <a href="/laptops/macbook-air-13-m4">MacBook Air M4</a> parte desde <strong>$85/mes</strong> (plan de 24 meses). El <a href="/laptops/macbook-pro-14-m4">MacBook Pro M4</a> desde $110/mes y el <a href="/laptops/macbook-pro-14-m5">MacBook Pro M5</a> desde $125/mes. No hay cuota inicial ni permanencia mínima obligatoria.</p>

<h3>¿Cuánto cuesta el MacBook Neo en Perú?</h3>
<p>El MacBook Neo 13" con chip Apple A16 Pro tiene un precio referencial de <strong>S/ 3,000–3,500</strong> en Lima. En FLUX está disponible en alquiler desde <strong>$60/mes</strong> (plan 24 meses) — el punto de entrada más accesible a una Mac nueva con garantía.</p>

<hr />

<p>Antes de decidir si comprás o alquilás, hacé el cálculo completo: precio de compra, cuotas, deducibilidad tributaria y costo de oportunidad de ese capital. Si querés usar un MacBook hoy sin pagar S/ 4,000 por adelantado, <strong><a href="/laptops">FLUX lo hace posible desde $85/mes</a> con entrega en Lima en 24–48 horas</strong>.</p>

<p>¿Tenés dudas sobre qué modelo se adapta mejor a tu uso? <a href="/laptops/comparar">Compará los modelos disponibles en FLUX</a> o <a href="/contacto">escribinos por WhatsApp</a> — te respondemos el mismo día.</p>`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
