import { NextResponse } from "next/server";
import { getAppleImageSets } from "@/lib/appleImages";

// Revalidate every 24 hours — Apple updates product pages when new models release
export const revalidate = 86400;

export async function GET() {
  const images = await getAppleImageSets();
  return NextResponse.json(images, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
