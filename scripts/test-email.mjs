import fs from "node:fs";
for (const f of [".env.vercel", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { Resend } = await import("resend");
const r = new Resend(process.env.RESEND_API_KEY);
const res = await r.emails.send({
  from: "FLUX <hola@fluxperu.com>",
  to: "edsoncampanamelendez@gmail.com",
  subject: "¡Tu renta está confirmada, Edson! 🎉",
  html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
    <h1 style="font-size:26px;font-weight:900;color:#18191F">¡Todo listo, Edson!</h1>
    <p>Tu renta de <strong>MacBook Neo 13" — Apple A16 Pro</strong> está activa.</p>
    <div style="background:#F5F8FF;border-radius:12px;padding:20px;margin:20px 0">
      <p><strong>Estado:</strong> Preparando tu Mac</p>
      <p><strong>Plan:</strong> 8 meses · $85/mes</p>
      <p><strong>Entrega:</strong> Jirón Hermano Santos García 265, Surco (Depto 101, piso 1)</p>
      <p>En las próximas 24-48 h hábiles coordinaremos la entrega.</p>
    </div>
    <p>¿Dudas? Escríbenos por <a href="https://wa.me/51900164769" style="color:#1B4FFF">WhatsApp</a>.</p>
  </div>`,
});
console.log(JSON.stringify(res, null, 2));
