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
  if (isPrivateOrLoopbackIp(host)) return false;

  return true;
}

/**
 * True si `addr` es una IP literal de loopback / privada / link-local.
 * Acepta IPv4 (10.x, 192.168.x, 172.16-31.x, 127.x, 0.0.0.0, 169.254.x)
 * e IPv6 (::1, fe80::/10 link-local, fc00::/7 ULA).
 *
 * Exportado para que `webhook.ts` lo reuse chequeando la IP resuelta
 * por DNS (defensa anti-rebinding).
 */
export function isPrivateOrLoopbackIp(addr: string): boolean {
  const host = addr.toLowerCase();
  if (host === "0.0.0.0") return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true; // link-local / cloud metadata
  if (host.startsWith("172.")) {
    const second = parseInt(host.split(".")[1] ?? "", 10);
    if (!isNaN(second) && second >= 16 && second <= 31) return true;
  }
  // IPv6 — DNS devuelve sin brackets; URL.hostname los incluye
  const ipv6 = host.startsWith("[") ? host.slice(1, -1) : host;
  if (ipv6 === "::1") return true;
  if (ipv6.startsWith("fe80:")) return true;
  if (ipv6.startsWith("fc") || ipv6.startsWith("fd")) return true; // ULA
  return false;
}
