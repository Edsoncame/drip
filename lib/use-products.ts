"use client";

import { useEffect, useState } from "react";
import type { Product } from "./products";

// Module-level cache so multiple components share the same fetch result
let cachedProducts: Product[] | null = null;
let inflight: Promise<Product[]> | null = null;

async function fetchProducts(): Promise<Product[]> {
  if (cachedProducts) return cachedProducts;
  if (inflight) return inflight;
  inflight = fetch("/api/products", { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      cachedProducts = data.products as Product[];
      inflight = null;
      return cachedProducts;
    });
  return inflight;
}

export function useProducts() {
  // Lazy init — si hay cache, useState ya arranca con el valor correcto
  // (evita cascade render por setProducts en el effect, que es lo que el
  // React Compiler flaggea como 'setState in effect').
  const [products, setProducts] = useState<Product[]>(cachedProducts ?? []);
  const [loading, setLoading] = useState(!cachedProducts);

  useEffect(() => {
    // Si ya teníamos cache al montar, useState ya hidrató → nada que hacer.
    if (cachedProducts) return;
    fetchProducts().then((p) => {
      setProducts(p);
      setLoading(false);
    });
  }, []);

  return { products, loading };
}

export function useProduct(slug: string) {
  const { products, loading } = useProducts();
  return {
    product: products.find((p) => p.slug === slug) ?? null,
    loading,
  };
}
