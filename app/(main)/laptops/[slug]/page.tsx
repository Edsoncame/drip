import { getProduct, products } from "@/lib/products";
import { getAppleImageSets } from "@/lib/appleImages";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";

export const revalidate = 86400;

export async function generateStaticParams() {
  return products.map(p => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const imageSets = await getAppleImageSets();
  const images = imageSets[slug];

  return <ProductDetail product={product} images={images} />;
}
