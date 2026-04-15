import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir el snapshot del workspace de marketing agents en el bundle
  // serverless de Vercel para que las route handlers de /api/admin/agents/*
  // puedan leerlo con fs.readFile en producción.
  outputFileTracingIncludes: {
    "/api/admin/agents/**/*": ["./data/flux-marketing/**/*"],
    "/admin/agentes": ["./data/flux-marketing/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "store.storeimages.cdn-apple.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.apple.com",
        pathname: "/v/**",
      },
      // Vercel Blob storage — imágenes de productos subidas por admin
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
    // Serve Apple images at full quality
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24h
  },
};

export default nextConfig;
