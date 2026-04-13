import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const kind = (formData.get("kind") as string) || "misc"; // "factura" | "vault"
  const codigo = (formData.get("codigo") as string) || "equipment";

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Solo JPG, PNG, WebP o PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Máximo 15MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const safeCode = codigo.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `equipment/${safeCode}/${kind}-${Date.now()}.${ext}`;

  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
