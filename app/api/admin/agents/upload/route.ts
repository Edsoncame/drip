import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { createAttachment, getActiveStrategy } from "@/lib/strategy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Parser mínimo de XLSX: lo trata como zip y saca los strings de
 * xl/sharedStrings.xml. No preserva la grilla pero sí saca el texto
 * (suficiente para darle contexto a Claude).
 */
async function parseXlsxText(buf: Buffer): Promise<string> {
  try {
    // Minimal inline zip reader (usando fflate via dynamic eval no existe).
    // Dejamos un placeholder — Claude puede leer el XLSX igual por el blob URL
    // si es necesario, pero para MVP no parseamos.
    return `[XLSX binario ${buf.length} bytes — el contenido completo está en el blob, úsalo con web_fetch si necesitás extraer celdas]`;
  } catch {
    return "";
  }
}

async function parsePdfText(buf: Buffer): Promise<string> {
  // Igual que XLSX: no parseamos server-side — dejamos el blob URL disponible
  // para que Claude lo consuma vía @ai-sdk/anthropic file input si lo requerís.
  return `[PDF binario ${buf.length} bytes — usá web_fetch con el blob URL para extraer texto]`;
}

async function parseTextFile(buf: Buffer): Promise<string> {
  return buf.toString("utf8").slice(0, 200_000);
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const title = (form.get("title") as string) || "";
  const kind = (form.get("kind") as string) || "reference";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `content type not allowed: ${file.type}` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `marketing-attachments/${Date.now()}-${safeName}`;

  const blob = await put(key, buf, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  // Extract text best-effort
  let parsedText = "";
  try {
    if (file.type === "application/pdf") {
      parsedText = await parsePdfText(buf);
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel"
    ) {
      parsedText = await parseXlsxText(buf);
    } else if (file.type.startsWith("text/") || file.type === "text/markdown") {
      parsedText = await parseTextFile(buf);
    } else if (file.type === "text/csv") {
      parsedText = await parseTextFile(buf);
    }
  } catch (err) {
    console.warn("[upload] parse failed", err);
  }

  const strategy = await getActiveStrategy();

  const row = await createAttachment({
    strategy_id: strategy?.id ?? null,
    kind,
    title: title || file.name,
    filename: file.name,
    content_type: file.type || null,
    size_bytes: buf.length,
    blob_url: blob.url,
    parsed_text: parsedText || null,
    uploaded_by: session.email,
  });

  return NextResponse.json({
    ok: true,
    attachment: {
      id: row.id,
      title: row.title,
      filename: row.filename,
      blob_url: row.blob_url,
      content_type: row.content_type,
      size_bytes: row.size_bytes,
      has_text: !!row.parsed_text,
    },
  });
}
