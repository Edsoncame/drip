import type { Metadata } from "next";
import { getProduct, products } from "@/lib/products";
import { getAppleImageSets } from "@/lib/appleImages";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";

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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const imageSets = await getAppleImageSets();
  const images = imageSets[slug];

  return <ProductDetail product={product} images={images} />;
}
