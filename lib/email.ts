import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "FLUX <hola@flux.pe>";

export async function sendConfirmationEmail({
  to, name, productName, months, price, endsAt,
}: {
  to: string; name: string; productName: string;
  months: number; price: number; endsAt: Date;
}) {
  const firstName = name.split(" ")[0];
  const endStr = endsAt.toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });

  await resend.emails.send({
    from: FROM,
    to,
    subject: `¡Tu renta está confirmada, ${firstName}! 🎉`,
    html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:28px;font-weight:900;color:#18191F;margin:0 0 8px">¡Todo listo, ${firstName}!</h1>
  <p style="color:#666;margin:0 0 24px">Tu renta está activa. En las próximas 24 horas hábiles te coordinaremos la entrega.</p>
  <div style="background:#F7F7F7;border-radius:12px;padding:20px;margin-bottom:24px">
    <p style="margin:0 0 12px;font-weight:700;color:#333">Resumen de tu renta</p>
    <table style="width:100%;font-size:14px;color:#555">
      <tr><td>Equipo</td><td style="text-align:right;font-weight:600;color:#18191F">${productName}</td></tr>
      <tr><td>Plan</td><td style="text-align:right;font-weight:600;color:#18191F">${months} meses</td></tr>
      <tr><td>Renta mensual</td><td style="text-align:right;font-weight:600;color:#18191F">$${price}/mes</td></tr>
      <tr><td>Vence</td><td style="text-align:right;font-weight:600;color:#18191F">${endStr}</td></tr>
    </table>
  </div>
  <p style="color:#666;font-size:13px">¿Tienes dudas? Escríbenos a <a href="mailto:hola@flux.pe" style="color:#1B4FFF">hola@flux.pe</a> o al WhatsApp <a href="https://wa.me/51999000000" style="color:#1B4FFF">+51 999 000 000</a>.</p>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
  });
}

export async function sendPasswordResetEmail({
  to, name, resetUrl,
}: {
  to: string; name: string; resetUrl: string;
}) {
  const firstName = name.split(" ")[0];

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Recupera tu contraseña de FLUX",
    html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:24px;font-weight:900;color:#18191F;margin:0 0 8px">Hola, ${firstName}</h1>
  <p style="color:#666;margin:0 0 24px">Recibimos una solicitud para recuperar tu contraseña. Si fuiste tú, haz clic abajo. Si no, ignora este correo.</p>
  <a href="${resetUrl}" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:15px">Crear nueva contraseña</a>
  <p style="color:#999;font-size:13px;margin-top:24px">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este email.</p>
  <p style="color:#999;font-size:12px;margin-top:16px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
  });
}

export async function sendB2BLeadEmail({
  nombre, empresa, email, telefono, cantidad, modelo, mensaje,
}: {
  nombre: string; empresa: string; email: string;
  telefono: string; cantidad: string; modelo: string; mensaje: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: "ventas@flux.pe",
    replyTo: email,
    subject: `Nueva cotización B2B — ${empresa} (${cantidad} Macs)`,
    html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h2 style="color:#18191F">Nueva solicitud de cotización</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Nombre</td><td style="font-weight:600">${nombre}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Empresa</td><td style="font-weight:600">${empresa}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Teléfono</td><td>${telefono}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Cantidad</td><td style="font-weight:700;color:#1B4FFF">${cantidad} equipos</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Modelo</td><td>${modelo}</td></tr>
    <tr><td style="padding:8px 0;color:#999;vertical-align:top">Mensaje</td><td>${mensaje || "—"}</td></tr>
  </table>
</div>`,
  });
}
