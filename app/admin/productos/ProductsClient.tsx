"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcAllPrices } from "@/lib/pricing-formula";

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

const empty: ProductRow = {
  id: "",
  slug: "",
  name: "",
  short_name: "",
  chip: "Apple M4",
  ram: "16 GB",
  ssd: "256 GB SSD",
  color: "Gris Espacial",
  image_url: "",
  badge: null,
  is_new: false,
  stock: 0,
  cost_usd: null,
  pricing: [
    { months: 8, price: 0 },
    { months: 16, price: 0 },
    { months: 24, price: 0 },
  ],
  specs: [
    { label: "Chip", value: "" },
    { label: "CPU", value: "" },
    { label: "GPU", value: "" },
    { label: "RAM", value: "" },
    { label: "SSD", value: "" },
    { label: "Pantalla", value: "" },
    { label: "Batería", value: "" },
    { label: "Peso", value: "" },
  ],
  includes: [],
  display_order: 999,
  active: true,
};

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

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-700 ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-800 text-[#18191F]">Productos</h1>
          <p className="text-sm text-[#999]">Catálogo que aparece en fluxperu.com/laptops</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="px-5 py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] cursor-pointer"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Grid of products */}
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
      </div>

      {isPending && <p className="text-xs text-[#1B4FFF] mt-3">Actualizando...</p>}

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

  const applyCalculator = () => {
    const cost = Number(form.cost_usd);
    if (!cost || cost <= 0) {
      onError("Ingresa el costo del equipo primero");
      return;
    }
    const calculated = calcAllPrices(cost, form.slug);
    const updated = form.pricing.map((p) => {
      const match = calculated.find((c) => c.months === p.months && c.plan.startsWith("estreno_"));
      return match ? { months: p.months, price: match.offline } : p;
    });
    setForm({ ...form, pricing: updated });
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

  const updatePricing = (idx: number, field: "months" | "price", value: number) => {
    const pricing = [...form.pricing];
    pricing[idx] = { ...pricing[idx], [field]: value };
    setForm({ ...form, pricing });
  };

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
              <Field label="Color" value={form.color} onChange={(v) => setForm({ ...form, color: v })} placeholder="Gris Espacial" />
            </Row>
            <Row>
              <Field label="Chip" value={form.chip} onChange={(v) => setForm({ ...form, chip: v })} placeholder="Apple M4" />
              <Field label="RAM" value={form.ram} onChange={(v) => setForm({ ...form, ram: v })} placeholder="16 GB" />
              <Field label="SSD" value={form.ssd} onChange={(v) => setForm({ ...form, ssd: v })} placeholder="256 GB SSD" />
            </Row>
            <Row>
              <Field label="Badge (opcional)" value={form.badge ?? ""} onChange={(v) => setForm({ ...form, badge: v || null })} placeholder="Nuevo 2025" />
              <Field label="Stock" type="number" value={String(form.stock)} onChange={(v) => setForm({ ...form, stock: parseInt(v || "0") })} />
              <Field label="Orden" type="number" value={String(form.display_order)} onChange={(v) => setForm({ ...form, display_order: parseInt(v || "0") })} />
            </Row>
            <label className="flex items-center gap-2 text-sm text-[#333] cursor-pointer">
              <input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} />
              Marcar como "Nuevo"
            </label>
          </Section>

          {/* Price calculator */}
          <Section title="💰 Calculadora de precios">
            <p className="text-xs text-[#666] mb-3">
              Ingresa el costo de compra del equipo y presiona el botón para calcular automáticamente los precios de los 3 planes.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-[#666] mb-1">Costo del equipo (USD)</label>
                <input
                  type="number"
                  value={form.cost_usd ?? ""}
                  onChange={(e) => setForm({ ...form, cost_usd: e.target.value || null })}
                  placeholder="1200"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                />
              </div>
              <button
                type="button"
                onClick={applyCalculator}
                className="px-5 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-xl hover:bg-[#1340CC] cursor-pointer"
              >
                Calcular precios →
              </button>
            </div>
          </Section>

          {/* Pricing */}
          <Section title="Planes y precios (USD/mes)">
            <p className="text-xs text-[#666] mb-3">Precio mensual offline (sin comisión Stripe). Usa la calculadora arriba o ingresa manualmente.</p>
            <div className="space-y-2">
              {form.pricing.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-[#999] mb-0.5">Meses</label>
                    <input
                      type="number"
                      value={p.months}
                      onChange={(e) => updatePricing(i, "months", parseInt(e.target.value || "0"))}
                      className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-[#999] mb-0.5">Precio USD/mes</label>
                    <input
                      type="number"
                      value={p.price}
                      onChange={(e) => updatePricing(i, "price", parseFloat(e.target.value || "0"))}
                      step="0.01"
                      className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF]"
                    />
                  </div>
                  <div className="text-xs text-[#666] w-24">
                    Total: <strong>${(p.price * p.months).toFixed(0)}</strong>
                  </div>
                </div>
              ))}
            </div>
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
