import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendEmail, safeSend } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[reclamaciones]";

/**
 * Libro de Reclamaciones Virtual — obligación Indecopi (Ley 29571, art. 150).
 * Form público. Inserta una fila en libro_reclamaciones + avisa a ops.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  // Campos obligatorios según formato Indecopi
  const required = [
    "tipo_documento", "numero_documento", "nombre", "apellidos",
    "domicilio", "email", "tipo_bien", "descripcion_bien",
    "tipo_reclamo", "detalle_reclamo", "pedido",
  ];
  for (const k of required) {
    if (!body[k] || typeof body[k] !== "string" || !(body[k] as string).trim()) {
      return NextResponse.json(
        { error: `Campo obligatorio: ${k}` },
        { status: 400 },
      );
    }
  }

  // Enum validation
  const tipoDocumento = String(body.tipo_documento).toUpperCase();
  if (!["DNI", "CE", "PASAPORTE", "RUC"].includes(tipoDocumento)) {
    return NextResponse.json({ error: "tipo_documento inválido" }, { status: 400 });
  }
  const tipoBien = String(body.tipo_bien).toLowerCase();
  if (!["producto", "servicio"].includes(tipoBien)) {
    return NextResponse.json({ error: "tipo_bien debe ser producto o servicio" }, { status: 400 });
  }
  const tipoReclamo = String(body.tipo_reclamo).toLowerCase();
  if (!["reclamo", "queja"].includes(tipoReclamo)) {
    return NextResponse.json({ error: "tipo_reclamo debe ser reclamo o queja" }, { status: 400 });
  }

  // Menor de edad requiere rep legal
  const esMenor = body.es_menor === true;
  if (esMenor && (!body.rep_legal_nombre || !body.rep_legal_dni)) {
    return NextResponse.json(
      { error: "Si es menor de edad, se requiere representante legal (nombre + DNI)" },
      { status: 400 },
    );
  }

  const monto = body.monto_reclamado ? parseFloat(String(body.monto_reclamado)) : null;

  const res = await query<{ id: string; numero_hoja: number }>(
    `INSERT INTO libro_reclamaciones (
      tipo_documento, numero_documento, nombre, apellidos, domicilio, telefono, email,
      es_menor, rep_legal_nombre, rep_legal_dni,
      tipo_bien, monto_reclamado, descripcion_bien,
      tipo_reclamo, detalle_reclamo, pedido
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING id, numero_hoja`,
    [
      tipoDocumento,
      String(body.numero_documento).trim(),
      String(body.nombre).trim(),
      String(body.apellidos).trim(),
      String(body.domicilio).trim(),
      body.telefono ? String(body.telefono).trim() : null,
      String(body.email).trim().toLowerCase(),
      esMenor,
      body.rep_legal_nombre ? String(body.rep_legal_nombre).trim() : null,
      body.rep_legal_dni ? String(body.rep_legal_dni).trim() : null,
      tipoBien,
      monto,
      String(body.descripcion_bien).trim(),
      tipoReclamo,
      String(body.detalle_reclamo).trim(),
      String(body.pedido).trim(),
    ],
  );

  const { id, numero_hoja } = res.rows[0];
  console.log(`${tag} nueva hoja=${numero_hoja} id=${id} ${tipoReclamo} de ${body.email}`);

  // Indecopi exige respuesta dentro de 30 días hábiles → notificar a ops inmediatamente
  const nombreCompleto = `${String(body.nombre).trim()} ${String(body.apellidos).trim()}`;
  sendEmail({
    to: "hola@fluxperu.com",
    subject: `[LIBRO RECLAMACIONES] Hoja ${numero_hoja} — ${tipoReclamo.toUpperCase()} de ${nombreCompleto}`,
    html: `
<div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;border-radius:16px">
  <h2 style="color:#DC2626;margin:0 0 16px">⚠️ Nueva ${tipoReclamo} — Hoja Nº ${numero_hoja}</h2>
  <p style="color:#666">Indecopi exige respuesta dentro de <strong>30 días hábiles</strong>.</p>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#999">Consumidor</td><td style="color:#18191F;font-weight:600">${nombreCompleto}</td></tr>
    <tr><td style="padding:6px 0;color:#999">${tipoDocumento}</td><td style="color:#18191F">${body.numero_documento}</td></tr>
    <tr><td style="padding:6px 0;color:#999">Email</td><td style="color:#18191F">${body.email}</td></tr>
    <tr><td style="padding:6px 0;color:#999">Teléfono</td><td style="color:#18191F">${body.telefono ?? "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#999">Tipo de bien</td><td style="color:#18191F">${tipoBien} · $${monto ?? "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#999" colspan="2"><br><strong>Descripción:</strong><br>${String(body.descripcion_bien).replace(/</g, "&lt;")}</td></tr>
    <tr><td style="padding:6px 0;color:#999" colspan="2"><br><strong>Detalle del reclamo:</strong><br>${String(body.detalle_reclamo).replace(/</g, "&lt;")}</td></tr>
    <tr><td style="padding:6px 0;color:#999" colspan="2"><br><strong>Pedido del consumidor:</strong><br>${String(body.pedido).replace(/</g, "&lt;")}</td></tr>
  </table>
  <p style="color:#999;font-size:12px;margin-top:24px">© FLUX · Tika Services S.A.C. · RUC 20605702512</p>
</div>`,
  }).catch((err) => console.error(`${tag} email falló`, err));

  // Copia al reclamante (constancia legal)
  void safeSend("reclamaciones_customer_receipt", () => sendEmail({
    to: String(body.email).trim().toLowerCase(),
    subject: `Hemos recibido tu ${tipoReclamo} — Hoja Nº ${numero_hoja} | FLUX`,
    html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border-radius:16px">
  <h2 style="color:#18191F;margin:0 0 8px">Hemos recibido tu ${tipoReclamo}</h2>
  <p style="color:#666;margin:0 0 16px">Hola ${String(body.nombre).split(" ")[0]}, registramos tu ${tipoReclamo} en nuestro Libro de Reclamaciones con el número <strong>${numero_hoja}</strong>.</p>
  <p style="color:#666;margin:0 0 16px">De acuerdo con la Ley 29571, te responderemos en un plazo máximo de <strong>30 días hábiles</strong> al email ${body.email}.</p>
  <p style="color:#666;font-size:13px;margin-top:24px">Si tu caso es urgente, escríbenos directamente a <a href="mailto:hola@fluxperu.com">hola@fluxperu.com</a> o a <a href="https://wa.me/51900164769">WhatsApp +51 900 164 769</a>.</p>
  <p style="color:#999;font-size:11px;margin-top:24px">© FLUX · Tika Services S.A.C.</p>
</div>`,
  }));

  return NextResponse.json({ ok: true, numero_hoja, id }, { status: 201 });
}
