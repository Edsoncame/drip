import { NextRequest, NextResponse } from "next/server";
import { fireSyncCatalog } from "@/lib/dropchat-catalog";
import {
  ensureMdmColumns, fetchDevice, upsertDeviceToEquipment, markUnenrolled,
} from "@/lib/simplemdm";

export const runtime = "nodejs";

const tag = "[webhook/simplemdm]";

/**
 * Receptor de webhooks de SimpleMDM.
 *
 * Seguridad: la URL configurada en SimpleMDM lleva `?token=<SIMPLEMDM_WEBHOOK_SECRET>`.
 * SimpleMDM no firma los webhooks de forma consistente, así que validamos ese token
 * compartido (lo conoce solo SimpleMDM y nosotros).
 *
 * El payload del webhook trae solo el id del device; traemos el device completo
 * por API y hacemos upsert (misma lógica que el botón Sincronizar).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SIMPLEMDM_WEBHOOK_SECRET;
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { type?: string; data?: { device?: { id?: number | string } } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const type = payload.type || "";
  const deviceId = payload.data?.device?.id;
  console.log(`${tag} event=${type} device=${deviceId}`);

  if (!deviceId) return NextResponse.json({ ok: true, note: "sin device id" });

  try {
    await ensureMdmColumns();

    if (type === "device.unenrolled") {
      await markUnenrolled(deviceId);
      fireSyncCatalog();
      return NextResponse.json({ ok: true, action: "unenrolled" });
    }

    // device.enrolled, device.changed, etc. → traer device completo y upsert
    const device = await fetchDevice(deviceId);
    if (!device) return NextResponse.json({ ok: true, note: "device no encontrado en API" });

    const r = await upsertDeviceToEquipment(device, { create: true });
    fireSyncCatalog();
    return NextResponse.json({ ok: true, action: r?.action ?? "noop", codigo: r?.codigo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error(`${tag} fallo:`, msg);
    // 200 para que SimpleMDM no reintente en loop por un error nuestro.
    return NextResponse.json({ ok: false, error: msg });
  }
}
