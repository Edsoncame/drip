// Migrate base64 data URLs in payments.receipt_url to Vercel Blob.
// Run: node scripts/migrate-receipts-to-blob.mjs

import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";
import pg from "pg";

// Load .env.local manually
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"(.*)"|(.*))$/);
    if (m) process.env[m[1]] = m[2] ?? m[3];
  }
} catch {}

const { Client } = pg;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN not set");

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { rows } = await db.query(
    `SELECT id, receipt_url FROM payments WHERE receipt_url LIKE 'data:%'`
  );

  console.log(`Found ${rows.length} receipts to migrate`);

  for (const row of rows) {
    try {
      const match = row.receipt_url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        console.warn(`✗ ${row.id} — invalid data URL format, skipping`);
        continue;
      }
      const mime = match[1];
      const base64 = match[2];
      const buffer = Buffer.from(base64, "base64");

      const ext =
        mime === "application/pdf" ? "pdf" :
        mime === "image/jpeg"      ? "jpg" :
        mime === "image/png"       ? "png" :
        mime === "image/webp"      ? "webp" : "bin";

      const path = `receipts/migrated/${row.id}.${ext}`;
      const blob = await put(path, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: mime,
      });

      await db.query(
        `UPDATE payments SET receipt_url = $1 WHERE id = $2`,
        [blob.url, row.id]
      );

      console.log(`✓ ${row.id} → ${blob.url} (${(buffer.length / 1024).toFixed(1)} KB ${mime})`);
    } catch (err) {
      console.error(`✗ ${row.id} — ${err.message}`);
    }
  }

  await db.end();
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
