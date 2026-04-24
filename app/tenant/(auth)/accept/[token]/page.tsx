import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import {
  ensureSdkSchema,
  type DbTenantInvitation,
} from "@/lib/kyc/sdk/schema";
import { AcceptForm } from "./AcceptForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await ensureSdkSchema();

  const res = await query<DbTenantInvitation & { tenant_name: string }>(
    `SELECT i.*, t.name AS tenant_name
     FROM kyc_tenant_invitations i
     JOIN kyc_tenants t ON t.id = i.tenant_id
     WHERE i.token = $1 LIMIT 1`,
    [token],
  );
  const inv = res.rows[0];
  if (!inv) {
    notFound();
  }

  let state: "valid" | "expired" | "accepted" | "revoked" = "valid";
  if (inv.accepted_at) state = "accepted";
  else if (inv.revoked_at) state = "revoked";
  else if (new Date(inv.expires_at) < new Date()) state = "expired";

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-white/60 text-xs tracking-[0.3em] uppercase mb-3">
            Flux KYC
          </div>
          <h1 className="text-2xl font-semibold text-white">
            {state === "valid" ? `Unirte a ${inv.tenant_name}` : "Invitación"}
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {state === "valid" && <>Invitado como <span className="text-white/80">{inv.email}</span>. Elegí una contraseña para activar tu cuenta.</>}
            {state === "accepted" && "Esta invitación ya fue aceptada. Andá al login."}
            {state === "revoked" && "Esta invitación fue revocada. Pedí una nueva al admin."}
            {state === "expired" && "Esta invitación expiró. Pedí una nueva al admin."}
          </p>
        </div>
        {state === "valid" ? (
          <AcceptForm token={token} email={inv.email} />
        ) : (
          <div className="text-center">
            <a
              href="/tenant/login"
              className="inline-block bg-white text-black rounded-lg px-6 py-2.5 text-sm font-semibold"
            >
              Ir al login
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
