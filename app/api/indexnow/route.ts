/**
 * IndexNow endpoint — notifica a Bing (y otros buscadores compatibles)
 * cuando una URL cambia, para que la re-indexen inmediatamente.
 *
 * IndexNow es un protocolo abierto soportado por Bing, Yandex y
 * (eventualmente) Google. No requiere autenticación más allá de una
 * "api key" que se publica en el propio dominio para probar ownership.
 *
 * Uso:
 *   GET /api/indexnow               → submite la home y todas las URLs del sitemap
 *   GET /api/indexnow?url=/laptops  → submite solo esa URL
 *
 * Documentación: https://www.indexnow.org/documentation
 */

import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const API_KEY = process.env.INDEXNOW_KEY; // 8+ caracteres, cualquier string random

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "INDEXNOW_KEY env var no configurada" },
      { status: 503 }
    );
  }

  const requested = req.nextUrl.searchParams.get("url");
  let urlList: string[];

  if (requested) {
    urlList = [requested.startsWith("http") ? requested : `${BASE}${requested}`];
  } else {
    // Sin url específica: submitear todo el sitemap
    urlList = [
      `${BASE}/`,
      `${BASE}/laptops`,
      `${BASE}/empresas`,
      `${BASE}/como-funciona`,
      `${BASE}/contacto`,
      `${BASE}/laptops/comparar`,
      `${BASE}/alquiler-macbook-empresas-lima`,
      `${BASE}/alquiler-macbook-air-lima`,
      `${BASE}/leasing-laptops-peru`,
      `${BASE}/terminos`,
      `${BASE}/privacidad`,
      `${BASE}/cancelaciones`,
      `${BASE}/libro-de-reclamaciones`,
    ];
  }

  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(BASE).hostname,
        key: API_KEY,
        keyLocation: `${BASE}/${API_KEY}.txt`,
        urlList,
      }),
    });

    // IndexNow devuelve 200 (procesado) o 202 (aceptado, procesando en background)
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      submitted: urlList.length,
      urls: urlList,
    });
  } catch (err) {
    console.error("[indexnow] error:", err);
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
