import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncAllProducts, syncProduct } from "@/lib/dropchat-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tag = "[admin/dropchat/sync-catalog]";

/**
 * POST — sincroniza el catálogo con Drop Chat.
 *   body {}                 → todos los productos activos
 *   body { slug: "xxx" }    → solo ese producto
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { slug?: string };

  if (body.slug) {
    const result = await syncProduct(body.slug);
    console.log(`${tag} ${session.email} synced slug=${body.slug} ok=${result.ok}`);
    return NextResponse.json(result);
  }

  const result = await syncAllProducts();
  console.log(`${tag} ${session.email} batch: ${result.synced}/${result.total} errors=${result.errors.length}`);
  return NextResponse.json(result);
}
