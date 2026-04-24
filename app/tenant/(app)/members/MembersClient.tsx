"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  is_self: boolean;
}

interface InviteRow {
  id: string;
  email: string;
  role: string;
  token: string;
  state: "pending" | "accepted" | "revoked" | "expired";
  expires_at: Date;
  created_at: Date;
  emailed_at: Date | null;
  emailed_error: string | null;
}

export function MembersClient({
  initialUsers,
  initialInvites,
  tenantId,
}: {
  initialUsers: UserRow[];
  initialInvites: InviteRow[];
  tenantId: string;
}) {
  void tenantId; // reservado para features futuros (roles granulares, etc)
  const router = useRouter();
  const [users] = useState(initialUsers);
  const [invites] = useState(initialInvites);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("admin");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    accept_url: string;
    email: string;
    email_sent: boolean;
    email_error?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteResult(null);
    setInviting(true);
    try {
      const res = await fetch("/api/tenant/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
      } else {
        setInviteResult({
          accept_url: body.accept_url,
          email: newEmail,
          email_sent: !!body.email_sent,
          email_error: body.email_error ?? null,
        });
        setNewEmail("");
        // Refresh para ver el invite en la lista
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(token: string) {
    if (!confirm("Revocar esta invitación?")) return;
    const res = await fetch(`/api/tenant/invitations/${token}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  async function resendInvite(token: string) {
    setResending(token);
    try {
      await fetch(`/api/tenant/invitations/${token}/resend`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setResending(null);
    }
  }

  async function deactivate(userId: string) {
    if (!confirm("Desactivar este miembro? No podrá loggear más hasta que lo reactives.")) return;
    const res = await fetch("/api/tenant/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) router.refresh();
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // sin clipboard API (insecure context), fallback
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(el);
      }
    }
  }

  return (
    <>
      {/* Invitar */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-3">
        <h3 className="text-xs text-white/50 uppercase tracking-wider">
          Invitar nuevo miembro
        </h3>
        <form onSubmit={createInvite} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-white/60 mb-1">Email</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Rol</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
              className="bg-slate-950 border border-white/10 rounded px-2 py-2 text-white text-sm"
            >
              <option value="admin">admin</option>
              <option value="viewer">viewer (futuro)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting || !newEmail}
            className="bg-white text-black rounded px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {inviting ? "Creando…" : "Crear invitación"}
          </button>
        </form>
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
        {inviteResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4 space-y-2">
            <div className="text-emerald-300 text-sm font-semibold">
              ✓ Invitación creada para {inviteResult.email}
            </div>
            {inviteResult.email_sent ? (
              <div className="text-emerald-300/80 text-xs">
                📧 Email enviado — el usuario recibió el link automáticamente.
                Si nunca llegó, usá el botón "Reenviar" en la tabla o copiá el
                link de abajo.
              </div>
            ) : (
              <div className="text-amber-300 text-xs">
                ⚠ El email NO se pudo enviar
                {inviteResult.email_error ? ` (${inviteResult.email_error})` : ""}.
                Copiá el link y pasáselo al usuario por otro canal.
              </div>
            )}
            <code className="block bg-slate-950 border border-white/10 rounded px-3 py-2 text-emerald-300 font-mono text-xs break-all">
              {inviteResult.accept_url}
            </code>
            <button
              onClick={() => copyUrl(inviteResult.accept_url)}
              className="text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-1"
            >
              Copiar link
            </button>
          </div>
        )}
      </div>

      {/* Users list */}
      <div>
        <h2 className="text-lg font-medium mb-3">Miembros ({users.length})</h2>
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Último login</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-white/80">
                    {u.email} {u.is_self && <span className="text-white/40 text-xs">(vos)</span>}
                  </td>
                  <td className="px-4 py-3 text-white/70">{u.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="bg-white/10 text-white/70 text-xs px-2 py-0.5 rounded-full">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-emerald-400 text-xs">activo</span>
                    ) : (
                      <span className="text-white/40 text-xs">desactivado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleDateString("es-PE")
                      : "nunca"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!u.is_self && u.active && (
                      <button
                        onClick={() => deactivate(u.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invites list */}
      {invites.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">
            Invitaciones ({invites.filter((i) => i.state === "pending").length}{" "}
            pendientes)
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50 text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Email enviado</th>
                  <th className="px-4 py-2.5">Creada</th>
                  <th className="px-4 py-2.5">Expira</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 text-white/80">{i.email}</td>
                    <td className="px-4 py-3">
                      <InviteBadge state={i.state} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {i.emailed_at ? (
                        <span
                          className="text-emerald-400"
                          title={new Date(i.emailed_at).toLocaleString("es-PE")}
                        >
                          ✓ enviado
                        </span>
                      ) : i.emailed_error ? (
                        <span
                          className="text-amber-400"
                          title={i.emailed_error}
                        >
                          ⚠ falló
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {new Date(i.created_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {new Date(i.expires_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.state === "pending" && (
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => resendInvite(i.token)}
                            disabled={resending === i.token}
                            className="text-xs text-white/60 hover:text-white disabled:opacity-40"
                          >
                            {resending === i.token ? "Reenviando…" : "Reenviar email"}
                          </button>
                          <button
                            onClick={() => revokeInvite(i.token)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Revocar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function InviteBadge({ state }: { state: InviteRow["state"] }) {
  const map: Record<InviteRow["state"], string> = {
    pending: "bg-amber-500/20 text-amber-300",
    accepted: "bg-emerald-500/20 text-emerald-300",
    revoked: "bg-red-500/20 text-red-300",
    expired: "bg-white/10 text-white/40",
  };
  return (
    <span className={`${map[state]} text-xs px-2 py-0.5 rounded-full`}>
      {state}
    </span>
  );
}
