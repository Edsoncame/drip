import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/blog";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Blog FLUX — Alquiler de MacBook, leasing y finanzas para empresas",
  description:
    "Artículos sobre alquiler de MacBooks, leasing operativo, tributación en Perú y productividad empresarial con equipos Apple.",
  alternates: { canonical: `${BASE}/blog` },
};

export default function BlogIndexPage() {
  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "Blog", url: `${BASE}/blog` },
        ]}
      />

      <section className="py-16 md:py-20 bg-[#F7F7F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-2">Blog</p>
          <h1 className="text-4xl md:text-5xl font-800 text-[#18191F] mb-3">
            Todo sobre alquiler de MacBook en Perú
          </h1>
          <p className="text-lg text-[#666] max-w-2xl mx-auto">
            Guías, comparativas y análisis financieros para tomar mejores decisiones sobre los
            equipos Apple de tu empresa.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="space-y-6">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block group bg-white border border-[#E5E5E5] rounded-2xl p-6 hover:border-[#1B4FFF] transition-colors"
              >
                <div className="flex items-center gap-3 mb-2 text-xs text-[#999]">
                  <span className="px-2 py-0.5 rounded-full bg-[#F5F8FF] text-[#1B4FFF] font-700">
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
                <h2 className="text-xl md:text-2xl font-800 text-[#18191F] mb-2 group-hover:text-[#1B4FFF] transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-[#666] leading-relaxed">{post.description}</p>
                <p className="text-sm text-[#1B4FFF] font-700 mt-3 group-hover:underline">
                  Leer artículo →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
