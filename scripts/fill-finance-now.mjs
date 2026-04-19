#!/usr/bin/env node
/**
 * Corre los pullers ahora mismo para llenar abril 2026 con:
 *  - AWS Rekognition (desde kyc_face_matches)
 *  - Vercel Blob (desde tamaño KYC images)
 *  - Fixed costs (subscriptions typical_monthly_usd)
 */
import fs from "node:fs";
for (const f of [".env.vercel", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { pullAwsRekognition, pullVercelBlobComputed, pullFixedCosts } =
  await import("../lib/finance-pullers.ts");

const period = "2026-04";
console.log("Período:", period);

const [aws, blob, fixed] = await Promise.allSettled([
  pullAwsRekognition(period),
  pullVercelBlobComputed(period),
  pullFixedCosts(period),
]);

console.log("AWS:", aws);
console.log("Blob:", blob);
console.log("Fixed:", fixed);
process.exit(0);
