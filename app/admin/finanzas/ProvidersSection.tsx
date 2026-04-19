"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Snapshot = {
  period: string;
  rows: Array<{
    provider: {
      slug: string;
      name: string;
      category: string;
      website: string | null;
      billing_type: string;
      typical_monthly_usd: string | null;
      currency: string;
      notes: string | null;
    };
    manual_usd: number;
    manual_pen: number;
    auto_usd: number | null;
    total_usd: number;
    expenses: Array<{
      id: number;
      amount_usd: string | null;
      amount_pen: string | null;
      source: string;
      invoice_url: string | null;
      notes: string | null;
      paid_at: Date | string | null;
    }>;
  }>;
  totals: {
    total_usd: number;
    total_pen: number;
    by_category: Array<{ category: string; usd: number }>;
  };
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  hosting:   { label: "Hosting",       icon: "☁️", color: "bg-blue-100 text-blue-700" },
  "ai-api":  { label: "AI APIs",       icon: "🧠", color: "bg-purple-100 text-purple-700" },
  payments:  { label: "Pagos",         icon: "💳", color: "bg-indigo-100 text-indigo-700" },
  email:     { label: "Email",         icon: "✉️", color: "bg-cyan-100 text-cyan-700" },
  database:  { label: "Base de datos", icon: "🗃️", color: "bg-emerald-100 text-emerald-700" },
  storage:   { label: "Almacenamiento",icon: "📦", color: "bg-amber-100 text-amber-700" },
  domain:    { label: "Dominio",       icon: "🌐", color: "bg-slate-100 text-slate-700" },
  legal:     { label: "Legal",         icon: "⚖️", color: "bg-gray-100 text-gray-700" },
  mdm:       { label: "MDM",           icon: "🔒", color: "bg-red-100 text-red-700" },
  marketing: { label: "Marketing",     icon: "📣", color: "bg-pink-100 text-pink-700" },
  whatsapp:  { label: "WhatsApp",      icon: "💬", color: "bg-green-100 text-green-700" },
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPen(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProvidersSection({ snapshot, availablePeriods }: {
  snapshot: Snapshot;
  availablePeriods: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ amount_usd: "", amount_pen: "", invoice_url: "", notes: "" });
  const [saving, setSaving] = useState(false);

  function changePeriod(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("period", p);
    window.location.href = url.toString();
  }

  function startEdit(slug: string, currentUsd: number, currentPen: number, invoice: string | null, notes: string | null) {
    setEditing(slug);
    setForm({
      amount_usd: currentUsd > 0 ? String(currentUsd) : "",
      amount_pen: currentPen > 0 ? String(currentPen) : "",
      invoice_url: invoice ?? "",
      notes: notes ?? "",
    });
  }

  async function save(slug: string) {
    if (!form.amount_usd && !form.amount_pen) {
      alert("Ingresá monto en USD o PEN");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/finance-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_slug: slug,
        period: snapshot.period,
        amount_usd: form.amount_usd || null,
        amount_pen: form.amount_pen || null,
        invoice_url: form.invoice_url || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Error guardando");
      return;
    }
    setEditing(null);
    startTransition(() => router.refresh());
  }

  async function removeExpense(id: number) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await fetch(`/api/admin/finance-expenses?id=${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  // Group providers by category
  const grouped = new Map<string, typeof snapshot.rows>();
  for (const r of snapshot.rows) {
    const arr = grouped.get(r.provider.category) ?? [];
    arr.push(r);
    grouped.set(r.provider.category, arr);
  }

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-800 text-[#18191F]">Proveedores Tech / SaaS</h2>
          <p className="text-xs text-[#999] mt-0.5">Costos mensuales — manual + auto-cálculo donde es posible</p>
        </div>
        <select
          value={snapshot.period}
          onChange={(e) => changePeriod(e.target.value)}
          className="px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white"
        >
          {availablePeriods.map((p) => (
            <option key={p} value={p}>
              {new Date(p + "-01").toLocaleDateString("es-PE", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
          <div className="text-2xl mb-2">💰</div>
          <p className="text-2xl font-800 text-[#18191F]">{fmtUsd(snapshot.totals.total_usd)}</p>
          <p className="text-xs text-[#666] mt-1">Total del mes (USD)</p>
        </div>
        {snapshot.totals.by_category.slice(0, 3).map((c) => {
          const meta = CATEGORY_LABELS[c.category] ?? { label: c.category, icon: "📊", color: "" };
          return (
            <div key={c.category} className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
              <div className="text-2xl mb-2">{meta.icon}</div>
              <p className="text-xl font-800 text-[#18191F]">{fmtUsd(c.usd)}</p>
              <p className="text-xs text-[#666] mt-1">{meta.label}</p>
            </div>
          );
        })}
      </div>

      {/* Providers grouped by category */}
      {Array.from(grouped.entries()).map(([category, rows]) => {
        const meta = CATEGORY_LABELS[category] ?? { label: category, icon: "📊", color: "bg-gray-100 text-gray-700" };
        const subtotal = rows.reduce((s, r) => s + r.total_usd, 0);
        return (
          <div key={category} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
            <div className="px-6 py-4 bg-[#F7F8FB] border-b border-[#E5E5E5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.icon}</span>
                <h3 className="font-700 text-[#18191F]">{meta.label}</h3>
                <span className="text-xs text-[#999]">· {rows.length} proveedor{rows.length !== 1 && "es"}</span>
              </div>
              <p className="font-800 text-[#1B4FFF]">{fmtUsd(subtotal)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[#F0F0F0]">
                    {["Proveedor", "Monto USD", "Monto PEN", "Fuente", "Factura", "Acción"].map((h) => (
                      <th key={h} className="px-4 py-2 text-[11px] font-700 text-[#999] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isEditing = editing === r.provider.slug;
                    const isAuto = r.auto_usd !== null;
                    const manualExpense = r.expenses.find((e) => e.source === "manual");

                    return (
                      <tr key={r.provider.slug} className="border-b border-[#F7F7F7] align-top hover:bg-[#FAFBFF]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-700 text-[#18191F]">{r.provider.name}</p>
                            {r.provider.website && (
                              <a href={r.provider.website} target="_blank" rel="noreferrer" className="text-[#1B4FFF] text-xs hover:underline">↗</a>
                            )}
                          </div>
                          {r.provider.notes && (
                            <p className="text-[11px] text-[#999] mt-0.5">{r.provider.notes}</p>
                          )}
                          <p className="text-[10px] text-[#999] mt-0.5 uppercase">{r.provider.billing_type}</p>
                        </td>

                        {isEditing ? (
                          <>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={form.amount_usd}
                                onChange={(e) => setForm({ ...form, amount_usd: e.target.value })}
                                className="w-24 px-2 py-1 text-sm border border-[#1B4FFF] rounded-lg outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={form.amount_pen}
                                onChange={(e) => setForm({ ...form, amount_pen: e.target.value })}
                                className="w-24 px-2 py-1 text-sm border border-[#1B4FFF] rounded-lg outline-none"
                              />
                            </td>
                            <td className="px-4 py-3" colSpan={2}>
                              <input
                                type="url"
                                placeholder="URL factura (opcional)"
                                value={form.invoice_url}
                                onChange={(e) => setForm({ ...form, invoice_url: e.target.value })}
                                className="w-full px-2 py-1 text-xs border border-[#E5E5E5] rounded-lg outline-none"
                              />
                              <input
                                type="text"
                                placeholder="Nota (opcional)"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full mt-1 px-2 py-1 text-xs border border-[#E5E5E5] rounded-lg outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => save(r.provider.slug)}
                                  disabled={saving}
                                  className="px-2 py-1 bg-[#1B4FFF] text-white text-xs font-700 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  {saving ? "…" : "✓"}
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  className="px-2 py-1 text-xs text-[#666] cursor-pointer"
                                >✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              {r.total_usd > 0 ? (
                                <p className="font-700 text-[#18191F]">{fmtUsd(r.total_usd)}</p>
                              ) : (
                                <span className="text-[#999] text-xs">—</span>
                              )}
                              {isAuto && r.manual_usd > 0 && (
                                <p className="text-[10px] text-[#999]">
                                  auto {fmtUsd(r.auto_usd!)} + manual {fmtUsd(r.manual_usd)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {r.manual_pen > 0 ? (
                                <p className="text-[#333]">{fmtPen(r.manual_pen)}</p>
                              ) : (
                                <span className="text-[#999] text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isAuto ? (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-700">
                                  auto
                                </span>
                              ) : r.manual_usd > 0 || r.manual_pen > 0 ? (
                                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-700">
                                  manual
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#999]">sin registro</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {manualExpense?.invoice_url ? (
                                <a href={manualExpense.invoice_url} target="_blank" rel="noreferrer" className="text-[#1B4FFF] text-xs hover:underline">Ver</a>
                              ) : (
                                <span className="text-[#999] text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(r.provider.slug, r.manual_usd, r.manual_pen, manualExpense?.invoice_url ?? null, manualExpense?.notes ?? null)}
                                  className="text-xs text-[#1B4FFF] hover:underline cursor-pointer"
                                >
                                  {manualExpense ? "Editar" : "+ Agregar"}
                                </button>
                                {manualExpense && (
                                  <button
                                    onClick={() => removeExpense(manualExpense.id)}
                                    className="text-xs text-red-500 hover:underline cursor-pointer"
                                  >Borrar</button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-[#999]">
        * <strong>auto</strong>: calculado desde la BD (Anthropic desde <code>marketing_agent_runs.cost_usd</code> + arbiter KYC; Stripe 2.9% + $0.30 por tx validada del mes).
        El resto se carga manual cuando llega la factura del proveedor.
      </p>
    </div>
  );
}
