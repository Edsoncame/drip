import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FLUX — Tu Mac. Sin comprarla.",
    short_name: "FLUX",
    description: "Alquiler mensual de MacBook Air y Pro en Lima, Perú.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1B4FFF",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
    ],
  };
}
