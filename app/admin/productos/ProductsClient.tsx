"use client";

import { useState, useRef, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { calcAllPrices } from "@/lib/pricing-formula";

// ── Calculadora de VENTA (equipos usados): residual baja con los meses de uso ──
function saleResidualPct(monthsUsed: number): number {
  return Math.max(10, 100 - 2.8125 * monthsUsed); // 8m→77.5 · 16m→55 · 24m→32.5 · 32m→10
}
function roundTo5(n: number): number { return Math.round(n / 5) * 5; }
function calcSalePrice(cost: number, monthsUsed: number) {
  const residualPct = saleResidualPct(monthsUsed);
  const raw = (cost * residualPct) / 100;
  const offline = roundTo5(raw);
  const online = roundTo5(raw * 1.045); // +comisión Stripe (sobre el residual crudo)
  return { residualPct, offline, online };
}

interface DerivedModel {
  slug: string; modelo_completo: string | null;
  chip: string | null; ram: string | null; ssd: string | null; color: string | null;
  total: number; stock: number; avgCost: number;
  pricing: { months: number; price: number }[];
  overlay: { name: string; short_name: string; image_url: string; badge: string | null; is_new: boolean; active: boolean; display_order: number } | null;
}

interface VentaUnit {
  id: string; codigo_interno: string; modelo_completo: string;
  chip: string | null; ram: string | null; ssd: string | null; color: string | null;
  battery_cycles: number | null; sale_price_usd: number | null; sale_condition: string | null;
  precio_compra_usd: number | null; for_sale: boolean; estado_actual: string; image_url: string | null;
}

/**
 * Convierte un nombre de producto en un slug URL-friendly.
 * Ej: "MacBook Air 13\" — Apple M4" -> "macbook-air-13-apple-m4"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // quita acentos
    .replace(/["']/g, "")              // quita comillas
    .replace(/[^a-z0-9]+/g, "-")       // todo lo demás a guión
    .replace(/^-+|-+$/g, "")           // quita guiones de los extremos
    .replace(/-{2,}/g, "-");           // colapsa múltiples guiones
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  chip: string;
  ram: string;
  ssd: string;
  color: string;
  image_url: string;
  badge: string | null;
  is_new: boolean;
  stock: number;
  cost_usd: string | null;
  pricing: { months: number; price: number }[];
  specs: { label: string; value: string }[];
  includes: string[];
  display_order: number;
  active: boolean;
}


export default function ProductsClient({ initialProducts }: { initialProducts: ProductRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Ya no aparecerá en la web.`)) return;
    const res = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      showToast("success", "Producto eliminado");
      startTransition(() => router.refresh());
    } else {
      const j = await res.json();
      showToast("error", j.error ?? "Error");
    }
  };

  const handleToggleActive = async (p: ProductRow) => {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, active: !p.active }),
    });
    if (res.ok) {
      showToast("success", p.active ? "Producto ocultado" : "Producto activado");
      startTransition(() => router.refresh());
    }
  };

  // ── Tabs Alquiler/Venta + sincronización desde inventario ──
  const [tab, setTab] = useState<"alquiler" | "venta">("alquiler");
  const [syncing, setSyncing] = useState(false);
  const [venta, setVenta] = useState<VentaUnit[] | null>(null);

  const loadVenta = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products/derived");
      const json = await res.json();
      if (res.ok) setVenta(json.venta ?? []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { if (tab === "venta" && venta === null) loadVenta(); }, [tab, venta, loadVenta]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/products/derived", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.error ?? "Error"); return; }
      const faltan = (json.sinImagen ?? []).length;
      showToast("success", `Sincronizado ✓ ${json.creados} creados · ${json.actualizados} actualizados${faltan ? ` · ${faltan} sin imagen` : ""}`);
      setVenta(null);
      startTransition(() => router.refresh());
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error");
    } finally { setSyncing(false); }
  };

  // ── Selector de modelos del inventario para "agregar producto" ──
  const [picker, setPicker] = useState<DerivedModel[] | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [editingVenta, setEditingVenta] = useState<VentaUnit | null>(null);

  const openPicker = async () => {
    setPickerLoading(true);
    try {
      const res = await fetch("/api/admin/products/derived");
      const json = await res.json();
      if (res.ok) setPicker(json.alquiler ?? []);
      else showToast("error", json.error ?? "Error");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error");
    } finally { setPickerLoading(false); }
  };

  const chooseModel = (m: DerivedModel) => {
    const existing = initialProducts.find((p) => p.slug === m.slug);
    setEditing({
      id: existing?.id ?? "",
      slug: m.slug,
      name: existing?.name || m.overlay?.name || m.modelo_completo || m.slug,
      short_name: existing?.short_name || m.overlay?.short_name || (m.modelo_completo ?? ""),
      chip: m.chip ?? "", ram: m.ram ?? "", ssd: m.ssd ?? "", color: m.color ?? "",
      image_url: existing?.image_url ?? "",
      badge: existing?.badge ?? null,
      is_new: existing?.is_new ?? false,
      stock: m.stock,
      cost_usd: m.avgCost ? String(m.avgCost) : null,
      pricing: m.pricing,
      specs: existing?.specs?.length ? existing.specs : [
        { label: "Chip", value: m.chip ?? "" }, { label: "RAM", value: m.ram ?? "" },
        { label: "SSD", value: m.ssd ?? "" }, { label: "Color", value: m.color ?? "" },
      ],
      includes: existing?.includes ?? [],
      display_order: existing?.display_order ?? 999,
      active: true,
    });
    setPicker(null);
  };

  const handleToggleForSale = async (u: VentaUnit) => {
    const res = await fetch("/api/admin/equipment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, for_sale: !u.for_sale, ...(!u.for_sale && { sale_listed_at: new Date().toISOString() }) }),
    });
    if (res.ok) {
      showToast("success", u.for_sale ? "Oculto de /comprar" : "Publicado en /comprar");
      setVenta((prev) => prev?.map((x) => x.id === u.id ? { ...x, for_sale: !x.for_sale } : x) ?? null);
    }
  };

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-700 ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-800 text-[#18191F]">Productos</h1>
          <p className="text-sm text-[#999]">Specs, precio y stock se jalan del <b>inventario</b>. Aquí solo gestionas imagen y copy web.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#1B4FFF] border border-[#1B4FFF] text-sm font-700 rounded-full hover:bg-[#EEF2FF] cursor-pointer disabled:opacity-60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={syncing ? "animate-spin" : ""}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
            {syncing ? "Sincronizando…" : "Sincronizar desde inventario"}
          </button>
          {tab === "alquiler" && (
            <button onClick={openPicker} disabled={pickerLoading}
              className="px-5 py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] cursor-pointer disabled:opacity-60">
              {pickerLoading ? "Cargando…" : "+ Agregar del inventario"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs Alquiler | Venta */}
      <div className="flex gap-2 mb-6 border-b border-[#E5E5E5]">
        {(["alquiler", "venta"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-700 border-b-2 -mb-px cursor-pointer transition-colors ${tab === t ? "border-[#1B4FFF] text-[#1B4FFF]" : "border-transparent text-[#999] hover:text-[#333]"}`}>
            {t === "alquiler" ? "🔄 Alquiler (por modelo)" : "🏷️ Venta (por unidad)"}
          </button>
        ))}
      </div>

      {/* Grid de ALQUILER (por modelo) */}
      {tab === "alquiler" && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {initialProducts.map((p) => (
          <div key={p.id} className={`bg-white rounded-2xl border overflow-hidden ${p.active ? "border-[#E5E5E5]" : "border-red-200 opacity-60"}`}>
            <div className="aspect-video bg-[#F7F7F7] flex items-center justify-center relative">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-[#999] text-xs">Sin imagen</span>
              )}
              {!p.active && (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-700 px-2 py-0.5 rounded-full">INACTIVO</div>
              )}
              {p.is_new && (
                <div className="absolute top-2 right-2 bg-[#1B4FFF] text-white text-[10px] font-700 px-2 py-0.5 rounded-full">NUEVO</div>
              )}
            </div>
            <div className="p-4">
              <p className="font-700 text-[#18191F] text-sm truncate">{p.name}</p>
              <p className="text-xs text-[#666] mt-0.5">{p.chip} · {p.ram} · {p.ssd}</p>
              <p className="text-[10px] text-[#999] mt-0.5 font-mono">{p.slug}</p>
              <div className="mt-3 pt-3 border-t border-[#F0F0F0] space-y-1">
                {p.pricing.map((pr) => (
                  <div key={pr.months} className="flex items-center justify-between text-xs">
                    <span className="text-[#666]">{pr.months}m</span>
                    <span className="font-700 text-[#18191F]">${pr.price}/mes</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
                <span className={`font-600 ${p.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                  Stock: {p.stock}
                </span>
                {p.cost_usd && <span className="text-[#999]">Costo: ${p.cost_usd}</span>}
              </div>
            </div>
            <div className="flex border-t border-[#F0F0F0] divide-x divide-[#F0F0F0]">
              <button onClick={() => setEditing(p)} className="flex-1 py-2 text-xs font-700 text-[#1B4FFF] hover:bg-[#EEF2FF] cursor-pointer">Editar</button>
              <button onClick={() => handleToggleActive(p)} className="flex-1 py-2 text-xs font-700 text-[#666] hover:bg-[#F7F7F7] cursor-pointer">
                {p.active ? "Ocultar" : "Activar"}
              </button>
              <button onClick={() => handleDelete(p.id, p.name)} className="flex-1 py-2 text-xs font-700 text-red-600 hover:bg-red-50 cursor-pointer">Eliminar</button>
            </div>
          </div>
        ))}
        {initialProducts.length === 0 && (
          <p className="text-sm text-[#999] col-span-full">Aún no hay modelos. Dale a <b>“Sincronizar desde inventario”</b> para crearlos automáticamente.</p>
        )}
      </div>
      )}

      {/* Grid de VENTA (por unidad, derivado del inventario) */}
      {tab === "venta" && (
        venta === null ? (
          <p className="text-sm text-[#999]">Cargando unidades en venta…</p>
        ) : venta.length === 0 ? (
          <p className="text-sm text-[#999]">No hay equipos de tipo <b>Venta</b>. Pásalos desde Inventario → pestaña Venta.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {venta.map((u) => {
              const savings = u.precio_compra_usd && u.sale_price_usd ? Math.round((1 - u.sale_price_usd / u.precio_compra_usd) * 100) : null;
              return (
                <div key={u.id} className={`bg-white rounded-2xl border overflow-hidden ${u.for_sale ? "border-[#E5E5E5]" : "border-amber-200"}`}>
                  <div className="aspect-video bg-[#F7F7F7] flex items-center justify-center relative">
                    {u.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image_url} alt={u.modelo_completo} className="w-full h-full object-contain" />
                    ) : <span className="text-4xl">💻</span>}
                    {!u.for_sale && <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-700 px-2 py-0.5 rounded-full">SIN PUBLICAR</div>}
                  </div>
                  <div className="p-4">
                    <p className="font-700 text-[#18191F] text-sm truncate">{u.modelo_completo}</p>
                    <p className="text-[10px] text-[#999] font-mono">{u.codigo_interno}</p>
                    <p className="text-xs text-[#666] mt-1">{u.chip} · {u.ram} · {u.ssd}{u.battery_cycles != null ? ` · ${u.battery_cycles} ciclos` : ""}</p>
                    <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex items-center justify-between">
                      <span className="font-800 text-[#18191F]">{u.sale_price_usd != null ? `$${u.sale_price_usd}` : "Sin precio"}</span>
                      {savings != null && <span className="text-xs text-green-600 font-700">-{savings}%</span>}
                    </div>
                    <p className="text-[11px] text-[#999] mt-1">{u.sale_condition ?? "Sin condición"} · {u.estado_actual}</p>
                  </div>
                  <div className="flex border-t border-[#F0F0F0]">
                    <button onClick={() => setEditingVenta(u)} className="flex-1 py-2 text-xs font-700 text-[#1B4FFF] hover:bg-[#EEF2FF] cursor-pointer">Editar</button>
                    <button onClick={() => handleToggleForSale(u)} className={`flex-1 py-2 text-xs font-700 border-l border-[#F0F0F0] cursor-pointer ${u.for_sale ? "text-[#666] hover:bg-[#F7F7F7]" : "text-green-700 hover:bg-green-50"}`}>
                      {u.for_sale ? "Ocultar" : "Publicar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {isPending && <p className="text-xs text-[#1B4FFF] mt-3">Actualizando...</p>}

      {/* Selector: elige un modelo del inventario para publicarlo */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4" onClick={() => setPicker(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
              <div>
                <h3 className="font-800 text-[#18191F]">Agregar del inventario</h3>
                <p className="text-xs text-[#999]">Elige un modelo. Solo le agregas imagen y copy.</p>
              </div>
              <button onClick={() => setPicker(null)} className="text-[#999] hover:text-[#333] text-2xl cursor-pointer">✕</button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {picker.length === 0 && <p className="text-sm text-[#999] p-4 text-center">No hay modelos en el inventario de alquiler.</p>}
              {picker.map((m) => {
                const existing = initialProducts.find((p) => p.slug === m.slug);
                const publicado = existing && existing.image_url;
                return (
                  <button key={m.slug} onClick={() => chooseModel(m)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#E5E5E5] hover:border-[#1B4FFF] hover:bg-[#EEF2FF] text-left cursor-pointer transition-colors">
                    <div className="w-12 h-12 rounded-lg bg-[#F7F7F7] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {existing?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={existing.image_url} alt="" className="w-full h-full object-contain" />
                      ) : <span className="text-xl">💻</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-700 text-sm text-[#18191F] truncate">{m.modelo_completo ?? m.slug}</p>
                      <p className="text-xs text-[#666]">{m.chip} · {m.ram} · {m.ssd} · {m.total} en inventario · {m.stock} disp.</p>
                    </div>
                    <span className={`text-[10px] font-700 px-2 py-1 rounded-full flex-shrink-0 ${publicado ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {publicado ? "Editar" : "Agregar"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ProductModal
          data={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            showToast("success", msg);
            setEditing(null);
            startTransition(() => router.refresh());
          }}
          onError={(msg) => showToast("error", msg)}
        />
      )}

      {editingVenta && (
        <VentaModal
          unit={editingVenta}
          onClose={() => setEditingVenta(null)}
          onSaved={(msg) => { showToast("success", msg); setEditingVenta(null); setVenta(null); loadVenta(); }}
          onError={(msg) => showToast("error", msg)}
        />
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────
// MODAL
// ───────────────────────────────────────────────────────────
function ProductModal({
  data,
  onClose,
  onSaved,
  onError,
}: {
  data: ProductRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<ProductRow>({
    ...data,
    cost_usd: data.cost_usd ?? null,
    pricing: data.pricing.length > 0 ? data.pricing : [
      { months: 8, price: 0 }, { months: 16, price: 0 }, { months: 24, price: 0 },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const isNew = !data.id;

  // AI extraction state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  /** Agrega una o más imágenes al panel AI, respetando el tope de 3. */
  const handleAiAddFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const valid: File[] = [];
    for (const f of Array.from(newFiles)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        onError(`${f.name}: solo JPG, PNG o WebP`);
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        onError(`${f.name}: máximo 8MB`);
        continue;
      }
      valid.push(f);
    }
    const combined = [...aiFiles, ...valid].slice(0, 3);
    if (aiFiles.length + valid.length > 3) {
      onError("Máximo 3 imágenes — se tomarán las primeras 3");
    }
    setAiFiles(combined);
  };

  const handleAiRemoveFile = (idx: number) => {
    setAiFiles(aiFiles.filter((_, i) => i !== idx));
  };

  /**
   * Llama al endpoint de extracción AI con texto y/o imágenes.
   * Rellena los campos del formulario con la respuesta.
   */
  const handleAiExtract = async () => {
    if (!aiText.trim() && aiFiles.length === 0) {
      onError("Pega un texto o sube al menos una imagen primero");
      return;
    }
    setAiLoading(true);
    try {
      const fd = new FormData();
      if (aiText.trim()) fd.append("text", aiText.trim());
      for (const f of aiFiles) fd.append("file", f);
      const res = await fetch("/api/admin/products/extract", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al extraer datos");

      // Aplica los datos al formulario, manteniendo lo que el usuario ya escribió
      const ai = json.data;
      setForm((f) => ({
        ...f,
        name: ai.name || f.name,
        short_name: ai.short_name || f.short_name,
        chip: ai.chip || f.chip,
        ram: ai.ram || f.ram,
        ssd: ai.ssd || f.ssd,
        color: ai.color || f.color,
        badge: ai.badge ?? f.badge,
        is_new: ai.is_new ?? f.is_new,
        cost_usd: ai.cost_usd ?? f.cost_usd,
        specs: Array.isArray(ai.specs) && ai.specs.length > 0 ? ai.specs : f.specs,
        includes: Array.isArray(ai.includes) && ai.includes.length > 0 ? ai.includes : f.includes,
        // Auto-genera slug si no había uno
        slug: f.slug || slugify(ai.name || ""),
      }));
      setAiPanelOpen(false);
      setAiText("");
      setAiFiles([]);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error");
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", form.slug || "new");
      const res = await fetch("/api/admin/products/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir");
      setForm((f) => ({ ...f, image_url: json.url }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim() || !form.image_url) {
      onError("Completa slug, nombre e imagen");
      return;
    }
    setSaving(true);
    try {
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch("/api/admin/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cost_usd: form.cost_usd ? Number(form.cost_usd) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar");
      onSaved(isNew ? "Producto creado" : "Producto actualizado");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const updateSpec = (idx: number, field: "label" | "value", value: string) => {
    const specs = [...form.specs];
    specs[idx] = { ...specs[idx], [field]: value };
    setForm({ ...form, specs });
  };

  const addSpec = () => setForm({ ...form, specs: [...form.specs, { label: "", value: "" }] });
  const removeSpec = (idx: number) => setForm({ ...form, specs: form.specs.filter((_, i) => i !== idx) });

  const addInclude = () => setForm({ ...form, includes: [...form.includes, ""] });
  const updateInclude = (idx: number, value: string) => {
    const includes = [...form.includes];
    includes[idx] = value;
    setForm({ ...form, includes });
  };
  const removeInclude = (idx: number) => setForm({ ...form, includes: form.includes.filter((_, i) => i !== idx) });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-800 text-[#18191F]">{isNew ? "Nuevo producto" : "Editar producto"}</h2>
          <div className="flex items-center gap-3">
            {isNew && (
              <button
                type="button"
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-[#1B4FFF] text-white text-xs font-700 hover:opacity-90 cursor-pointer flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
                </svg>
                Rellenar con IA
              </button>
            )}
            <button onClick={onClose} className="text-[#999] hover:text-[#18191F] text-2xl cursor-pointer">✕</button>
          </div>
        </div>

        {/* AI panel — pasted text and/or up to 3 images trigger Claude extraction */}
        {aiPanelOpen && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-b border-[#E5E5E5] p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2.5">
                <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
              </svg>
              <p className="font-700 text-sm text-[#18191F]">Rellena el formulario con IA</p>
            </div>
            <p className="text-xs text-[#666] mb-3">
              Pega el copy de Apple, sube hasta 3 imágenes del producto (frente, lateral, ficha
              técnica), o combina ambos. La IA extraerá nombre, chip, RAM, SSD, color, specs y
              todo lo demás automáticamente.
            </p>

            {/* Textarea */}
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Pega aquí la descripción. Ejemplo: 'MacBook Pro de 14 pulgadas con chip Apple M5, 24 GB de memoria unificada, 512 GB SSD, color Negro Sideral...'"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white resize-none"
            />

            {/* Image preview grid */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {aiFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E5E5] bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleAiRemoveFile(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs font-700 flex items-center justify-center hover:bg-red-600 cursor-pointer"
                    aria-label="Quitar imagen"
                  >
                    ✕
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
                    {file.name}
                  </div>
                </div>
              ))}
              {aiFiles.length < 3 && (
                <button
                  type="button"
                  onClick={() => aiFileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-[#CCCCCC] hover:border-[#1B4FFF] hover:bg-white/50 flex flex-col items-center justify-center gap-1 cursor-pointer text-[#666] hover:text-[#1B4FFF]"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-[10px] font-700">
                    {aiFiles.length === 0 ? "Agregar imagen" : "Otra imagen"}
                  </span>
                </button>
              )}
            </div>

            <input
              ref={aiFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                handleAiAddFiles(e.target.files);
                // Reset el input para poder re-seleccionar el mismo archivo
                e.target.value = "";
              }}
            />

            <p className="text-[10px] text-[#999] mt-2">
              {aiFiles.length}/3 imágenes seleccionadas
            </p>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleAiExtract}
                disabled={aiLoading || (!aiText.trim() && aiFiles.length === 0)}
                className="flex-1 px-4 py-2.5 bg-[#1B4FFF] text-white text-xs font-700 rounded-full hover:bg-[#1340CC] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {aiLoading ? "Analizando con IA..." : "Extraer datos con IA"}
              </button>
              <button
                type="button"
                onClick={() => { setAiPanelOpen(false); setAiText(""); setAiFiles([]); }}
                className="px-4 py-2.5 text-xs font-600 text-[#666] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Image upload */}
          <Section title="Imagen">
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 rounded-xl bg-[#F7F7F7] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#E5E5E5]">
                {form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[#999] text-xs">Sin imagen</span>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-xl hover:bg-[#1340CC] disabled:opacity-60 cursor-pointer"
                >
                  {uploading ? "Subiendo..." : "📎 Subir imagen"}
                </button>
                <p className="text-[10px] text-[#999] mt-1">JPG/PNG/WebP · máx 8MB</p>
                {form.image_url && (
                  <p className="text-[10px] text-[#666] mt-1 truncate">✓ {form.image_url.split("/").pop()}</p>
                )}
              </div>
            </div>
          </Section>

          {/* Basic info */}
          <Section title="Información básica">
            <Row>
              <div>
                <label className="block text-xs text-[#666] mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    // Auto-genera slug solo si está vacío o si coincide con el slug
                    // que se generaría del nombre anterior (es decir, el usuario no
                    // lo ha tocado manualmente)
                    const wasAutoSlug = !form.slug || form.slug === slugify(form.name);
                    setForm({
                      ...form,
                      name: newName,
                      slug: wasAutoSlug ? slugify(newName) : form.slug,
                    });
                  }}
                  placeholder="MacBook Air 13&quot; — Apple M4"
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#666] mb-1">
                  Slug (URL) *
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="macbook-air-13-m4"
                    className="flex-1 px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, slug: slugify(form.name) })}
                    title="Generar desde el nombre"
                    className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs text-[#666] hover:border-[#1B4FFF] hover:text-[#1B4FFF] cursor-pointer"
                  >
                    ↻
                  </button>
                </div>
                <p className="text-[10px] text-[#999] mt-1">
                  Es la URL del producto: fluxperu.com/laptops/<strong>{form.slug || "tu-slug"}</strong>
                </p>
              </div>
            </Row>
            <Row>
              <Field label="Nombre corto *" value={form.short_name} onChange={(v) => setForm({ ...form, short_name: v })} placeholder="MacBook Air 13&quot;" />
              <Field label="Badge (opcional)" value={form.badge ?? ""} onChange={(v) => setForm({ ...form, badge: v || null })} placeholder="Nuevo 2025" />
            </Row>

            {/* Specs, stock y precio — vienen del inventario (no se editan aquí) */}
            <div className="bg-[#F7F7F7] rounded-xl p-3 text-xs">
              <p className="font-700 text-[#666] mb-2">📦 Desde inventario (no editable)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-3 text-[#333]">
                <div><span className="text-[#999]">Chip:</span> {form.chip || "—"}</div>
                <div><span className="text-[#999]">RAM:</span> {form.ram || "—"}</div>
                <div><span className="text-[#999]">SSD:</span> {form.ssd || "—"}</div>
                <div><span className="text-[#999]">Color:</span> {form.color || "—"}</div>
                <div><span className="text-[#999]">Stock:</span> {form.stock}</div>
                <div><span className="text-[#999]">Costo:</span> {form.cost_usd ? `$${form.cost_usd}` : "—"}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 pt-2 border-t border-[#E5E5E5]">
                {form.pricing.map((p) => <span key={p.months} className="font-700 text-[#18191F]">{p.months}m: ${p.price}/mes</span>)}
              </div>
            </div>

            <Row>
              <Field label="Orden de aparición" type="number" value={String(form.display_order)} onChange={(v) => setForm({ ...form, display_order: parseInt(v || "0") })} />
            </Row>
            <label className="flex items-center gap-2 text-sm text-[#333] cursor-pointer">
              <input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} />
              Marcar como "Nuevo"
            </label>
          </Section>

          {/* Calculadora de precios de alquiler (referencia) */}
          <Section title="Precios">
            <RentalCalculator slug={form.slug} defaultCost={Number(form.cost_usd) || 0} />
          </Section>

          {/* Specs */}
          <Section title="Especificaciones técnicas">
            <div className="space-y-2">
              {form.specs.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateSpec(i, "label", e.target.value)}
                    placeholder="Ej: Chip"
                    className="w-32 px-3 py-2 text-xs border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                  />
                  <input
                    type="text"
                    value={s.value}
                    onChange={(e) => updateSpec(i, "value", e.target.value)}
                    placeholder="Ej: Apple M4"
                    className="flex-1 px-3 py-2 text-xs border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                  />
                  <button type="button" onClick={() => removeSpec(i)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">✕</button>
                </div>
              ))}
              <button type="button" onClick={addSpec} className="text-xs text-[#1B4FFF] hover:underline cursor-pointer">+ Agregar spec</button>
            </div>
          </Section>

          {/* Includes */}
          <Section title="Qué incluye (en la caja)">
            <div className="space-y-2">
              {form.includes.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateInclude(i, e.target.value)}
                    placeholder="Ej: Cable USB-C"
                    className="flex-1 px-3 py-2 text-xs border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                  />
                  <button type="button" onClick={() => removeInclude(i)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">✕</button>
                </div>
              ))}
              <button type="button" onClick={addInclude} className="text-xs text-[#1B4FFF] hover:underline cursor-pointer">+ Agregar item</button>
            </div>
          </Section>

          <label className="flex items-center gap-2 text-sm text-[#333] cursor-pointer pt-2 border-t border-[#F0F0F0]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Producto activo (visible en la web)
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#E5E5E5] px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-700 text-[#666] hover:text-[#18191F] cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-5 py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] disabled:opacity-60 cursor-pointer"
          >
            {saving ? "Guardando..." : isNew ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-700 text-[#666] uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">{children}</div>;
}

function Field({
  label, value, onChange, type = "text", placeholder, mono, help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[#666] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] ${mono ? "font-mono" : ""}`}
      />
      {help && <p className="text-[10px] text-[#999] mt-0.5">{help}</p>}
    </div>
  );
}

// ─── Calculadora de ALQUILER (6 planes) ──────────────────────────────────────
function RentalCalculator({ slug, defaultCost }: { slug: string; defaultCost: number }) {
  const [cost, setCost] = useState(defaultCost || 0);
  const rows = cost > 0 ? calcAllPrices(cost, slug) : [];
  return (
    <div className="bg-[#F7F7F7] rounded-2xl p-4">
      <p className="font-800 text-[#18191F] text-sm mb-1">🧮 Calculadora de precios</p>
      <p className="text-xs text-[#666] mb-3">Ingresa el costo del equipo y te muestro los precios sugeridos por plan (offline para empresas, online para web con Stripe).</p>
      <div className="mb-3 max-w-[220px]">
        <label className="block text-xs text-[#666] mb-1">Costo del equipo (USD)</label>
        <input type="number" value={cost || ""} onChange={(e) => setCost(Number(e.target.value))} placeholder="900"
          className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white" />
      </div>
      {rows.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5E5]">
          <table className="w-full text-xs">
            <thead className="bg-[#F0F4FF] text-[#666]">
              <tr>
                <th className="text-left px-3 py-2 font-700">Plan</th>
                <th className="text-center px-2 py-2 font-700">Meses</th>
                <th className="text-center px-2 py-2 font-700">Residual</th>
                <th className="text-right px-3 py-2 font-700">Offline</th>
                <th className="text-right px-3 py-2 font-700 text-[#1B4FFF]">Online</th>
                <th className="text-right px-3 py-2 font-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {rows.map((r) => (
                <tr key={r.plan} className={r.plan.startsWith("realquiler") ? "text-[#666]" : ""}>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-2 py-2 text-center">{r.months}m</td>
                  <td className="px-2 py-2 text-center">{r.residualPct}%</td>
                  <td className="px-3 py-2 text-right font-700 text-[#18191F]">${r.offline}/m</td>
                  <td className="px-3 py-2 text-right font-700 text-[#1B4FFF]">${r.online}/m</td>
                  <td className="px-3 py-2 text-right text-[#999]">${r.offline * r.months}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Calculadora de VENTA (equipos usados) ───────────────────────────────────
function SaleCalculator({ defaultCost, onApply }: { defaultCost: number; onApply: (price: number) => void }) {
  const [cost, setCost] = useState(defaultCost || 0);
  const [months, setMonths] = useState(8);
  const r = cost > 0 ? calcSalePrice(cost, months) : null;
  const scenarios = [0, 8, 16, 24, 32];
  return (
    <div className="bg-[#F7F7F7] rounded-2xl p-4">
      <p className="font-800 text-[#18191F] text-sm mb-1">💰 Calculadora de venta — equipos usados</p>
      <p className="text-xs text-[#666] mb-3">Costo original + meses que estuvo alquilado → precio de venta sugerido (a más uso, menor residual).</p>
      <div className="flex gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-[#666] mb-1">Costo original (USD)</label>
          <input type="number" value={cost || ""} onChange={(e) => setCost(Number(e.target.value))} placeholder="900"
            className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-[#666] mb-1">Meses alquilado (uso)</label>
          <input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} placeholder="8"
            className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white" />
        </div>
      </div>
      {r && (
        <>
          <div className="bg-[#EEF2FF] rounded-xl p-3 flex flex-wrap gap-4 items-center mb-3">
            <div><p className="text-[10px] text-[#666] uppercase">Residual</p><p className="text-xl font-800 text-[#1B4FFF]">{r.residualPct.toFixed(1)}%</p></div>
            <div><p className="text-[10px] text-[#666] uppercase">Venta offline</p><p className="text-xl font-800 text-[#18191F]">${r.offline}</p></div>
            <div><p className="text-[10px] text-[#666] uppercase">Venta online</p><p className="text-xl font-800 text-[#18191F]">${r.online}</p></div>
            <button type="button" onClick={() => onApply(r.offline)}
              className="ml-auto px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-full hover:bg-[#1340CC] cursor-pointer">
              Usar ${r.offline} como precio
            </button>
          </div>
          <div className="bg-white rounded-xl overflow-hidden border border-[#E5E5E5]">
            <table className="w-full text-xs">
              <thead className="bg-[#F0F4FF] text-[#666]"><tr>
                <th className="text-left px-3 py-2 font-700">Escenario</th>
                <th className="text-center px-2 py-2 font-700">Meses</th>
                <th className="text-center px-2 py-2 font-700">Residual</th>
                <th className="text-right px-3 py-2 font-700">Offline</th>
                <th className="text-right px-3 py-2 font-700">Online</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {scenarios.map((m) => {
                  const s = calcSalePrice(cost, m);
                  const cur = m === months;
                  return (
                    <tr key={m} className={cur ? "bg-[#EEF2FF]" : ""}>
                      <td className="px-3 py-2">{m === 0 ? "Nuevo (sin uso)" : `${m} meses rentado`}{cur && <span className="ml-1 text-[#1B4FFF]">← actual</span>}</td>
                      <td className="px-2 py-2 text-center">{m}m</td>
                      <td className="px-2 py-2 text-center text-[#1B4FFF]">{s.residualPct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-700">${s.offline}</td>
                      <td className="px-3 py-2 text-right">${s.online}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Modal de edición de una unidad de VENTA ─────────────────────────────────
function VentaModal({ unit, onClose, onSaved, onError }: {
  unit: VentaUnit; onClose: () => void; onSaved: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState(unit.image_url ?? "");
  const [salePrice, setSalePrice] = useState(unit.sale_price_usd != null ? String(unit.sale_price_usd) : "");
  const [condition, setCondition] = useState(unit.sale_condition ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("kind", "venta"); fd.append("codigo", unit.codigo_interno);
      const res = await fetch("/api/admin/equipment/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir");
      setImageUrl(json.url);
    } catch (e) { onError(e instanceof Error ? e.message : "Error"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unit.id, image_url: imageUrl || null, sale_price_usd: salePrice || null, sale_condition: condition || null }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Error"); }
      onSaved("Equipo de venta actualizado");
    } catch (e) { onError(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <div>
            <h3 className="font-800 text-[#18191F]">Editar venta — {unit.modelo_completo}</h3>
            <p className="text-xs text-[#999] font-mono">{unit.codigo_interno} · {unit.chip} · {unit.ram} · {unit.ssd}{unit.battery_cycles != null ? ` · ${unit.battery_cycles} ciclos` : ""}</p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-[#333] text-2xl cursor-pointer">✕</button>
        </div>
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Imagen */}
          <div>
            <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wide mb-2">Imagen</p>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="w-full h-full object-contain" />
                ) : <span className="text-3xl">💻</span>}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-xl hover:bg-[#1340CC] disabled:opacity-60 cursor-pointer">
                  {uploading ? "Subiendo…" : "📎 Subir imagen"}
                </button>
                <p className="text-[10px] text-[#999] mt-1">Si no subes una, usa la imagen del modelo.</p>
              </div>
            </div>
          </div>

          {/* Precio y condición */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#666] mb-1">Precio de venta (USD)</label>
              <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="700"
                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]" />
            </div>
            <div>
              <label className="block text-xs text-[#666] mb-1">Condición</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white">
                <option value="">— Seleccionar —</option>
                <option value="Excelente">Excelente</option>
                <option value="Muy bueno">Muy bueno</option>
                <option value="Bueno">Bueno</option>
              </select>
            </div>
          </div>

          {/* Calculadora de venta */}
          <SaleCalculator defaultCost={unit.precio_compra_usd ?? 0} onApply={(p) => setSalePrice(String(p))} />
        </div>
        <div className="px-6 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#666] hover:text-[#333] cursor-pointer">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-6 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] disabled:opacity-60 cursor-pointer">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
