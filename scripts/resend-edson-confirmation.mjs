#!/usr/bin/env node
/**
 * Reenvío manual del correo de confirmación a Edson Campaña Melendez.
 * Su subscription ya está en DB con status='preparing'; solo faltaba el email
 * porque RESEND_API_KEY estaba inválida cuando corrió el webhook.
 */
import fs from "node:fs";
for (const f of [".env.vercel", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { query } = await import("../lib/db.ts");
const { sendConfirmationEmail } = await import("../lib/email.ts");

const email = "edsoncampanamelendez@gmail.com";

const sub = await query(
  `SELECT s.product_name, s.months, s.monthly_price, s.ends_at, s.customer_name, s.customer_email, s.status
   FROM subscriptions s
   JOIN users u ON u.id = s.user_id
   WHERE u.email = $1
   ORDER BY s.started_at DESC
   LIMIT 1`,
  [email],
);

if (sub.rows.length === 0) {
  console.error(`No subscription para ${email}`);
  process.exit(1);
}

const r = sub.rows[0];
console.log(`sub encontrada: ${r.product_name} ${r.months}m status=${r.status}`);

await sendConfirmationEmail({
  to: r.customer_email || email,
  name: r.customer_name || "Edson",
  productName: r.product_name,
  months: r.months,
  price: parseFloat(r.monthly_price),
  endsAt: new Date(r.ends_at),
});

console.log(`✅ correo enviado a ${r.customer_email || email}`);
process.exit(0);
