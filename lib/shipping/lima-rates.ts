/**
 * Tarifas de envío en Lima desde el almacén de Flux en San Borja.
 *
 * Estrategia:
 *   1. Si tenemos lat/lng (del geocoder), calculamos distancia haversine
 *      desde San Borja y aplicamos tarifa por rangos.
 *   2. Si solo tenemos distrito, usamos la tabla estática de distritos.
 *
 * Regla de negocio (usuario pidió):
 *   - Si el costo calculado es < 20 soles → "Gratis" (absorbe Flux).
 *   - Si es >= 20 soles → se cobra el monto redondeado.
 *
 * La tabla de distritos está calibrada con distancia real aproximada
 * desde San Borja y un pricing base de 8 soles + 2 soles/km.
 */

// Almacén Flux — aprox. Av. San Borja Norte con Aviación
export const WAREHOUSE = {
  lat: -12.10718,
  lng: -76.99942,
  distrito: "San Borja",
  label: "Almacén Flux — San Borja",
} as const;

export interface ShippingQuote {
  /** Costo real calculado antes del "free shipping threshold" */
  raw_cost: number;
  /** Costo final mostrado al usuario (0 si es gratis) */
  cost: number;
  /** true si el costo real era < 20 soles */
  is_free: boolean;
  /** Distancia en km desde el almacén */
  distance_km: number;
  /** Explicación para mostrar al usuario */
  explanation: string;
}

// Umbral de "envío gratis" — regla del negocio
const FREE_THRESHOLD = 20;
// Tarifa: base + por km
const BASE_COST = 8;
const COST_PER_KM = 2;

/**
 * Tabla de distritos de Lima con costo aproximado de envío desde San Borja.
 * Fuente: distancias aproximadas + tarifas típicas de couriers locales
 * (Chazki, OlvaCourier, moto Rappi/Cabify) para envíos de pequeño bulto
 * misma fecha.
 *
 * El costo acá es el "raw_cost" antes del free-shipping threshold.
 */
export const LIMA_DISTRICT_COSTS: Record<string, number> = {
  // ── Gratis absoluto (mismo distrito o pegado) ───────────────────────────
  "San Borja": 0,
  "Surquillo": 10,
  "San Luis": 10,
  "Santa Catalina": 10,
  "La Victoria": 12,
  // ── Lima top (<20, gratis por regla) ────────────────────────────────────
  "San Isidro": 12,
  "Miraflores": 14,
  "Santiago de Surco": 14,
  "Surco": 14,
  "Jesús María": 14,
  "Lince": 12,
  "Pueblo Libre": 16,
  "Magdalena": 16,
  "Magdalena del Mar": 16,
  "Breña": 16,
  "Lima": 18,
  "Lima Cercado": 18,
  "Cercado de Lima": 18,
  // ── Moderado (20-25 soles) ──────────────────────────────────────────────
  "La Molina": 20,
  "Barranco": 20,
  "Ate": 22,
  "Ate Vitarte": 22,
  "San Miguel": 22,
  "Rímac": 22,
  "El Agustino": 22,
  "Chorrillos": 25,
  "San Martín de Porres": 25,
  "SMP": 25,
  // ── Lejos (25-35 soles) ─────────────────────────────────────────────────
  "Independencia": 28,
  "Los Olivos": 28,
  "Comas": 30,
  "Villa María del Triunfo": 30,
  "Villa El Salvador": 30,
  "San Juan de Miraflores": 28,
  "San Juan de Lurigancho": 32,
  "Callao": 28,
  "Bellavista": 28,
  "La Perla": 30,
  "Carmen de la Legua": 30,
  "La Punta": 32,
  "Cieneguilla": 35,
  "Pachacámac": 35,
  "Lurín": 35,
  "Lurigancho": 32,
  "Lurigancho-Chosica": 35,
  "Chaclacayo": 38,
  // ── Muy lejos (40+ soles) ───────────────────────────────────────────────
  "Carabayllo": 38,
  "Puente Piedra": 40,
  "Ventanilla": 42,
  "Ancón": 48,
  "Santa Rosa": 48,
  "Punta Hermosa": 45,
  "Punta Negra": 45,
  "San Bartolo": 48,
  "Santa María del Mar": 48,
  "Pucusana": 55,
};

/** Normaliza un distrito para match contra la tabla (tolera tildes/caps) */
function normalizeDistrito(d: string): string {
  return d
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Haversine entre dos puntos en km */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cotiza el envío.
 *
 * @param opts.distrito  Nombre del distrito (ayuda como fallback).
 * @param opts.lat,lng   Coordenadas del cliente (si vienen de Maps/Nominatim).
 *
 * Preferimos lat/lng cuando están; si no, caemos al distrito.
 */
export function quoteShipping(opts: {
  distrito?: string;
  lat?: number;
  lng?: number;
}): ShippingQuote {
  let rawCost = 0;
  let distanceKm = 0;
  let source: "coords" | "distrito" | "default" = "default";

  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    distanceKm = haversineKm(WAREHOUSE.lat, WAREHOUSE.lng, opts.lat, opts.lng);
    rawCost = BASE_COST + distanceKm * COST_PER_KM;
    source = "coords";
  } else if (opts.distrito) {
    const key = normalizeDistrito(opts.distrito);
    const match = Object.entries(LIMA_DISTRICT_COSTS).find(
      ([k]) => normalizeDistrito(k) === key,
    );
    if (match) {
      rawCost = match[1];
      source = "distrito";
    } else {
      // Distrito desconocido — fallback alto para que el admin revise
      rawCost = 30;
      source = "default";
    }
  }

  // Redondeo
  const rounded = Math.round(rawCost);
  const isFree = rounded < FREE_THRESHOLD;
  const cost = isFree ? 0 : rounded;

  let explanation: string;
  if (isFree) {
    explanation =
      "Envío gratis (a esta zona lo cubrimos nosotros)";
  } else {
    const detail =
      source === "coords"
        ? `${distanceKm.toFixed(1)} km desde San Borja`
        : source === "distrito"
          ? `Tarifa fija para ${opts.distrito}`
          : "Tarifa estándar Lima";
    explanation = `S/ ${cost} · ${detail}`;
  }

  return {
    raw_cost: Math.round(rawCost * 100) / 100,
    cost,
    is_free: isFree,
    distance_km: Math.round(distanceKm * 10) / 10,
    explanation,
  };
}

/** Soporte para autocomplete: devuelve lista de distritos que matchean */
export function searchDistritos(q: string): string[] {
  const qn = normalizeDistrito(q);
  if (!qn) return [];
  return Object.keys(LIMA_DISTRICT_COSTS)
    .filter((d) => normalizeDistrito(d).includes(qn))
    .slice(0, 8);
}
