import { redirect } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import { LogoutButton } from "./LogoutButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Layout del dashboard del tenant. Vive bajo /tenant/(app)/ — route group
 * que comparte URL con /tenant pero NO envuelve a /tenant/(auth)/login.
 * Auth-guard: sin sesión → redirect a /tenant/login.
 */
export default async function TenantAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getTenantSession();
  if (!session) {
    redirect("/tenant/login");
  }

  // Count de sessions en review pendientes → badge en la nav. 1 query extra
  // por render pero es cheap (index parcial idx_sdk_sessions_review_queue).
  const pendingRes = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM kyc_sdk_sessions
     WHERE tenant_id = $1 AND status = 'review' AND reviewed_at IS NULL`,
    [session.user.tenant_id],
  );
  const pendingReviews = parseInt(pendingRes.rows[0]?.n ?? "0", 10);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/tenant"
              className="text-sm font-semibold tracking-[0.15em] uppercase"
            >
              Flux KYC
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/tenant"
                className="text-white/70 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/tenant/review"
                className="text-white/70 hover:text-white transition flex items-center gap-1.5"
              >
                Revisión
                {pendingReviews > 0 && (
                  <span className="bg-amber-500/30 text-amber-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {pendingReviews}
                  </span>
                )}
              </Link>
              <Link
                href="/tenant/members"
                className="text-white/70 hover:text-white transition"
              >
                Miembros
              </Link>
              <Link
                href="/tenant/settings"
                className="text-white/70 hover:text-white transition"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-white/50">
              <div>{session.user.email}</div>
              <div className="text-white/30">
                tenant: {session.user.tenant_id}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
