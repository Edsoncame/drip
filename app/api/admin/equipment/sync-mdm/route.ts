import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fireSyncCatalog } from "@/lib/dropchat-catalog";
import { ensureMdmColumns, fetchAllDevices, upsertDeviceToEquipment } from "@/lib/simplemdm";

export const runtime = "nodejs";
export const maxDuration = 60;

const tag = "[admin/equipment/sync-mdm]";

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    await ensureMdmColumns();
    const devices = await fetchAllDevices();

    let created = 0, updated = 0;
    const items: { codigo: string; action: string }[] = [];
    for (const d of devices) {
      const r = await upsertDeviceToEquipment(d, { create: true });
      if (!r) continue;
      if (r.action === "created") created++; else updated++;
      items.push({ codigo: r.codigo, action: r.action });
    }

    if (created + updated > 0) fireSyncCatalog(); // el stock del catálogo pudo cambiar
    console.log(`${tag} ok total=${devices.length} created=${created} updated=${updated}`);
    return NextResponse.json({ ok: true, total: devices.length, created, updated, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error(`${tag} fallo:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
