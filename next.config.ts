import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
    // Serve Apple images at full quality
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24h
  },
};

export default nextConfig;
