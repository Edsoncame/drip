"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
}

interface Props {
  users: AdminUser[];
  currentEmail: string;
  isSuperAdmin: boolean;
}

export default function UsuariosClient({ users, currentEmail, isSuperAdmin }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", isSuperAdmin: false });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setCreated({ email: json.email, password: json.password });
      setForm({ name: "", email: "", isSuperAdmin: false });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = async (userId: string, action: "promote" | "demote" | "remove") => {
    if (!confirm(action === "remove" ? "¿Quitar acceso admin a este usuario?" : "¿Cambiar rol?")) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    if (res.ok) startTransition(() => router.refresh());
    else {
      const j = await res.json();
      alert(j.error ?? "Error");
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-800 text-[#18191F]">Usuarios del equipo</h1>
          <p className="text-sm text-[#999999] mt-0.5">Administradores con acceso al panel de FLUX</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer"
            >
              + Crear usuario
            </button>
          )}
          <span className="px-3 py-1.5 rounded-full text-xs font-700 bg-purple-100 text-purple-700">
            {isSuperAdmin ? "👑 Super admin" : "Admin"}: {currentEmail}
          </span>
        </div>
      </div>

      {/* Created credentials banner */}
      {created && (
        <div className="mb-6 bg-green-50 border border-green-300 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-700 text-green-900">✓ Usuario creado</p>
            <button onClick={() => setCreated(null)} className="text-green-700 hover:text-green-900 text-sm">✕ Cerrar</button>
          </div>
          <p className="text-sm text-green-800 mb-3">
            Copia y comparte estas credenciales con el nuevo usuario (no se volverán a mostrar):
          </p>
          <div className="bg-white rounded-xl p-4 font-mono text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[#999] w-20">Email:</span>
              <span className="flex-1 font-700">{created.email}</span>
              <button onClick={() => navigator.clipboard.writeText(created.email)} className="text-[#1B4FFF] text-xs">Copiar</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#999] w-20">Password:</span>
              <span className="flex-1 font-700">{created.password}</span>
              <button onClick={() => navigator.clipboard.writeText(created.password)} className="text-[#1B4FFF] text-xs">Copiar</button>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-3">
            💡 Pídele que inicie sesión en <strong>/auth/login</strong> y cambie la contraseña desde su panel.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7F7]">
              <tr>
                {["Usuario", "Email", "Rol", "Registrado", isSuperAdmin ? "Acciones" : ""].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1B4FFF] flex items-center justify-center text-white text-xs font-700 flex-shrink-0">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-600 text-[#18191F]">{u.name ?? <span className="text-[#999] italic">Sin nombre</span>}</p>
                        {u.email.toLowerCase() === currentEmail && (
                          <p className="text-[10px] font-700 text-purple-700">Tú</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#333333]">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.is_super_admin ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-700 bg-purple-100 text-purple-700">👑 Super admin</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-700 bg-blue-100 text-blue-700">Admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666666]">
                    {new Date(u.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      {u.email.toLowerCase() === currentEmail ? (
                        <span className="text-[10px] text-[#999]">—</span>
                      ) : (
                        <div className="flex gap-2">
                          {u.is_super_admin ? (
                            <button onClick={() => toggleRole(u.id, "demote")} className="text-xs text-[#666] hover:text-[#1B4FFF] hover:underline cursor-pointer">Quitar super</button>
                          ) : (
                            <button onClick={() => toggleRole(u.id, "promote")} className="text-xs text-purple-700 hover:underline cursor-pointer">Hacer super</button>
                          )}
                          <button onClick={() => toggleRole(u.id, "remove")} className="text-xs text-red-600 hover:underline cursor-pointer">Remover</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-[#999]">Sin administradores</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isPending && <p className="text-xs text-[#1B4FFF] mt-3">Actualizando...</p>}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-800 text-[#18191F] mb-4">Crear usuario admin</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#666] mb-1">Nombre completo</label>
                <input
                  type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Luis Roque Ricse"
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#666] mb-1">Email</label>
                <input
                  type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })}
                  placeholder="luis@fluxperu.com"
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isSuperAdmin} onChange={e => setForm({ ...form, isSuperAdmin: e.target.checked })} />
                <span className="text-sm text-[#333]">Otorgar rol de <strong>Super admin</strong> (puede crear/borrar otros admins)</span>
              </label>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.name || !form.email}
                  className="flex-1 py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? "Creando..." : "Crear usuario"}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm font-600 text-[#666] cursor-pointer">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
