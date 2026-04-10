/**
 * Apple image system — fetches current product image IDs from Apple's store.
 * Falls back to known-good IDs if fetch fails.
 * ISR revalidates every 24h so images always reflect the latest models.
 */

const CDN = "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is";
const APPLE_CDN = "https://www.apple.com/v";

// Fallback IDs — updated to January 2026 (current MacBook generation)
const FALLBACK_IDS = {
  air13:  "macbook-air-size-select-202601-13inch",
  pro14:  "mac-macbook-pro-size-select-202601-14inch",
};

function storeImg(id: string, view: "" | "_AV1" | "_AV2" | "_AV3" = "", size = 2560): string {
  return `${CDN}/${id}${view}?wid=${size}&hei=${Math.round(size * 0.64)}&fmt=jpeg&qlt=95`;
}

/** Scrape Apple's buy pages for the latest image IDs */
async function fetchCurrentIds(): Promise<typeof FALLBACK_IDS> {
  try {
    const [airRes, proRes] = await Promise.all([
      fetch("https://www.apple.com/shop/buy-mac/macbook-air/13-inch", {
        next: { revalidate: 86400 },
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      }),
      fetch("https://www.apple.com/shop/buy-mac/macbook-pro/14-inch", {
        next: { revalidate: 86400 },
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      }),
    ]);

    const [airHtml, proHtml] = await Promise.all([airRes.text(), proRes.text()]);

    const airMatch = airHtml.match(/macbook-air-size-select-(\d{6})-13inch/);
    const proMatch = proHtml.match(/mac-macbook-pro-size-select-(\d{6})-14inch/);

    return {
      air13: airMatch ? `macbook-air-size-select-${airMatch[1]}-13inch` : FALLBACK_IDS.air13,
      pro14: proMatch ? `mac-macbook-pro-size-select-${proMatch[1]}-14inch` : FALLBACK_IDS.pro14,
    };
  } catch {
    return FALLBACK_IDS;
  }
}

/** Returns image sets for all MacBook models (called from ISR route) */
export async function getAppleImageSets() {
  const ids = await fetchCurrentIds();

  return {
    "macbook-air-13-m4": {
      hero:    storeImg(ids.air13, "", 2560),
      open:    storeImg(ids.air13, "_AV1", 2560),
      side:    storeImg(ids.air13, "_AV2", 2560),
      gallery: [
        storeImg(ids.air13, "", 1200),
        storeImg(ids.air13, "_AV1", 1200),
        storeImg(ids.air13, "_AV2", 1200),
      ],
    },
    "macbook-pro-14-m4": {
      hero:    storeImg(ids.pro14, "", 2560),
      open:    storeImg(ids.pro14, "_AV1", 2560),
      side:    storeImg(ids.pro14, "_AV2", 2560),
      gallery: [
        storeImg(ids.pro14, "", 1200),
        storeImg(ids.pro14, "_AV1", 1200),
        storeImg(ids.pro14, "_AV2", 1200),
      ],
    },
    "macbook-pro-14-m5": {
      // M5 uses same chassis as M4 Pro but Apple releases separate marketing images
      hero:    storeImg(ids.pro14, "", 2560),
      open:    storeImg(ids.pro14, "_AV1", 2560),
      side:    storeImg(ids.pro14, "_AV2", 2560),
      gallery: [
        storeImg(ids.pro14, "", 1200),
        storeImg(ids.pro14, "_AV1", 1200),
        storeImg(ids.pro14, "_AV2", 1200),
      ],
    },
  } as Record<string, { hero: string; open: string; side: string; gallery: string[] }>;
}

/** Apple marketing / hero images (from apple.com/v/) */
export const APPLE_HERO_IMAGES = {
  airHero:   `${APPLE_CDN}/macbook-air/z/images/overview/hero/hero_static__c9sislzzicq6_large.png`,
  proHero:   `${APPLE_CDN}/macbook-pro/ax/images/overview/welcome/hero_endframe__fwev9ebh42mq_medium.jpg`,
  airBattery:`${APPLE_CDN}/macbook-air/z/images/overview/highlights/battery__geuvrre3336u_large.jpg`,
  proAi:     `${APPLE_CDN}/macbook-pro/ax/images/overview/highlights/highlights_ai__c1tao33ompea_large.jpg`,
};
