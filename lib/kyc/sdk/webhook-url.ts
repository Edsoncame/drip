/**
 * Validación de URL de webhook saliente — protección SSRF.
 *
 * El SDK acepta `webhook_url` por sesión (provisto por el tenant). Aunque la
 * llamada saliente solo manda payload firmado y sin PII, restringimos:
 *   - Solo `https:` (no http, no file://, no data:)
 *   - Bloquea localhost / loopback / IPs privadas / link-local
 *
 * Defensa en profundidad: si un tenant tiene su API key comprometida, el
 * atacante NO puede usar el webhook saliente para escanear infra interna
 * (metadata Vercel, hosts privados, etc).
 *
 * Bloquea IPv4 RFC1918 + 169.254.0.0/16 (metadata service) + 127.0.0.0/8 +
 * IPv6 ::1 y fe80::/10 link-local. No es exhaustivo (no resuelve DNS para
 * detectar rebinding), pero cubre los vectores más comunes.
 */
export function isValidWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "0.0.0.0") return false;
  if (host.startsWith("127.")) return false;
  if (host.startsWith("10.")) return false;
  if (host.startsWith("192.168.")) return false;
  if (host.startsWith("169.254.")) return false; // link-local / cloud metadata
  // 172.16.0.0/12
  if (host.startsWith("172.")) {
    const second = parseInt(host.split(".")[1] ?? "", 10);
    if (!isNaN(second) && second >= 16 && second <= 31) return false;
  }
  // IPv6 — URL.hostname devuelve IPv6 entre brackets opcionalmente
  const ipv6 = host.startsWith("[") ? host.slice(1, -1) : host;
  if (ipv6 === "::1") return false;
  if (ipv6.startsWith("fe80:")) return false;
  if (ipv6.startsWith("fc") || ipv6.startsWith("fd")) return false; // ULA fc00::/7

  return true;
}
