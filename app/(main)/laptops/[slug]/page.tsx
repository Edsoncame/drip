import type { Metadata } from "next";
import { getProduct, products } from "@/lib/products";
import { getAppleImageSets } from "@/lib/appleImages";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { query } from "@/lib/db";

export const revalidate = 86400;

export async function generateStaticParams() {
  return products.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  const price = product.pricing[product.pricing.length - 1].price;
  return {
    title: product.name,
    description: `Renta ${product.name} desde $${price}/mes. ${product.chip}, ${product.ram}, ${product.ssd}. Sin comprar, entrega en Lima en 24-48h.`,
    openGraph: {
      title: `${product.name} | FLUX`,
      description: `${product.chip} · ${product.ram} · ${product.ssd} — desde $${price}/mes`,
    },
  };
}

async function getLiveStock(slug: string): Promise<number | null> {
  try {
    const MODEL_MAP: Record<string, string> = {
      "macbook-air-13-m4": "MacBook Air",
      "macbook-pro-14-m4": "MacBook Pro M4",
      "macbook-pro-14-m5": "MacBook Pro M5",
    };
    const modelLike = MODEL_MAP[slug];
    if (!modelLike) return null;
    const r = await query(
      `SELECT COUNT(*) AS disponible FROM equipment
       WHERE modelo ILIKE $1 AND estado_actual = 'Disponible'`,
      [`%${modelLike}%`]
    );
    return parseInt(r.rows[0]?.disponible ?? "0", 10);
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const [imageSets, liveStock] = await Promise.all([
    getAppleImageSets(),
    getLiveStock(slug),
  ]);
  const images = imageSets[slug];
  const productWithStock = liveStock !== null ? { ...product, stock: liveStock } : product;

  return <ProductDetail product={productWithStock} images={images} />;
}
