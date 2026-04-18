#!/usr/bin/env node
/**
 * Corre el arbiter KYC sobre el caso de Edson (corr=be14dba5...).
 * Su KYC quedó en 'review' por nombre borderline; necesitamos un veredicto
 * definitivo para decidir si su subscription sigue o se cancela.
 */
import fs from "node:fs";
for (const f of [".env.vercel", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const CORR_ID = "be14dba5-d712-470b-a010-e6ce23139152";

const { query } = await import("../lib/db.ts");
const { arbitrateKyc } = await import("../lib/kyc/arbiter.ts");

// Traemos scan + face match + user
const scanRow = await query(
  `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1 ORDER BY created_at DESC LIMIT 1`,
  [CORR_ID],
);
const faceRow = await query(
  `SELECT * FROM kyc_face_matches WHERE correlation_id = $1 ORDER BY created_at DESC LIMIT 1`,
  [CORR_ID],
);
const userRow = await query(
  `SELECT name, dni_number FROM users WHERE email = 'edsoncampanamelendez@gmail.com'`,
);
// Buscamos el name_score en kyc_attempts
const attemptRow = await query(
  `SELECT payload FROM kyc_attempts WHERE correlation_id=$1 AND step='match' ORDER BY created_at DESC LIMIT 1`,
  [CORR_ID],
);

const scan = scanRow.rows[0];
const face = faceRow.rows[0];
const user = userRow.rows[0];
const attemptPayload = attemptRow.rows[0]?.payload ?? {};
const nameScore = attemptPayload.name_score ?? 0.85;

console.log("Scan:", {
  apellido_paterno: scan.apellido_paterno,
  apellido_materno: scan.apellido_materno,
  prenombres: scan.prenombres,
  dni_number: scan.dni_number,
});
console.log("Face:", { score: face.score, passed: face.passed, liveness: face.liveness_passed });
console.log("User form:", user);
console.log("name_score:", nameScore);
console.log("DNI image URL:", scan.imagen_anverso_key);
console.log("Selfie URL:", face.selfie_key);

if (!scan.imagen_anverso_key?.startsWith("http")) {
  console.error("❌ DNI key no es URL absoluta — no podemos arbitrar");
  process.exit(1);
}

console.log("\nLlamando al arbiter...\n");
const verdict = await arbitrateKyc({
  formName: user.name ?? "",
  formDniNumber: user.dni_number ?? "",
  scanApellidoPaterno: scan.apellido_paterno,
  scanApellidoMaterno: scan.apellido_materno,
  scanPrenombres: scan.prenombres,
  scanDniNumber: scan.dni_number,
  nameScore: parseFloat(nameScore),
  faceScore: parseFloat(face.score),
  livenessPassed: face.liveness_passed,
  dniImageUrl: scan.imagen_anverso_key,
  selfieImageUrl: face.selfie_key,
});

console.log("\n════════ VEREDICTO DEL ARBITER ════════");
console.log(JSON.stringify(verdict, null, 2));
console.log("═══════════════════════════════════════\n");

// Aplicar veredicto
if (verdict.verdict === "verified") {
  await query(
    `UPDATE users SET kyc_status='verified', identity_verified=true, kyc_verified_at=NOW() WHERE email='edsoncampanamelendez@gmail.com'`,
  );
  console.log("✅ users.kyc_status → 'verified' · identity_verified=true");
  console.log("✅ Subscription sigue en 'preparing' (flujo normal de despacho)");
} else {
  await query(
    `UPDATE users SET kyc_status='rejected' WHERE email='edsoncampanamelendez@gmail.com'`,
  );
  await query(
    `UPDATE subscriptions SET status='cancelled', admin_note='Auto-cancelada por arbiter KYC: ' || $1 WHERE customer_email='edsoncampanamelendez@gmail.com' AND status='preparing'`,
    [verdict.reason.slice(0, 200)],
  );
  console.log("❌ users.kyc_status → 'rejected'");
  console.log("❌ Subscription → 'cancelled' (requiere refund en Stripe manual)");
}

process.exit(0);
