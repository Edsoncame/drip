import type { Metadata } from "next";
import Link from "next/link";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "macbook-air-vs-pro-cual-elegir";

export async function generateMetadata(): Promise<Metadata> {
  const post = getBlogPost(SLUG);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${BASE}/blog/${SLUG}` },
    openGraph: { title: post.title, description: post.description, type: "article", publishedTime: post.date },
  };
}

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <p>
        La MacBook Air y la MacBook Pro con chip M4 son las dos opciones más buscadas por empresas
        peruanas en 2026. A primera vista se parecen mucho: ambas tienen Apple Silicon, pantalla
        Retina y construcción premium. Pero las diferencias en el uso diario son significativas.
        Acá te las explicamos de forma práctica.
      </p>

      <h2>1. Especificaciones lado a lado</h2>
      <p>Las diferencias clave en las versiones base:</p>

      <h3>MacBook Air 13&quot; M4</h3>
      <ul>
        <li><strong>Chip:</strong> Apple M4 (CPU 8 núcleos, GPU 8 núcleos)</li>
        <li><strong>RAM:</strong> 16 GB unificada</li>
        <li><strong>SSD:</strong> 256 GB</li>
        <li><strong>Pantalla:</strong> 13.6&quot; Liquid Retina, 500 nits</li>
        <li><strong>Batería:</strong> hasta 18 horas</li>
        <li><strong>Peso:</strong> 1.24 kg</li>
        <li><strong>Precio FLUX:</strong> desde $85/mes</li>
      </ul>

      <h3>MacBook Pro 14&quot; M4</h3>
      <ul>
        <li><strong>Chip:</strong> Apple M4 (CPU 10 núcleos, GPU 10 núcleos)</li>
        <li><strong>RAM:</strong> 16 GB unificada</li>
        <li><strong>SSD:</strong> 512 GB</li>
        <li><strong>Pantalla:</strong> 14.2&quot; Liquid Retina XDR, 1000 nits, ProMotion 120Hz</li>
        <li><strong>Batería:</strong> hasta 24 horas</li>
        <li><strong>Peso:</strong> 1.60 kg</li>
        <li><strong>Precio FLUX:</strong> desde $110/mes</li>
      </ul>

      <h2>2. Diferencias que SÍ importan en el día a día</h2>

      <h3>Rendimiento</h3>
      <p>
        Para ofimática, navegación, Figma, diseño 2D, desarrollo web, Zoom y trabajo general — <strong>la
        Air M4 es más que suficiente</strong>. Los 8 núcleos del chip manejan todo sin despeinarse.
      </p>
      <p>
        La Pro empieza a mostrar ventaja real cuando haces <strong>edición de video 4K+, renderizado
        3D, compilación de código pesada, o machine learning</strong>. Ahí los 10 núcleos de CPU y GPU
        se notan.
      </p>

      <h3>Pantalla</h3>
      <p>
        Este es el factor más subestimado. La Pro tiene:
      </p>
      <ul>
        <li><strong>Liquid Retina XDR</strong> (mini-LED con HDR real) vs <strong>Liquid Retina</strong> normal</li>
        <li><strong>1,000 nits</strong> sostenidos vs 500 nits</li>
        <li><strong>ProMotion 120Hz</strong> (fluidez extra) vs 60Hz</li>
      </ul>
      <p>
        Si trabajas con contenido visual (diseño, video, fotografía), la pantalla de la Pro vale la
        pena. Para todo lo demás, la Air está perfecta.
      </p>

      <h3>Batería</h3>
      <p>
        La Pro dura 24 horas reales en uso mixto, la Air dura 18 horas. Ambas superan cualquier día
        de trabajo. Pero si sueles estar lejos de un enchufe (viajes, campo), la Pro te da margen.
      </p>

      <h3>Puertos</h3>
      <p>
        La Air tiene 2 USB-C/Thunderbolt + MagSafe + jack de audio. La Pro agrega un <strong>tercer
        puerto Thunderbolt + HDMI + lector SDXC</strong>. Para fotógrafos/videógrafos, la Pro ahorra
        adaptadores.
      </p>

      <h3>Peso y portabilidad</h3>
      <p>
        La Air pesa <strong>0.36 kg menos</strong>. Suena poco, pero si la cargas todos los días en
        mochila lo vas a notar. La Air también es un poco más delgada.
      </p>

      <h2>3. ¿Para qué perfil es cada una?</h2>

      <h3>Elige la MacBook Air M4 si:</h3>
      <ul>
        <li>Eres estudiante, profesional independiente o trabajas en oficina.</li>
        <li>Tu trabajo principal es ofimática, navegación, Zoom, diseño ligero, código frontend.</li>
        <li>Viajas seguido y quieres máxima portabilidad.</li>
        <li>Tu empresa necesita equipar a 5+ personas y buscas el mejor costo-beneficio.</li>
        <li>Te importa el diseño minimalista sin sacrificar potencia.</li>
      </ul>

      <h3>Elige la MacBook Pro M4 si:</h3>
      <ul>
        <li>Editas video o fotos profesionalmente.</li>
        <li>Desarrollas software con compilaciones pesadas (Xcode, Unity, Android Studio).</li>
        <li>Trabajas con 3D, renders, o modelos de ML.</li>
        <li>La pantalla es crítica para tu trabajo (diseñadores, fotógrafos, video).</li>
        <li>Sueles estar lejos de un enchufe por muchas horas.</li>
        <li>Necesitas HDMI y SDXC sin adaptadores.</li>
      </ul>

      <h2>4. Análisis de valor en alquiler</h2>
      <p>
        Con FLUX pagas una cuota mensual. La diferencia de precio entre Air y Pro M4 en plan de 24
        meses es de $25/mes. En el plazo completo, la Pro cuesta $600 más.
      </p>
      <p>
        Si vas a usar el equipo 24 meses, pregúntate: <strong>¿esos $600 extra justifican la pantalla
        XDR, los 2 núcleos más y los 256 GB extra de SSD?</strong> Para un editor de video profesional,
        sin duda. Para un community manager que usa Canva y Figma, probablemente no.
      </p>

      <h2>5. Conclusión</h2>
      <p>
        <strong>El 70% de los usuarios empresariales están perfectos con una MacBook Air M4.</strong>
        Solo el 30% con trabajos visuales o de cómputo intensivo saca provecho real de la Pro.
      </p>
      <p>
        Si no estás seguro cuál elegir, puedes empezar con la Air en plan de 8 meses ($115/mes) y
        si descubres que necesitas más potencia, subes a la Pro al final del plazo.
        <Link href="/laptops"> Ver ambas en el catálogo</Link>.
      </p>
    </BlogArticleLayout>
  );
}
