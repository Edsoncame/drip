import type { Metadata } from "next";
import { getProduct } from "@/lib/products";
import { getAppleImageSets } from "@/lib/appleImages";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { query } from "@/lib/db";
import { modelKey } from "@/lib/inventory";

// Dinámico: precio y stock se leen en vivo del inventario en cada visita,
// así los cambios de precio/stock se reflejan al instante (antes era ISR 24h
// y la página quedaba congelada con precios viejos).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const price = product.pricing[product.pricing.length - 1].price;
  return {
    title: product.name,
    description: `Alquiler ${product.name} desde $${price}/mes en Lima. ${product.chip}, ${product.ram}, ${product.ssd}. Sin comprar, sin depósito, entrega en 24-48h.`,
    openGraph: {
      title: `${product.name} | FLUX`,
      description: `${product.chip} · ${product.ram} · ${product.ssd} — desde $${price}/mes`,
    },
  };
}

async function getLiveStock(slug: string): Promise<number> {
  try {
    const r = await query<{ modelo_completo: string; disponible: string }>(
      `SELECT modelo_completo, COUNT(*) FILTER (WHERE estado_actual = 'Disponible') AS disponible
       FROM equipment WHERE COALESCE(tipo,'alquiler')='alquiler' GROUP BY modelo_completo`
    );
    let n = 0;
    for (const row of r.rows) if (modelKey(row.modelo_completo) === slug) n += parseInt(row.disponible, 10);
    return n;
  } catch {
    return 0;
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [imageSets, liveStock] = await Promise.all([
    getAppleImageSets(),
    getLiveStock(slug),
  ]);
  // Sin unidades disponibles → el modelo no se muestra en la web (404).
  if (liveStock <= 0) notFound();
  const images = imageSets[slug];
  const productWithStock = { ...product, stock: liveStock };

  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

  return (
    <>
      <ProductJsonLd slug={slug} />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "MacBooks", url: `${BASE}/laptops` },
          { name: product.shortName, url: `${BASE}/laptops/${slug}` },
        ]}
      />
      <ProductDetail product={productWithStock} images={images} />
    </>
  );
}
