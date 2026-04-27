#!/usr/bin/env node
/**
 * A/B test de generadores de imagen para marketing FLUX.
 *
 * Genera los mismos prompts en 3 providers y crea un HTML side-by-side:
 *   1. Pollinations.ai — gratis, FLUX schnell distilled
 *   2. FLUX 1.1 Pro Ultra via Replicate — ~$0.06/img
 *   3. Grok 2 image via xAI — ~$0.07/img
 *
 * Uso:
 *   REPLICATE_API_TOKEN=r8_... XAI_API_KEY=xai-... node scripts/image-ab-test.mjs
 *   abrir ab-test-out/index.html
 *
 * Si falta una key, ese provider se skippea y los demás siguen.
 *
 * Costo total con 10 prompts: ~$1.30 (10x FLUX + 10x Grok). Pollinations gratis.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT_DIR = "ab-test-out";
const WIDTH = 1280;
const HEIGHT = 720;

const PROMPTS = [
  "Modern peruvian small business office, designer working on a MacBook Pro at a clean desk, natural window light, minimalist, lima city through window",
  "Close-up of hands typing on a MacBook keyboard, warm cinematic lighting, shallow depth of field, professional photography",
  "Aerial view of Miraflores Lima at golden hour, modern coffee shop with people working on laptops at outdoor tables",
  "Confident peruvian woman entrepreneur in her 30s smiling, sitting in a co-working space, soft daylight, candid editorial style",
  "Stack of MacBooks on a clean desk surface, product photography, soft white background, premium feel, no text",
  "Empty modern office with floor-to-ceiling windows overlooking lima skyline, scandinavian minimalist furniture, natural light",
  "Close-up of a video editor at work in a dimly lit studio, multiple monitors, focused atmosphere, cinematic",
  "Group of young creative professionals collaborating around a table with laptops, diverse team, brainstorming session, warm tone",
  "Architecture student presenting 3D renderings on laptop to client, blueprints on table, professional creative environment",
  "Coffee, notebook, and a sleek modern laptop on a wooden desk, top-down flat-lay style, morning light, lifestyle marketing",
];

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);
}

async function ensureOut() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
}

async function downloadTo(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

// ──────────────────────────────────────────────────────────────────────
// Provider 1: Pollinations (free, FLUX schnell)
// ──────────────────────────────────────────────────────────────────────
async function genPollinations(prompt, idx) {
  const seed = 42000 + idx;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt,
  )}?width=${WIDTH}&height=${HEIGHT}&seed=${seed}&nologo=true&model=flux`;
  const dest = path.join(OUT_DIR, `pollinations-${idx + 1}.jpg`);
  const t0 = Date.now();
  const size = await downloadTo(url, dest);
  return { provider: "pollinations", file: dest, ms: Date.now() - t0, bytes: size, cost_usd: 0 };
}

// ──────────────────────────────────────────────────────────────────────
// Provider 2: FLUX 1.1 Pro Ultra via Replicate
// ──────────────────────────────────────────────────────────────────────
async function genFluxPro(prompt, idx) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN no seteado");

  const t0 = Date.now();
  const createRes = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro-ultra/predictions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "16:9",
          output_format: "jpg",
          safety_tolerance: 2,
        },
      }),
    },
  );
  if (!createRes.ok) {
    throw new Error(`Replicate create HTTP ${createRes.status}: ${await createRes.text()}`);
  }
  const data = await createRes.json();

  // Polling si no salió en el wait inicial
  let pred = data;
  while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    pred = await pollRes.json();
  }
  if (pred.status !== "succeeded") {
    throw new Error(`Replicate ${pred.status}: ${JSON.stringify(pred.error || {})}`);
  }
  const imageUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const dest = path.join(OUT_DIR, `flux-pro-${idx + 1}.jpg`);
  const size = await downloadTo(imageUrl, dest);
  return { provider: "flux-pro-ultra", file: dest, ms: Date.now() - t0, bytes: size, cost_usd: 0.06 };
}

// ──────────────────────────────────────────────────────────────────────
// Provider 3: Grok 2 image via xAI
// ──────────────────────────────────────────────────────────────────────
async function genGrok(prompt, idx) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY no seteado");

  const t0 = Date.now();
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2-image-1212",
      prompt,
      n: 1,
      response_format: "url",
    }),
  });
  if (!res.ok) throw new Error(`xAI HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) throw new Error(`xAI sin url: ${JSON.stringify(data)}`);
  const dest = path.join(OUT_DIR, `grok-${idx + 1}.jpg`);
  const size = await downloadTo(imageUrl, dest);
  return { provider: "grok-2-image", file: dest, ms: Date.now() - t0, bytes: size, cost_usd: 0.07 };
}

// ──────────────────────────────────────────────────────────────────────
// Main: corre los 3 providers en paralelo por prompt
// ──────────────────────────────────────────────────────────────────────
async function runRow(prompt, idx) {
  log(`[${idx + 1}/${PROMPTS.length}] ${prompt.slice(0, 60)}...`);
  const tasks = await Promise.allSettled([
    genPollinations(prompt, idx),
    genFluxPro(prompt, idx),
    genGrok(prompt, idx),
  ]);
  return tasks.map((t, i) => {
    const provider = ["pollinations", "flux-pro-ultra", "grok-2-image"][i];
    if (t.status === "fulfilled") return t.value;
    log(`  ✗ ${provider}: ${t.reason?.message || t.reason}`);
    return { provider, error: t.reason?.message || String(t.reason), cost_usd: 0 };
  });
}

function renderHtml(rows) {
  const cell = (r) => {
    if (r.error) {
      return `<td class="err"><div class="bad">✗ ${r.provider}</div><pre>${r.error}</pre></td>`;
    }
    const filename = path.basename(r.file);
    return `<td><img src="${filename}" alt=""><div class="meta">${r.provider} · ${r.ms}ms · ${(r.bytes / 1024).toFixed(0)}kb · $${r.cost_usd.toFixed(3)}</div></td>`;
  };
  const tbody = rows
    .map(
      ({ prompt, results }, i) => `
    <tr><td colspan="3" class="prompt"><span class="num">${i + 1}.</span> ${prompt}</td></tr>
    <tr>${results.map(cell).join("")}</tr>`,
    )
    .join("");
  const totalCost = rows
    .flatMap((r) => r.results)
    .reduce((acc, r) => acc + (r.cost_usd ?? 0), 0);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>FLUX image A/B test</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #ddd; margin: 24px; }
  h1 { color: #fff; margin-bottom: 4px; }
  .summary { color: #888; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 8px; width: 33.33%; }
  td.prompt { background: #1a1a1a; padding: 12px 16px; color: #fff; font-size: 14px; border-radius: 6px; }
  td.prompt .num { color: #888; margin-right: 8px; }
  td img { width: 100%; border-radius: 6px; display: block; }
  td .meta { font-size: 11px; color: #666; padding: 6px 4px; font-family: ui-monospace, monospace; }
  td.err { background: #2a0a0a; }
  td.err .bad { color: #ff6464; font-weight: 700; }
  td.err pre { color: #ffaaaa; font-size: 11px; white-space: pre-wrap; }
</style></head><body>
<h1>FLUX image generator A/B test</h1>
<div class="summary">${rows.length} prompts × 3 providers · costo total ~$${totalCost.toFixed(2)} · ${new Date().toLocaleString("es-PE")}</div>
<table>
  <colgroup><col><col><col></colgroup>
  <thead><tr>
    <th style="text-align:left;color:#888;font-size:12px;text-transform:uppercase">Pollinations (free, FLUX schnell)</th>
    <th style="text-align:left;color:#888;font-size:12px;text-transform:uppercase">FLUX 1.1 Pro Ultra (~$0.06)</th>
    <th style="text-align:left;color:#888;font-size:12px;text-transform:uppercase">Grok 2 image (~$0.07)</th>
  </tr></thead>
  <tbody>${tbody}</tbody>
</table>
</body></html>`;
}

async function main() {
  await ensureOut();

  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
  const hasXai = !!process.env.XAI_API_KEY;
  log(`providers: pollinations=✓ flux-pro=${hasReplicate ? "✓" : "✗"} grok=${hasXai ? "✓" : "✗"}`);
  if (!hasReplicate) log("  → skipping FLUX. Conseguí key en https://replicate.com/account/api-tokens");
  if (!hasXai) log("  → skipping Grok. Conseguí key en https://console.x.ai (≥$5 credit)");

  const rows = [];
  for (let i = 0; i < PROMPTS.length; i++) {
    const results = await runRow(PROMPTS[i], i);
    rows.push({ prompt: PROMPTS[i], results });
  }

  const html = renderHtml(rows);
  const outFile = path.join(OUT_DIR, "index.html");
  await writeFile(outFile, html);

  const okCount = rows.flatMap((r) => r.results).filter((r) => !r.error).length;
  const totalCost = rows
    .flatMap((r) => r.results)
    .reduce((acc, r) => acc + (r.cost_usd ?? 0), 0);
  log(`done. ${okCount}/${rows.length * 3} imágenes generadas. Costo: $${totalCost.toFixed(2)}`);
  log(`abrí: ${path.resolve(outFile)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
