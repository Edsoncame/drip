#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";

const content = fs.readFileSync(".env.vercel", "utf8");
// Find the line — regex with multiline flag
const re = /^([A-Z_][A-Z0-9_]*)="((?:\\.|[^"\\])*)"/gm;
let found = null;
let match;
while ((match = re.exec(content)) !== null) {
  if (match[1] === "GOOGLE_SEARCH_CONSOLE_CREDENTIALS") {
    found = match[2];
    break;
  }
}

if (!found) {
  // Fallback — línea larga sin quotes match
  const lines = content.split("\n");
  for (const l of lines) {
    if (l.startsWith("GOOGLE_SEARCH_CONSOLE_CREDENTIALS=")) {
      found = l.slice("GOOGLE_SEARCH_CONSOLE_CREDENTIALS=".length);
      console.log("Fallback match, length:", found.length);
      if (found.startsWith('"')) found = found.slice(1);
      if (found.endsWith('"')) found = found.slice(0, -1);
      break;
    }
  }
}

if (!found) {
  console.log("❌ no match");
  process.exit(1);
}

console.log("raw length:", found.length);
console.log("first 300 raw:", found.slice(0, 300));

// Unescape dotenv-style
const unescaped = found.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
console.log("\nunescaped length:", unescaped.length);
console.log("unescaped first 300:", unescaped.slice(0, 300));

// Parse
try {
  const j = JSON.parse(unescaped);
  console.log("\n✅ JSON parse OK");
  console.log("client_email:", j.client_email);
  console.log("private_key length:", j.private_key.length);
  console.log("private_key starts:", j.private_key.slice(0, 60));
  console.log("private_key has real \\n:", j.private_key.includes("\n"));
  console.log("private_key has literal \\\\n:", j.private_key.includes("\\n"));

  // Try signing
  const pk = j.private_key.includes("\n") ? j.private_key : j.private_key.replace(/\\n/g, "\n");
  const sig = crypto.createSign("RSA-SHA256").update("test").sign(pk);
  console.log("\n✅ crypto sign OK, length:", sig.length);

  // Test real JWT token request
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: j.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })}`;
  const sig2 = crypto.createSign("RSA-SHA256").update(unsigned).sign(pk).toString("base64url");
  const jwt = `${unsigned}.${sig2}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await r.text();
  console.log("\nToken response:", r.status, body.slice(0, 500));
} catch (e) {
  console.log("❌ error:", e.message);
}
