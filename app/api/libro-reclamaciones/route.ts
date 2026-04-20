import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendEmail, safeSend } from "@/lib/email";

interface Body {
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellidos: string;
  domicilio: string;
  telefono?: string;
  email: string;
  es_menor: boolean;
  rep_legal_nombre?: string;
  rep_legal_dni?: string;
  tipo_bien: string; // "producto" | "servicio"
  monto_reclamado?: number;
  descripcion_bien: string;
  tipo_reclamo: string; // "reclamo" | "queja"
  detalle_reclamo: string;
  pedido: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    // Basic validation
    const required = [
      "tipo_documento", "numero_documento", "nombre", "apellidos",
      "domicilio", "email", "tipo_bien", "descripcion_bien",
      "tipo_reclamo", "detalle_reclamo", "pedido",
    ] as const;
    for (const k of required) {
      if (!body[k] || String(body[k]).trim().length === 0) {
        return NextResponse.json({ error: `Campo requerido: ${k}` }, { status: 400 });
      }
    }
    if (body.es_menor && (!body.rep_legal_nombre || !body.rep_legal_dni)) {
      return NextResponse.json({ error: "Para menores de edad se requieren los datos del representante legal" }, { status: 400 });
    }

    const result = await query<{ id: string; numero_hoja: number }>(
      `INSERT INTO libro_reclamaciones (
        tipo_documento, numero_documento, nombre, apellidos, domicilio,
        telefono, email, es_menor, rep_legal_nombre, rep_legal_dni,
        tipo_bien, monto_reclamado, descripcion_bien,
        tipo_reclamo, detalle_reclamo, pedido
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, numero_hoja`,
      [
        body.tipo_documento, body.numero_documento, body.nombre.trim(),
        body.apellidos.trim(), body.domicilio.trim(),
        body.telefono ?? null, body.email.trim().toLowerCase(),
        body.es_menor, body.rep_legal_nombre ?? null, body.rep_legal_dni ?? null,
        body.tipo_bien, body.monto_reclamado ?? null,
        body.descripcion_bien.trim(), body.tipo_reclamo,
        body.detalle_reclamo.trim(), body.pedido.trim(),
      ]
    );

    const row = result.rows[0];
    const numeroHoja = String(row.numero_hoja).padStart(6, "0");

    // Email to customer (copy of complaint)
    const html = `
<div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto;background:#fff;padding:32px 24px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 16px">Hoja de Reclamación N° ${numeroHoja}</h1>
  <p style="color:#666;margin:0 0 16px">${body.nombre}, hemos recibido tu ${body.tipo_reclamo}. Este es el comprobante oficial de tu Hoja de Reclamación en el Libro de Reclamaciones de FLUX, conforme a la Ley N° 29571 del Código de Protección y Defensa del Consumidor.</p>
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px">
    <p style="margin:0 0 8px"><strong>N° de hoja:</strong> ${numeroHoja}</p>
    <p style="margin:0 0 8px"><strong>Fecha:</strong> ${new Date().toLocaleDateString("es-PE")}</p>
    <p style="margin:0 0 8px"><strong>Tipo:</strong> ${body.tipo_reclamo.toUpperCase()}</p>
    <p style="margin:0 0 8px"><strong>Bien contratado:</strong> ${body.tipo_bien}</p>
    <p style="margin:0"><strong>Descripción:</strong> ${body.descripcion_bien}</p>
  </div>
  <p style="color:#333;margin:0 0 8px"><strong>Detalle:</strong></p>
  <p style="color:#666;margin:0 0 16px;white-space:pre-wrap">${body.detalle_reclamo}</p>
  <p style="color:#333;margin:0 0 8px"><strong>Pedido:</strong></p>
  <p style="color:#666;margin:0 0 16px;white-space:pre-wrap">${body.pedido}</p>
  <p style="color:#666;margin:0 0 24px">Te responderemos en un plazo máximo de <strong>30 días calendario</strong> al correo ${body.email}.</p>
  <p style="color:#999;font-size:12px;margin:0">Tika Services S.A.C. — RUC 20605702512 — Av. Primavera 543, Piso 4, San Borja, Lima, Perú</p>
</div>`;
    void safeSend("libro_customer_receipt", () => sendEmail({
      to: body.email,
      subject: `Comprobante de Hoja de Reclamación N° ${numeroHoja} — FLUX`,
      html,
    }));

    // Email to admin
    void safeSend("libro_admin_notification", () => sendEmail({
      to: "hola@fluxperu.com",
      subject: `[Libro de Reclamaciones] Nueva hoja N° ${numeroHoja} — ${body.tipo_reclamo.toUpperCase()}`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:640px">
  <h1>Nueva Hoja de Reclamación N° ${numeroHoja}</h1>
  <p><strong>Cliente:</strong> ${body.nombre} ${body.apellidos} (${body.tipo_documento} ${body.numero_documento})</p>
  <p><strong>Contacto:</strong> ${body.email} · ${body.telefono ?? "—"}</p>
  <p><strong>Tipo:</strong> ${body.tipo_reclamo} sobre ${body.tipo_bien}</p>
  <p><strong>Descripción:</strong> ${body.descripcion_bien}</p>
  <p><strong>Detalle:</strong><br/>${body.detalle_reclamo.replace(/\n/g, "<br/>")}</p>
  <p><strong>Pedido:</strong><br/>${body.pedido.replace(/\n/g, "<br/>")}</p>
  <p>Ver en admin: https://www.fluxperu.com/admin/reclamaciones</p>
</div>`,
    }));

    console.log(`[libro] New complaint ${numeroHoja} from ${body.email}`);

    return NextResponse.json({ ok: true, numeroHoja });
  } catch (err) {
    console.error("[libro] error", err);
    return NextResponse.json({ error: "Error al registrar. Intenta de nuevo." }, { status: 500 });
  }
}
