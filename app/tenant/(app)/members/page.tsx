import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import type {
  DbTenantUser,
  DbTenantInvitation,
} from "@/lib/kyc/sdk/schema";
import { MembersClient } from "./MembersClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const session = (await getTenantSession())!;
  const [usersRes, invitesRes] = await Promise.all([
    query<DbTenantUser>(
      `SELECT * FROM kyc_tenant_users
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [session.user.tenant_id],
    ),
    query<DbTenantInvitation>(
      `SELECT * FROM kyc_tenant_invitations
       WHERE tenant_id = $1
       ORDER BY
         CASE WHEN accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 50`,
      [session.user.tenant_id],
    ),
  ]);

  const users = usersRes.rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
    is_self: u.id === session.user.id,
  }));

  const invites = invitesRes.rows.map((i) => {
    let state: "pending" | "accepted" | "revoked" | "expired" = "pending";
    if (i.accepted_at) state = "accepted";
    else if (i.revoked_at) state = "revoked";
    else if (new Date(i.expires_at) < new Date()) state = "expired";
    return {
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token, // completo: solo usado para construir accept_url de re-copia
      state,
      expires_at: i.expires_at,
      created_at: i.created_at,
    };
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Miembros del equipo</h1>
        <p className="text-white/50 text-sm mt-1">
          Invitá a más gente de tu team a ver las verificaciones. Podés
          revocar invites pendientes o desactivar miembros.
        </p>
      </div>
      <MembersClient
        initialUsers={users}
        initialInvites={invites}
        tenantId={session.user.tenant_id}
      />
    </div>
  );
}
