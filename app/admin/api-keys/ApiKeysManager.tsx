"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApiKeyItem, UserLite } from "./page";

const ALL_SCOPES = [
  { key: "subscriptions:read", label: "Leer suscripciones" },
  { key: "payments:read",      label: "Leer pagos" },
  { key: "invoices:read",      label: "Leer facturas" },
  { key: "users:read:self",    label: "Leer perfil propio" },
] as const;

export default function ApiKeysManager({ keys, users }: { keys: ApiKeyItem[]; users: UserLite[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    name: "",
    scopes: ["subscriptions:read", "payments:read"] as string[],
    rate_limit: "120",
    expires_in_days: "",
  });
  const [newToken, setNewToken] = useState<{ plain: string; name: string; prefix: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function create() {
    if (!form.user_id || !form.name.trim() || form.scopes.length === 0) {
      alert("Falta user_id, name o scopes");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: form.user_id,
        name: form.name.trim(),
        scopes: form.scopes,
        rate_limit: parseInt(form.rate_limit, 10) || 120,
        expires_in_days: form.expires_in_days ? parseInt(form.expires_in_days, 10) : undefined,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      alert(json.error ?? "Error creando API key");
      return;
    }
    setNewToken({ plain: json.plain_token, name: json.name, prefix: json.prefix });
    setCreating(false);
    setForm({ user_id: "", name: "", scopes: ["subscriptions:read", "payments:read"], rate_limit: "120", expires_in_days: "" });
    startTransition(() => router.refresh());
  }

  async function revoke(id: string, userId: string, name: string) {
    if (!confirm(`¿Revocar la key "${name}"? Los clientes usándola perderán acceso inmediatamente.`)) return;
    await fetch(`/api/admin/api-keys?id=${id}&user_id=${userId}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      {newToken && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5">
          <p className="text-sm font-700 text-emerald-800 mb-1">✅ API Key creada: {newToken.name}</p>
          <p className="text-xs text-emerald-700 mb-3">
            <strong>Copiá el token AHORA.</strong> No se vuelve a mostrar — solo el hash se guarda en BD.
          </p>
          <div className="bg-white rounded-xl p-3 border border-emerald-300 flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-[#18191F] break-all">{newToken.plain}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(newToken.plain); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-700 rounded-full cursor-pointer"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
          <button onClick={() => setNewToken(null)} className="mt-3 text-xs text-emerald-700 hover:underline cursor-pointer">
            Cerrar
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-[#1B4FFF] hover:bg-[#1340CC] text-white text-sm font-700 rounded-full cursor-pointer"
          >
            ＋ Crear nueva API key
          </button>
        ) : (
          <div className="space-y-4">
            <h3 className="font-700 text-[#18191F]">Nueva API key</h3>

            <div>
              <label className="block text-xs font-700 text-[#333] mb-1.5">Cliente dueño *</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
              >
                <option value="">— elegí un cliente —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}{u.company ? ` · ${u.company}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-700 text-[#333] mb-1.5">Nombre de la key *</label>
              <input
                type="text"
                placeholder="Ej: Integración ERP Securex"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
              />
            </div>

            <div>
              <label className="block text-xs font-700 text-[#333] mb-1.5">Scopes *</label>
              <div className="space-y-1.5">
                {ALL_SCOPES.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.scopes.includes(s.key)}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          scopes: e.target.checked
                            ? [...form.scopes, s.key]
                            : form.scopes.filter((x) => x !== s.key),
                        });
                      }}
                      className="w-4 h-4 accent-[#1B4FFF]"
                    />
                    <span className="text-[#333]">{s.label}</span>
                    <code className="text-[10px] text-[#999] bg-[#F7F7F7] px-1.5 py-0.5 rounded">{s.key}</code>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-700 text-[#333] mb-1.5">Rate limit (req/min)</label>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  value={form.rate_limit}
                  onChange={(e) => setForm({ ...form, rate_limit: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-700 text-[#333] mb-1.5">Expira en (días, vacío = nunca)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="365"
                  value={form.expires_in_days}
                  onChange={(e) => setForm({ ...form, expires_in_days: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={submitting}
                className="px-4 py-2 bg-[#1B4FFF] hover:bg-[#1340CC] text-white text-sm font-700 rounded-full cursor-pointer disabled:opacity-60"
              >
                {submitting ? "Creando…" : "Crear"}
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 text-sm text-[#666] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E5E5]">
          <h3 className="font-700 text-[#18191F]">{keys.length} key{keys.length !== 1 && "s"} · {keys.filter(k => !k.revoked_at).length} activa{keys.filter(k => !k.revoked_at).length !== 1 && "s"}</h3>
        </div>
        {keys.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#999]">
            Sin API keys creadas. La primera te permite que un cliente B2B consulte sus rentas vía REST.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7F7]">
              <tr>
                {["Nombre", "Cliente", "Prefix", "Scopes", "Usos", "Estado", "Acciones"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {keys.map(k => {
                const revoked = !!k.revoked_at;
                const expired = !revoked && k.expires_at && new Date(k.expires_at) < new Date();
                const active = !revoked && !expired;
                return (
                  <tr key={k.id} className={revoked ? "opacity-50" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-600">{k.name}</p>
                      <p className="text-[11px] text-[#999]">
                        Creada {new Date(k.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#18191F]">{k.user_name}</p>
                      <p className="text-[11px] text-[#999]">{k.user_email}</p>
                    </td>
                    <td className="px-4 py-3"><code className="text-xs bg-[#F7F7F7] px-2 py-1 rounded">{k.key_prefix}…</code></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>{k.usage_count}</p>
                      {k.last_used_at && (
                        <p className="text-[10px] text-[#999]">
                          Último: {new Date(k.last_used_at).toLocaleDateString("es-PE")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-700 ${
                        active ? "bg-green-100 text-green-700" :
                        revoked ? "bg-red-100 text-red-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {revoked ? "Revocada" : expired ? "Expirada" : "Activa"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {active && (
                        <button
                          onClick={() => revoke(k.id, k.user_id, k.name)}
                          className="text-xs text-red-600 hover:underline cursor-pointer"
                        >
                          Revocar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Docs block */}
      <div className="bg-[#0F172A] text-white rounded-2xl p-5 text-xs">
        <p className="font-700 mb-2 text-sm">📘 Cómo usar la API</p>
        <p className="text-white/70 mb-3">
          Los clientes con una API key activa pueden consultar su info vía REST. Endpoints disponibles:
        </p>
        <pre className="bg-black/40 p-3 rounded-xl font-mono whitespace-pre-wrap overflow-x-auto">{`curl https://www.fluxperu.com/api/v1/b2b/me \\
  -H "Authorization: Bearer flk_live_xxxxxxxxxxxx"

GET  /api/v1/b2b/me                        → perfil del dueño
GET  /api/v1/b2b/subscriptions             → lista sus subs
  ?status=delivered&limit=50
GET  /api/v1/b2b/payments                  → lista pagos
  ?subscription_id=xxx&status=validated`}</pre>
      </div>
    </div>
  );
}
