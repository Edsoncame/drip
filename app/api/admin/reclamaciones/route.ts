import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[admin/reclamaciones]";

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    respuesta?: string;
    estado?: string;
  };
  if (!body.id || !body.respuesta?.trim()) {
    return NextResponse.json({ error: "id y respuesta requeridos" }, { status: 400 });
  }

  const estado = body.estado ?? "respondido";
  if (!["pendiente", "respondido", "cerrado"].includes(estado)) {
    return NextResponse.json({ error: "estado inválido" }, { status: 400 });
  }

  const res = await query<{
    numero_hoja: number;
    email: string;
    nombre: string;
    apellidos: string;
    tipo_reclamo: string;
  }>(
    `UPDATE libro_reclamaciones
     SET respuesta = $2, respuesta_fecha = NOW(), estado = $3
     WHERE id = $1
     RETURNING numero_hoja, email, nombre, apellidos, tipo_reclamo`,
    [body.id, body.respuesta.trim(), estado],
  );

  if (res.rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const r = res.rows[0];

  sendEmail({
    to: r.email,
    subject: `Respuesta a tu ${r.tipo_reclamo} — Hoja Nº ${r.numero_hoja} | FLUX`,
    html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border-radius:16px">
  <h2 style="color:#18191F;margin:0 0 8px">Respuesta a tu ${r.tipo_reclamo}</h2>
  <p style="color:#666;margin:0 0 16px">Hola ${r.nombre.split(" ")[0]}, te compartimos la respuesta formal de FLUX a tu ${r.tipo_reclamo} registrado con el número <strong>${r.numero_hoja}</strong>:</p>
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px;white-space:pre-wrap;color:#333;font-size:14px">${body.respuesta.trim().replace(/</g, "&lt;")}</div>
  <p style="color:#666;font-size:13px">Si tu caso no quedó resuelto, puedes acudir a <a href="https://www.consumidor.gob.pe" style="color:#1B4FFF">consumidor.gob.pe</a> (Indecopi).</p>
  <p style="color:#999;font-size:11px;margin-top:24px">© FLUX · Tika Services S.A.C. · RUC 20605702512</p>
</div>`,
  }).catch((err) => console.error(`${tag} email falló`, err));

  console.log(`${tag} ${session.email} respondió hoja=${r.numero_hoja}`);
  return NextResponse.json({ ok: true });
}
