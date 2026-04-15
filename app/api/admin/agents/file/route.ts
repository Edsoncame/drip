import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readFileSafe } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const p = searchParams.get("path");
  if (!p) return NextResponse.json({ error: "missing path" }, { status: 400 });

  const result = await readFileSafe(p);
  if (!result) return NextResponse.json({ error: "not found or forbidden" }, { status: 404 });

  return NextResponse.json(result);
}
