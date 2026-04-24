import { query } from "@/lib/db";
import { DemoClient } from "./DemoClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo page pública — simula un sitio de cliente (Securex-style) con el
 * botón embebible real. Sirve para:
 *  - Mostrar al tenant cómo se ve la integración antes de pegar el snippet.
 *  - Smoke test end-to-end del flujo embed desde un sitio externo.
 *
 * Usa ?pk=<publishable_key> o, por default, busca la pk del tenant 'securex'
 * en DB. Como www.fluxperu.com está en allowed_origins para testing
 * (agregar manual en /tenant/settings), el botón debería funcionar aquí.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ pk?: string; tenant?: string }>;
}) {
  const sp = await searchParams;
  const tenantId = sp.tenant ?? "securex";

  // Si no se pasó pk, intentar leer la del tenant default (solo útil si el
  // deployment tiene acceso a DB + el tenant creó su pk en /tenant/settings).
  let pk = sp.pk ?? null;
  let allowedOrigins: string[] = [];
  if (!pk) {
    const res = await query<{
      publishable_key: string | null;
      allowed_origins: string[];
    }>(
      `SELECT publishable_key, allowed_origins FROM kyc_tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    pk = res.rows[0]?.publishable_key ?? null;
    allowedOrigins = res.rows[0]?.allowed_origins ?? [];
  }

  return (
    <DemoClient
      tenantId={tenantId}
      publishableKey={pk}
      allowedOrigins={allowedOrigins}
    />
  );
}
