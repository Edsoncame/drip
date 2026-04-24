import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { ensureSdkSchema, type DbSdkSession } from "@/lib/kyc/sdk/schema";
import {
  getTenantBranding,
  DEFAULT_BRANDING,
  type BrandingTokens,
} from "@/lib/kyc/sdk/branding";
import { KycSdkFlow } from "./KycSdkFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Página pública de hosted-KYC para el SDK multi-tenant.
 *
 * El tenant genera un session_token JWT en su backend (via POST /api/kyc/sdk/sessions)
 * y redirige al usuario a:
 *
 *   https://fluxperu.com/kyc/s/<session_id>?t=<session_token>
 *
 * La página:
 *   1. Verifica que la sesión exista en DB y no esté expirada/cerrada.
 *   2. Renderiza el flow de captura (DNI frente + reverso + selfie 3 frames).
 *   3. Al terminar, llama a /finalize y muestra el verdict.
 *
 * Seguridad:
 *   - El JWT viene en query string por simplicidad del handoff, pero el
 *     client lo mueve inmediatamente a sessionStorage y limpia la URL con
 *     history.replaceState (así no queda en server logs futuros ni en
 *     el Referer cuando la página llame al API).
 *   - La validación real de auth la hace el backend en cada upload/finalize.
 *     Esta página solo pre-chequea que la sesión existe para dar UX limpia.
 */
export default async function KycSdkSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ session: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { session: sessionId } = await params;
  const { t: token } = await searchParams;

  if (!sessionId || !token) {
    notFound();
  }

  await ensureSdkSchema();
  const res = await query<DbSdkSession>(
    `SELECT id, tenant_id, status, expires_at FROM kyc_sdk_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  const session = res.rows[0];

  // Pre-fetch branding SOLO si la sesión existe. Si no, usamos defaults.
  const branding = session
    ? await getTenantBranding(session.tenant_id)
    : DEFAULT_BRANDING;

  if (!session) {
    return (
      <ErrorScreen
        title="Sesión no encontrada"
        detail="La sesión de verificación no existe o fue purgada."
        branding={branding}
      />
    );
  }

  const expired = new Date(session.expires_at) < new Date();
  if (expired || session.status === "expired") {
    return (
      <ErrorScreen
        title="Sesión expirada"
        detail="El tiempo para completar la verificación pasó. Pedí una nueva sesión en la app."
        branding={branding}
      />
    );
  }

  if (session.status === "completed") {
    return (
      <ErrorScreen
        title="Verificación ya completa"
        detail="Esta sesión ya fue finalizada. No se puede reutilizar."
        branding={branding}
      />
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: branding.background_color }}
    >
      <KycSdkFlow
        sessionId={sessionId}
        initialToken={token}
        tenantId={session.tenant_id}
        branding={branding}
      />
    </main>
  );
}

function ErrorScreen({
  title,
  detail,
  branding,
}: {
  title: string;
  detail: string;
  branding: BrandingTokens;
}) {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: branding.background_color }}
    >
      <div className="max-w-md text-center">
        {branding.logo_url && (
          <img
            src={branding.logo_url}
            alt=""
            className="h-10 mx-auto mb-5 object-contain max-w-[160px]"
          />
        )}
        <h1
          className="text-2xl font-semibold mb-3"
          style={{ color: branding.text_color }}
        >
          {title}
        </h1>
        <p style={{ color: branding.muted_text_color }}>{detail}</p>
      </div>
    </main>
  );
}
