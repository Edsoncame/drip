import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Endpoint público temporal de diagnóstico — no expone secrets,
// solo reporta qué APIs están configuradas y si autentican.
// Ver DROPCHAT bootstrap pattern: idempotente y seguro.
//
// TODO: eliminar después del debugging inicial.

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!raw) return null;
  try {
    const creds = JSON.parse(raw) as { client_email: string; private_key: string };
    // Si la private_key tiene \n literal, convertir a newline real
    if (creds.private_key && !creds.private_key.includes("\n")) {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }
    return creds;
  } catch (err) {
    return { parse_error: err instanceof Error ? err.message : String(err) };
  }
}

async function getSaToken(scope: string): Promise<{ token?: string; error?: string }> {
  const creds = parseServiceAccount();
  if (!creds) return { error: "no creds env" };
  if ("parse_error" in creds) return { error: `parse: ${creds.parse_error}` };

  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: creds.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })}`;
  try {
    const sig = crypto
      .createSign("RSA-SHA256")
      .update(unsigned)
      .sign(creds.private_key)
      .toString("base64url");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${sig}`,
      }),
    });
    const body = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!r.ok) return { error: `${body.error}: ${body.error_description}` };
    return { token: body.access_token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const result: Record<string, unknown> = {};

  // ══════ Service Account parsing ══════
  const sa = parseServiceAccount();
  result.service_account = sa
    ? "parse_error" in sa
      ? { error: sa.parse_error }
      : { client_email: sa.client_email, has_private_key: !!sa.private_key }
    : { error: "GOOGLE_SEARCH_CONSOLE_CREDENTIALS no seteado" };

  // ══════ Google Ads ══════
  const adsEnvs = {
    developer_token: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    client_id: !!process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID ?? null,
    refresh_token: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
  };
  const googleAds: Record<string, unknown> = { envs: adsEnvs };

  if (Object.values(adsEnvs).every(Boolean)) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    const tok = (await r.json()) as { access_token?: string; error?: string };
    if (!r.ok) {
      googleAds.auth = `FAIL: ${tok.error}`;
    } else {
      googleAds.auth = "OK";
      // Test query directo al customer
      const cid = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, "");
      for (const ver of ["v21", "v20", "v19", "v18", "v17"]) {
        const q = await fetch(
          `https://googleads.googleapis.com/${ver}/customers/${cid}/googleAds:searchStream`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tok.access_token}`,
              "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
            }),
          },
        );
        const text = await q.text();
        if (q.ok) {
          try {
            googleAds.working_api_version = ver;
            googleAds.customer_info = JSON.parse(text);
          } catch {
            googleAds.working_api_version = ver;
            googleAds.customer_info = text.slice(0, 300);
          }
          break;
        } else {
          try {
            googleAds[`try_${ver}`] = JSON.parse(text);
          } catch {
            googleAds[`try_${ver}`] = `${q.status}: ${text.slice(0, 150)}`;
          }
        }
      }
    }
  }
  result.google_ads = googleAds;

  // ══════ GA4 ══════
  const ga4: Record<string, unknown> = {
    envs: {
      property_id: process.env.GA4_PROPERTY_ID ?? null,
      measurement_id: process.env.GA4_MEASUREMENT_ID ?? null,
    },
  };
  const ga4Tok = await getSaToken("https://www.googleapis.com/auth/analytics.readonly");
  ga4.auth = ga4Tok.token ? "OK" : `FAIL: ${ga4Tok.error}`;
  if (ga4Tok.token) {
    // Listar accounts/properties accesibles para este service account
    const listRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      { headers: { Authorization: `Bearer ${ga4Tok.token}` } },
    );
    const listBody = (await listRes.json()) as { accountSummaries?: unknown[] };
    ga4.accessible = listRes.ok ? listBody.accountSummaries ?? [] : listBody;
    if (process.env.GA4_PROPERTY_ID) {
      const r = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${ga4Tok.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
            metrics: [{ name: "activeUsers" }],
          }),
        },
      );
      ga4.test_report = r.ok ? await r.json() : { status: r.status, error: await r.text().then(t => t.slice(0, 300)) };
    }
  }
  result.ga4 = ga4;

  // ══════ Search Console ══════
  const gsc: Record<string, unknown> = {
    envs: { site_url: process.env.GSC_SITE_URL ?? null },
  };
  const gscTok = await getSaToken("https://www.googleapis.com/auth/webmasters.readonly");
  gsc.auth = gscTok.token ? "OK" : `FAIL: ${gscTok.error}`;
  if (gscTok.token) {
    const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${gscTok.token}` },
    });
    const sitesBody = (await sitesRes.json()) as { siteEntry?: unknown[] };
    gsc.accessible = sitesRes.ok ? sitesBody.siteEntry ?? [] : sitesBody;
  }
  result.gsc = gsc;

  return NextResponse.json(result);
}
