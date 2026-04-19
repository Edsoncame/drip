#!/usr/bin/env node
/**
 * Audita el estado REAL de las 3 Google APIs que necesita el equipo de marketing.
 * Prueba cada una con las credenciales actuales y reporta qué falta.
 */
import fs from "node:fs";
import crypto from "node:crypto";

// Cargar .env.vercel con un parser que respete multilínea y escaped quotes
function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const content = fs.readFileSync(path, "utf8");
  // Vercel env pull guarda private keys multilínea. El terminador de cada entry
  // es una línea que empieza con OTRO `KEY=` o EOF. Parseo bloque por bloque.
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const headMatch = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!headMatch) { i++; continue; }
    const key = headMatch[1];
    let value = headMatch[2];
    if (value.startsWith('"')) {
      // Buscar el cierre: línea que TERMINA con `"` sin `\` precedente
      // y la siguiente línea empieza con OTRO KEY= o es EOF.
      value = value.slice(1);
      while (i + 1 < lines.length) {
        const endsQuote = value.endsWith('"') && !value.endsWith('\\"');
        const nextIsNewEntry =
          i + 1 === lines.length ||
          /^([A-Z_][A-Z0-9_]*)=/.test(lines[i + 1]);
        if (endsQuote && nextIsNewEntry) {
          value = value.slice(0, -1);
          break;
        }
        i++;
        value += "\n" + lines[i];
      }
      // Unescape dotenv
      value = value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    if (!process.env[key]) process.env[key] = value;
    i++;
  }
}
loadEnvFile(".env.vercel");
loadEnvFile(".env.local");

const results = { google_ads: {}, ga4: {}, gsc: {} };

// ─── Helper: JWT access token para service account ─────────
function parseServiceAccount(raw) {
  if (!raw) return null;
  // El raw viene del .env.vercel con formato dotenv: `"{\n  \"type\"..."`
  // Si process.env ya lo deserializó correctamente, es JSON parseable directamente.
  // Si no, hacemos unescape manual.
  try {
    return JSON.parse(raw);
  } catch {}
  // Fallback: strip outer quotes + unescape \" solamente
  let v = raw.trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  v = v.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  try {
    return JSON.parse(v);
  } catch (e) {
    console.log("  SA parse error:", e.message);
    return null;
  }
}

async function getServiceAccountToken(scope) {
  const creds = parseServiceAccount(process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS);
  if (!creds) return null;
  // Node crypto requiere newlines reales en el PEM
  if (creds.private_key && !creds.private_key.includes("\n")) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const claim = {
    iss: creds.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claim)}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(creds.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  if (!r.ok) return { error: `token: ${r.status} ${await r.text()}` };
  return (await r.json()).access_token;
}

// ─── 1. Google Ads (OAuth user refresh token) ──────────────
console.log("━━━ GOOGLE ADS ━━━");
{
  const required = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_REFRESH_TOKEN"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    results.google_ads.missing_envs = missing;
    console.log("❌ missing envs:", missing);
  } else {
    console.log("✅ all envs set");
    // Refresh → access token
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const tok = await r.json();
    if (!r.ok) {
      results.google_ads.auth = `FAIL: ${JSON.stringify(tok).slice(0, 200)}`;
      console.log("❌ auth:", tok);
    } else {
      results.google_ads.auth = "OK";
      console.log("✅ access token obtenido");
      // Test directo contra el customer que ya tenemos configurado
      const cid = process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, "");
      for (const ver of ["v18", "v17", "v16"]) {
        const cust = await fetch(`https://googleads.googleapis.com/${ver}/customers/${cid}/googleAds:searchStream`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok.access_token}`,
            "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
          }),
        });
        const text = await cust.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
        if (cust.ok) {
          results.google_ads.api_version_working = ver;
          results.google_ads.customer_info = body;
          console.log(`✅ ${ver} customer query OK`);
          console.log("  ", JSON.stringify(body).slice(0, 300));
          break;
        } else {
          const preview = typeof body === "string" ? body : JSON.stringify(body);
          console.log(`  ${ver} → ${cust.status}: ${preview.slice(0, 200)}`);
          results.google_ads[`try_${ver}`] = `${cust.status}: ${preview.slice(0, 200)}`;
        }
      }
    }
  }
}

// ─── 2. GA4 Data API ──────────────────────────────────────
console.log("\n━━━ GA4 ━━━");
{
  const token = await getServiceAccountToken("https://www.googleapis.com/auth/analytics.readonly");
  if (!token || token.error) {
    results.ga4.auth = token?.error ?? "no token";
    console.log("❌ token:", token);
  } else {
    results.ga4.auth = "OK";
    console.log("✅ service account token OK");

    // Check GA4_PROPERTY_ID
    const prop = process.env.GA4_PROPERTY_ID;
    if (!prop) {
      results.ga4.property_id = "FALTA";
      console.log("❌ GA4_PROPERTY_ID no seteado");
      // Intentar listar properties accesibles — requiere Account Admin API (otro scope)
      const acc = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
        headers: { Authorization: `Bearer ${await getServiceAccountToken("https://www.googleapis.com/auth/analytics.readonly")}` },
      });
      const accJson = await acc.json();
      results.ga4.accessible_properties = accJson.accountSummaries ?? accJson;
      console.log("  accessible accounts:", JSON.stringify(accJson).slice(0, 500));
    } else {
      console.log("✅ GA4_PROPERTY_ID:", prop);
      // Test report
      const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
          metrics: [{ name: "activeUsers" }],
        }),
      });
      const j = await r.json();
      results.ga4.test_report = r.ok ? "OK" : `FAIL: ${JSON.stringify(j).slice(0, 300)}`;
      console.log(r.ok ? "✅ test report OK" : "❌ test report:", j);
    }
  }
}

// ─── 3. Search Console ───────────────────────────────────
console.log("\n━━━ SEARCH CONSOLE ━━━");
{
  const token = await getServiceAccountToken("https://www.googleapis.com/auth/webmasters.readonly");
  if (!token || token.error) {
    results.gsc.auth = token?.error ?? "no token";
    console.log("❌ token:", token);
  } else {
    console.log("✅ service account token OK");
    // Listar sites accesibles — esto me dice exactamente qué poner en GSC_SITE_URL
    const sites = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sJ = await sites.json();
    if (!sites.ok) {
      results.gsc.list = `FAIL: ${JSON.stringify(sJ).slice(0, 300)}`;
      console.log("❌ list sites:", sJ);
    } else {
      results.gsc.accessible_sites = sJ.siteEntry ?? [];
      console.log("✅ accessible sites:", JSON.stringify(sJ.siteEntry ?? [], null, 2));
    }

    const gscUrl = process.env.GSC_SITE_URL;
    results.gsc.site_url_set = !!gscUrl;
    if (gscUrl) {
      console.log("✅ GSC_SITE_URL:", gscUrl);
    } else {
      console.log("❌ GSC_SITE_URL no seteado");
    }
  }
}

console.log("\n━━━ RESUMEN ━━━");
console.log(JSON.stringify(results, null, 2));
process.exit(0);
