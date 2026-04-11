"use client";

import { useState, useEffect, useCallback } from "react";

interface VaultEntry {
  id: string;
  category: string;
  nombre: string;
  url: string | null;
  usuario: string | null;
  password: string;
  notas: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Apple":          "🍎",
  "MDM":            "📱",
  "Dispositivos":   "💻",
  "Infraestructura":"⚙️",
  "Pagos":          "💳",
  "Email":          "✉️",
  "General":        "🔑",
};

const CATEGORIES = ["Apple", "MDM", "Dispositivos", "Infraestructura", "Pagos", "Email", "General"];

// ── Small helpers ─────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-[#999] hover:text-[#1B4FFF] transition-colors cursor-pointer" title="Copiar">
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      )}
    </button>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────
function EntryCard({ entry, onEdit, onDelete }: {
  entry: VaultEntry;
  onEdit: (e: VaultEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 hover:border-[#C7D2FE] hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-700 text-[#18191F] text-sm">{entry.nombre}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg hover:bg-[#EEF2FF] text-[#666] hover:text-[#1B4FFF] transition-colors cursor-pointer"
            title="Editar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-[#666] hover:text-red-500 transition-colors cursor-pointer"
            title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {entry.url && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#999] w-16 flex-shrink-0">URL</span>
            <a href={entry.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#1B4FFF] hover:underline truncate flex-1">{entry.url}</a>
          </div>
        )}
        {entry.usuario && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#999] w-16 flex-shrink-0">Usuario</span>
            <span className="text-xs text-[#333] font-500 flex-1 font-mono truncate">{entry.usuario}</span>
            <CopyBtn text={entry.usuario} />
          </div>
        )}
        {entry.password && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#999] w-16 flex-shrink-0">Contraseña</span>
            <span className="text-xs text-[#333] font-mono flex-1">
              {showPass ? entry.password : "••••••••••••"}
            </span>
            <button onClick={() => setShowPass(v => !v)}
              className="text-[#999] hover:text-[#1B4FFF] transition-colors cursor-pointer flex-shrink-0">
              <EyeIcon open={showPass} />
            </button>
            <CopyBtn text={entry.password} />
          </div>
        )}
        {entry.notas && (
          <div className="flex items-start gap-2 pt-1 border-t border-[#F0F0F0] mt-1">
            <span className="text-[10px] text-[#999] w-16 flex-shrink-0 mt-0.5">Notas</span>
            <p className="text-xs text-[#666] flex-1 leading-relaxed">{entry.notas}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function EntryModal({ entry, onSave, onClose }: {
  entry: Partial<VaultEntry> | null;
  onSave: (data: Partial<VaultEntry>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<VaultEntry>>(entry ?? { category: "General" });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof VaultEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nombre?.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <h3 className="font-800 text-[#18191F]">{entry?.id ? "Editar credencial" : "Nueva credencial"}</h3>
          <button onClick={onClose} className="text-[#999] hover:text-[#333] cursor-pointer transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#666] mb-1.5 block">Categoría</label>
              <select value={form.category ?? "General"} onChange={set("category")}
                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors bg-white">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1.5 block">Nombre *</label>
              <input autoFocus value={form.nombre ?? ""} onChange={set("nombre")}
                placeholder="Apple Business" className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">URL</label>
            <input value={form.url ?? ""} onChange={set("url")}
              placeholder="https://business.apple.com/" className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Usuario / Email</label>
            <input value={form.usuario ?? ""} onChange={set("usuario")}
              placeholder="admin@fluxperu.com" className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors font-mono" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Contraseña</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"}
                value={form.password ?? ""} onChange={set("password")}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors font-mono" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1B4FFF] transition-colors cursor-pointer">
                <EyeIcon open={showPass} />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Notas</label>
            <textarea value={form.notas ?? ""} onChange={set("notas")} rows={2}
              placeholder="D-U-N-S: 751778477 · Org ID: 71371810"
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] resize-none transition-colors" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#666] hover:text-[#333] transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.nombre?.trim()}
            className="px-6 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] disabled:opacity-60 transition-colors cursor-pointer">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VaultClient() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<VaultEntry> | null | false>(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todas");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/vault");
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const presentCategories = ["Todas", ...Array.from(new Set(entries.map(e => e.category)))];

  const filtered = entries.filter(e => {
    const matchCat = activeCategory === "Todas" || e.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || [e.nombre, e.usuario, e.url, e.notas].some(v => v?.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const grouped = presentCategories.filter(c => c !== "Todas").reduce<Record<string, VaultEntry[]>>((acc, cat) => {
    const items = filtered.filter(e => e.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  async function handleSave(data: Partial<VaultEntry>) {
    if (data.id) {
      await fetch("/api/admin/vault", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } else {
      await fetch("/api/admin/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    setModal(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta credencial?")) return;
    await fetch("/api/admin/vault", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar credenciales…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white transition-colors" />
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer flex-shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nueva credencial
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {presentCategories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-600 transition-colors cursor-pointer ${
              activeCategory === cat
                ? "bg-[#1B4FFF] text-white"
                : "bg-white border border-[#E5E5E5] text-[#666] hover:border-[#1B4FFF] hover:text-[#1B4FFF]"
            }`}>
            {cat !== "Todas" && (CATEGORY_ICONS[cat] ?? "🔑")} {cat}
            {cat !== "Todas" && (
              <span className="ml-1 opacity-60">
                {entries.filter(e => e.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Entries */}
      {loading ? (
        <div className="text-center py-16 text-[#999] text-sm">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔐</p>
          <p className="text-[#666] font-600">Sin credenciales{search ? " para esa búsqueda" : ""}</p>
          <button onClick={() => setModal({})}
            className="mt-4 px-5 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer">
            Agregar primera credencial
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{CATEGORY_ICONS[cat] ?? "🔑"}</span>
                <h2 className="text-sm font-700 text-[#18191F]">{cat}</h2>
                <span className="text-xs text-[#999]">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(e => (
                  <EntryCard key={e.id} entry={e} onEdit={e => setModal(e)} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== false && (
        <EntryModal
          entry={modal}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}
    </>
  );
}
