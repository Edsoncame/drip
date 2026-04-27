#!/usr/bin/env node
/**
 * IG setup automation:
 *  1. Genera profile pic 1080x1080 desde isotipoflux.svg con padding
 *  2. Genera 3 hero images para los primeros posts (FLUX brand)
 *  3. Sube todo a Vercel Blob
 *  4. (Próximo step manual) actualizá IG profile con esas URLs
 *
 * Uso: node scripts/ig-setup.mjs
 * (necesita BLOB_READ_WRITE_TOKEN, lo lee de .env.local o pull manual)
 */

import sharp from "sharp";
import { put } from "@vercel/blob";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT = "ig-setup-out";
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

// ──────────────────────────────────────────────────────────────────
// 1) Profile pic: isotipo centrado en fondo blanco, 1080x1080
// ──────────────────────────────────────────────────────────────────
console.log("[1/4] Generando profile pic 1080x1080...");
const isoSvg = await readFile("public/images/isotipoflux.svg");
const isoBuffer = await sharp(isoSvg, { density: 600 })
  .resize(700, 700, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .toBuffer();

const profilePic = await sharp({
  create: {
    width: 1080,
    height: 1080,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([{ input: isoBuffer, gravity: "center" }])
  .png()
  .toBuffer();

await writeFile(`${OUT}/profile-pic.png`, profilePic);
console.log(`   ✓ ${OUT}/profile-pic.png (${(profilePic.length / 1024).toFixed(0)}KB)`);

// ──────────────────────────────────────────────────────────────────
// 2) Story highlight covers (5 covers, 1080x1920 cropped to 110x110 use)
//    Cada cover: fondo gradient blue (#1B4FFF→#102F99) + emoji/ícono + label
// ──────────────────────────────────────────────────────────────────
console.log("[2/4] Generando 5 highlight covers...");
const highlights = [
  { emoji: "💻", label: "Equipos" },
  { emoji: "💰", label: "Precios" },
  { emoji: "📋", label: "Cómo funciona" },
  { emoji: "🏢", label: "Para empresas" },
  { emoji: "❓", label: "FAQ" },
];

for (let i = 0; i < highlights.length; i++) {
  const h = highlights[i];
  // SVG cover con gradient + emoji + label
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1B4FFF"/>
        <stop offset="100%" stop-color="#102F99"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#g)"/>
    <text x="540" y="500" font-size="320" text-anchor="middle" font-family="Apple Color Emoji, sans-serif">${h.emoji}</text>
    <text x="540" y="780" font-size="76" text-anchor="middle" fill="white" font-family="Inter, sans-serif" font-weight="700">${h.label}</text>
  </svg>`);
  const buf = await sharp(svg).png().toBuffer();
  await writeFile(`${OUT}/highlight-${i + 1}-${h.label.toLowerCase().replace(/\s+/g, "-")}.png`, buf);
}
console.log(`   ✓ 5 highlight covers`);

// ──────────────────────────────────────────────────────────────────
// 3) Hero post #1: branded gradient con logo + tagline
// ──────────────────────────────────────────────────────────────────
console.log("[3/4] Generando hero post #1 (welcome / launch)...");
const logoWhiteSvg = await readFile("public/images/logoflux-white.svg");
const logoBuffer = await sharp(logoWhiteSvg, { density: 600 })
  .resize(700, null, { fit: "inside" })
  .toBuffer();

const heroSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B4FFF"/>
      <stop offset="100%" stop-color="#102F99"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <text x="540" y="700" font-size="64" text-anchor="middle" fill="white" font-family="Inter, sans-serif" font-weight="800">MacBook para tu empresa</text>
  <text x="540" y="780" font-size="48" text-anchor="middle" fill="white" opacity="0.85" font-family="Inter, sans-serif" font-weight="500">desde $85/mes en Lima</text>
  <text x="540" y="900" font-size="36" text-anchor="middle" fill="white" opacity="0.7" font-family="Inter, sans-serif" font-weight="400">fluxperu.com</text>
</svg>`);

const heroBg = await sharp(heroSvg).png().toBuffer();
const post1 = await sharp(heroBg)
  .composite([{ input: logoBuffer, top: 380, left: 190 }])
  .png()
  .toBuffer();
await writeFile(`${OUT}/post-1-welcome.png`, post1);
console.log(`   ✓ post-1-welcome.png`);

// ──────────────────────────────────────────────────────────────────
// 4) Upload a Vercel Blob (si hay token)
// ──────────────────────────────────────────────────────────────────
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.log("[4/4] BLOB_READ_WRITE_TOKEN no seteado — saltando upload.");
  console.log("\n✅ Todo generado en ./ig-setup-out/. Subí manualmente o seteá la env y re-corré.");
  process.exit(0);
}

console.log("[4/4] Uploading a Vercel Blob...");
const uploads = [
  { file: "profile-pic.png", buf: profilePic, folder: "ig-profile" },
  { file: "post-1-welcome.png", buf: post1, folder: "ig-posts" },
];
for (let i = 0; i < highlights.length; i++) {
  const h = highlights[i];
  const slug = h.label.toLowerCase().replace(/\s+/g, "-");
  const buf = await readFile(`${OUT}/highlight-${i + 1}-${slug}.png`);
  uploads.push({ file: `highlight-${i + 1}-${slug}.png`, buf, folder: "ig-highlights" });
}

const urls = {};
for (const u of uploads) {
  const r = await put(`marketing/${u.folder}/${u.file}`, u.buf, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: true,
    allowOverwrite: false,
  });
  urls[u.file] = r.url;
  console.log(`   ✓ ${u.file} → ${r.url}`);
}

await writeFile(`${OUT}/urls.json`, JSON.stringify(urls, null, 2));
console.log(`\n✅ urls.json generado en ${OUT}/`);
