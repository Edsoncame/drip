import Link from "next/link";
import type { ReactNode } from "react";
import { blogPosts } from "@/lib/blog";

/**
 * Layout reutilizable para los artículos del blog.
 * Incluye breadcrumb, título, metadata, sidebar con artículos relacionados,
 * y CTA al final que lleva al catálogo.
 *
 * Los artículos individuales solo escriben el contenido Markdown como
 * children y esta plantilla se encarga del resto.
 */
export default function BlogArticleLayout({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return null;
  const related = blogPosts.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <article className="bg-white">
      {/* Breadcrumb */}
      <div className="border-b border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 text-sm text-[#666]">
          <Link href="/" className="hover:text-[#1B4FFF]">
            Inicio
          </Link>
          <span className="mx-2 text-[#CCC]">/</span>
          <Link href="/blog" className="hover:text-[#1B4FFF]">
            Blog
          </Link>
          <span className="mx-2 text-[#CCC]">/</span>
          <span className="text-[#333] truncate">{post.title}</span>
        </div>
      </div>

      {/* Header */}
      <header className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-4 text-xs text-[#999]">
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5F8FF] text-[#1B4FFF] font-700">
              {post.category}
            </span>
            <span>
              {new Date(post.date).toLocaleDateString("es-PE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>·</span>
            <span>{post.readingTime} de lectura</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-800 text-[#18191F] mb-4 leading-tight">
            {post.title}
          </h1>
          <p className="text-lg text-[#666] leading-relaxed">{post.description}</p>
        </div>
      </header>

      {/* Content */}
      <div className="py-4 md:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 prose prose-neutral prose-lg max-w-none
          prose-headings:text-[#18191F] prose-headings:font-800
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-[#333] prose-p:leading-relaxed
          prose-a:text-[#1B4FFF] prose-a:font-700 hover:prose-a:underline
          prose-strong:text-[#18191F] prose-strong:font-700
          prose-ul:my-4 prose-li:my-1 prose-li:text-[#333]
          prose-blockquote:border-l-4 prose-blockquote:border-[#1B4FFF] prose-blockquote:bg-[#F5F8FF] prose-blockquote:py-0.5 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:rounded-r-xl">
          {children}
        </div>
      </div>

      {/* CTA */}
      <section className="py-12 mt-8 bg-[#F7F7F7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-[#1B4FFF] to-[#102F99] rounded-2xl p-8 text-center text-white">
            <h3 className="text-2xl font-800 mb-3">¿Listo para equipar tu equipo con MacBook?</h3>
            <p className="opacity-90 mb-5 max-w-xl mx-auto">
              Desde $85/mes. Sin comprar, sin depósito, entrega en Lima en 24-48h.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/laptops"
                className="px-6 py-3 bg-white text-[#1B4FFF] font-700 rounded-full hover:bg-[#F7F7F7] transition-colors"
              >
                Ver MacBooks disponibles
              </Link>
              <Link
                href="/empresas#cotizar"
                className="px-6 py-3 border border-white/30 text-white font-700 rounded-full hover:bg-white/10 transition-colors"
              >
                Cotizar para mi empresa
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="py-12 border-t border-[#E5E5E5]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h3 className="text-xl font-800 text-[#18191F] mb-6">Sigue leyendo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block p-5 border border-[#E5E5E5] rounded-2xl hover:border-[#1B4FFF] transition-colors"
                >
                  <p className="text-[10px] font-700 text-[#1B4FFF] uppercase mb-2">
                    {p.category}
                  </p>
                  <p className="font-700 text-[#18191F] text-sm group-hover:text-[#1B4FFF] transition-colors leading-snug">
                    {p.title}
                  </p>
                  <p className="text-xs text-[#999] mt-2">{p.readingTime} de lectura</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
