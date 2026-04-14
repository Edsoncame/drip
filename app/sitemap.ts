import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/products";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/laptops`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/empresas`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/como-funciona`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contacto`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/laptops/comparar`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/alquiler-macbook-empresas-lima`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${BASE}/alquiler-macbook-air-lima`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/leasing-laptops-peru`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/cancelaciones`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/libro-de-reclamaciones`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map(p => ({
    url: `${BASE}/laptops/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  return [...staticRoutes, ...productRoutes];
}
