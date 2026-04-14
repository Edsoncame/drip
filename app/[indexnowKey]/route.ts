/**
 * Sirve el archivo de verificación de IndexNow.
 *
 * IndexNow requiere que publiques tu API key en un archivo .txt en la raíz
 * del dominio (ej. `/abcd1234.txt`) con solo la key dentro. Eso prueba que
 * tú eres dueño del dominio sin necesidad de autenticación.
 *
 * En vez de crear un archivo estático en /public (que requeriría redeploys
 * cada vez que cambias la key), este route handler responde dinámicamente:
 *
 *   GET /abcd1234.txt  →  "abcd1234"
 *
 * Solo si el nombre del archivo coincide con la env var INDEXNOW_KEY.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ indexnowKey: string }> }
) {
  const { indexnowKey } = await params;
  const expected = process.env.INDEXNOW_KEY;

  if (!expected) return new NextResponse("Not found", { status: 404 });

  // Solo responder si la URL pedida coincide con la key configurada
  const fileName = `${expected}.txt`;
  if (indexnowKey !== fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(expected, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
