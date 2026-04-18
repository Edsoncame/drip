import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy a Nominatim (OpenStreetMap) para autocomplete de direcciones.
 *
 * Nominatim es gratis y sin API key, pero exige:
 *   - User-Agent identificable
 *   - Máximo 1 req/sec por IP
 *
 * Este proxy nos permite:
 *   - Setear el User-Agent propio (no se puede desde browser)
 *   - Cachear resultados en memoria (ahorro de requests)
 *   - Rate-limitar del lado servidor
 *   - Limitar el viewbox a Lima Metropolitana (mejor relevancia)
 *
 * Lima Metropolitana viewbox:
 *   SW: -77.20, -12.40 (Pucusana)
 *   NE: -76.75, -11.60 (Ancón)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMA_VIEWBOX = "-77.20,-11.60,-76.75,-12.40"; // left,top,right,bottom
const USER_AGENT = "FluxPeruCheckout/1.0 (contacto@fluxperu.com)";

// Cache simple en memoria — key = query normalizada
const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

// Throttle a 1 req/s
let lastRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  type?: string;
  importance?: number;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.data, cached: true });
  }

  await throttle();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("countrycodes", "pe");
  url.searchParams.set("viewbox", LIMA_VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Referer: "https://www.fluxperu.com" },
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { results: [], error: `Nominatim devolvió ${resp.status}` },
        { status: 502 },
      );
    }

    const raw: NominatimResult[] = await resp.json();

    // Normalizamos a un formato compacto y útil para el cliente
    const results = raw.map((r) => {
      const addr = r.address ?? {};
      const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
      const neighborhood = addr.neighbourhood || addr.suburb || "";
      // Distrito en Lima lo reporta como city_district en la mayoría de casos
      const distrito = addr.city_district || addr.suburb || addr.city || "";
      return {
        id: r.place_id,
        display: r.display_name,
        short: street || r.display_name.split(",")[0],
        distrito,
        neighborhood,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      };
    });

    cache.set(cacheKey, { ts: Date.now(), data: results });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[geocode] error", err);
    return NextResponse.json(
      {
        results: [],
        error: err instanceof Error ? err.message : "Error consultando mapa",
      },
      { status: 500 },
    );
  }
}
