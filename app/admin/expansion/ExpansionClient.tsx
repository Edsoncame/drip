"use client";

import { useMemo, useState, useTransition } from "react";

/**
 * Expansion Client
 * -----------------
 * UI de 3 columnas (Hot / Warm / Cold) sobre oportunidades abiertas (status ∈ new,
 * contacted, in_conversation). Incluye CTA de migración si la tabla no existe
 * todavía (primer uso) y botón manual de refresh (POST /api/admin/expansion).
 *
 * Acciones por card: WhatsApp (con script por play_type), Contactado, En conversación,
 * Ganada, Perdida (modal con razón), Snooze 14d, notas admin inline.
 */

// ──────────────────────────── types ────────────────────────────

export type PlayType =
  | "UPGRADE_TIER"
  | "BUNDLE_IPAD"
  | "ADD_SEAT"
  | "TIER_REFRESH"
  | "CHECK_IN";

export type Temperature = "hot" | "warm" | "cold";

export type Status =
  | "new"
  | "contacted"
  | "in_conversation"
  | "won"
  | "lost"
  | "snoozed";

export interface ClientSignals {
  user_id: string;
  name: string;
  email: string;
  company: string | null;
  ruc: string | null;
  phone: string | null;
  first_sub_date: string;
  total_active_subs: number;
  total_subs_ever: number;
  total_spent: string;
  has_overdue_last_6mo: boolean;
  next_end_date: string | null;
  max_product_name: string | null;
  has_applecare: boolean;
  has_ipad_ever: boolean;
  avg_days_to_pay: number | null;
}

export interface OpportunityRow {
  id: string;
  user_id: string;
  score: number;
  temperature: Temperature;
  play_type: PlayType;
  play_reason: string;
  signals: ClientSignals | unknown;
  suggested_mrr_delta: string | null;
  status: Status;
  contacted_at: string | null;
  won_at: string | null;
  lost_reason: string | null;
  snoozed_until: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  user_company: string | null;
  user_phone: string | null;
  user_ruc: string | null;
}

export interface Totals {
  total: string;
  hot: string;
  warm: string;
  cold: string;
  open: string;
  won: string;
  lost: string;
  potential_mrr: string;
}

interface Props {
  initialTableMissing: boolean;
  initialOpportunities: OpportunityRow[];
  initialTotals: Totals | null;
  initialError: string | null;
}

// ──────────────────────────── helpers ────────────────────────────

const FLUX_WHATSAPP = "51900164769"; // sin + para wa.me

const PLAY_LABEL: Record<PlayType, string> = {
  UPGRADE_TIER: "Upgrade a Pro",
  BUNDLE_IPAD: "Bundle iPad",
  ADD_SEAT: "Seat adicional",
  TIER_REFRESH: "Renovar con upgrade",
  CHECK_IN: "Check-in de valor",
};

const TEMP_STYLE: Record<Temperature, { bg: string; border: string; text: string; dot: string }> = {
  hot:  { bg: "bg-[#FFF5EC]", border: "border-[#FF8A00]", text: "text-[#FF8A00]", dot: "bg-[#FF8A00]" },
  warm: { bg: "bg-[#FFFBEC]", border: "border-[#D4A017]", text: "text-[#A67C00]", dot: "bg-[#D4A017]" },
  cold: { bg: "bg-[#F0F4FF]", border: "border-[#1B4FFF]", text: "text-[#1B4FFF]", dot: "bg-[#1B4FFF]" },
};

const STATUS_LABEL: Record<Status, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  in_conversation: "En conversación",
  won: "Ganada",
  lost: "Perdida",
  snoozed: "Pausada",
};

function fmtPEN(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number.parseFloat(n) : (n ?? 0);
  if (!Number.isFinite(v)) return "S/ 0";
  return "S/ " + Math.round(v).toLocaleString("es-PE");
}

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = (Date.now() - Date.parse(iso)) / 86_400_000;
  if (!Number.isFinite(d)) return "—";
  if (d < 1) return "hoy";
  if (d < 2) return "ayer";
  return `hace ${Math.round(d)}d`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = (Date.parse(iso) - Date.now()) / 86_400_000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

/**
 * Scripts de WhatsApp por play_type. Tono FLUX: directo, sin buzzwords,
 * cero presión, enfocado en un próximo paso claro (llamada de 10'').
 */
function whatsappScript(opp: OpportunityRow): string {
  const firstName = (opp.user_name || "").split(" ")[0] || "hola";
  const product = (opp.signals as ClientSignals)?.max_product_name || "tu equipo";
  const d = daysUntil(opp.snoozed_until); // no usado, placeholder

  switch (opp.play_type) {
    case "UPGRADE_TIER":
      return `Hola ${firstName}, soy Edson de FLUX. Vi que llevas un tiempo con ${product} y todo súper limpio con los pagos. Justo abrimos upgrade express a MacBook Pro M3 con descuento de fidelidad (S/ ${Math.round(Number(opp.suggested_mrr_delta || 400))}/mes extra, mismo contrato). ¿Te tiro los detalles por aquí o prefieres una llamada de 10'?`;

    case "BUNDLE_IPAD":
      return `Hola ${firstName}, soy Edson de FLUX. Ya tienes ${(opp.signals as ClientSignals)?.total_active_subs || 2} MacBooks con nosotros 👌. Para tu operación veo un fit natural con iPad Pro 11" (presentaciones, reuniones, movilidad). Bundle desde S/ ${Math.round(Number(opp.suggested_mrr_delta || 320))}/mes. ¿Te paso specs + precio cerrado?`;

    case "ADD_SEAT":
      return `Hola ${firstName}, soy Edson de FLUX. Vi que ${opp.user_company || "tu empresa"} ya tiene ${(opp.signals as ClientSignals)?.total_active_subs || 1} equipo(s) activo(s) con nosotros. Si estás sumando a alguien al equipo, puedo tener un MacBook nuevo configurado y entregado en 72h, mismo contrato marco (cero burocracia extra). ¿Cuándo lo necesitarías?`;

    case "TIER_REFRESH": {
      const dte = daysUntil((opp.signals as ClientSignals)?.next_end_date || null);
      const when = dte !== null ? `en ${dte} días` : "pronto";
      return `Hola ${firstName}, soy Edson de FLUX. Tu renovación cae ${when}. Te escribo antes para ofrecerte renovar con upgrade + descuento de fidelidad (ahorro vs. empezar de cero). ¿Te paso las 2-3 opciones que tienen más sentido para ti?`;
    }

    case "CHECK_IN":
    default:
      return `Hola ${firstName}, soy Edson de FLUX. Te escribo sin agenda comercial — solo para ver cómo va ${product} y si necesitas algo (AppleCare, soporte, cambio de equipo). ¿Todo bien de tu lado?`;
  }
}

function waLink(opp: OpportunityRow): string | null {
  const phoneRaw = opp.user_phone || "";
  const digits = phoneRaw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Si ya empieza con 51 asumimos PE; si son 9 dígitos, anteponemos 51.
  const withCountry = digits.startsWith("51") ? digits : (digits.length === 9 ? "51" + digits : digits);
  const text = encodeURIComponent(whatsappScript(opp));
  return `https://wa.me/${withCountry}?text=${text}`;
}

// ──────────────────────────── component ────────────────────────────

export default function ExpansionClient({
  initialTableMissing,
  initialOpportunities,
  initialTotals,
  initialError,
}: Props) {
  const [tableMissing, setTableMissing] = useState(initialTableMissing);
  const [opps, setOpps] = useState<OpportunityRow[]>(initialOpportunities);
  const [totals, setTotals] = useState<Totals | null>(initialTotals);
  const [error, setError] = useState<string | null>(initialError);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lostModalId, setLostModalId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<string>("");

  // Filter: por defecto mostramos solo abiertas (Hot/Warm/Cold visibles)
  const [showClosed, setShowClosed] = useState(false);

  const visible = useMemo(() => {
    if (showClosed) return opps;
    return opps.filter((o) => ["new", "contacted", "in_conversation"].includes(o.status));
  }, [opps, showClosed]);

  const byTemp = useMemo(() => {
    return {
      hot:  visible.filter((o) => o.temperature === "hot"),
      warm: visible.filter((o) => o.temperature === "warm"),
      cold: visible.filter((o) => o.temperature === "cold"),
    };
  }, [visible]);

  // ─── actions ───

  async function runMigrate() {
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/admin/expansion/migrate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast(`✅ Migración OK — ${data.message || "tabla lista"}`);
      setTableMissing(false);
      await runRefresh(); // disparar compute + persist inmediatamente
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runRefresh() {
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/admin/expansion", { method: "POST" });
      const data = await res.json();
      if (res.status === 409 && data.code === "TABLE_MISSING") {
        setTableMissing(true);
        throw new Error(data.error);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast(`🔄 Recalculado — ${data.detected} detectadas · ${data.inserted} nuevas · ${data.updated} actualizadas`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function reload() {
    try {
      const res = await fetch("/api/admin/expansion", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 409 && data.code === "TABLE_MISSING") {
        setTableMissing(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOpps(data.opportunities || []);
      setTotals(data.totals || null);
      setTableMissing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function patch(id: string, body: Record<string, unknown>, successMsg: string) {
    setError(null);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/expansion/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast(successMsg);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function confirmLost() {
    if (!lostModalId) return;
    const reason = lostReason.trim();
    startTransition(() => {
      patch(lostModalId, { status: "lost", lost_reason: reason || null }, "❌ Marcada como perdida").then(() => {
        setLostModalId(null);
        setLostReason("");
      });
    });
  }

  // ─── early returns ───

  if (tableMissing) {
    return (
      <div className="bg-white rounded-2xl border border-[#FF8A00] p-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚡</div>
          <div className="flex-1">
            <h2 className="text-lg font-800 text-[#18191F] mb-1">Activación inicial</h2>
            <p className="text-sm text-[#666666] mb-4">
              La tabla <code className="px-1.5 py-0.5 bg-[#F7F7F7] rounded text-xs">expansion_opportunities</code> todavía no existe en la base.
              Esto la crea (idempotente) y ejecuta el primer cálculo sobre tu base activa.
            </p>
            <button
              onClick={() => startTransition(runMigrate)}
              disabled={busy}
              className="px-5 py-2.5 rounded-lg bg-[#1B4FFF] text-white text-sm font-700 hover:bg-[#1640CC] transition-colors disabled:opacity-50"
            >
              {busy ? "Ejecutando…" : "Crear tabla + calcular oportunidades"}
            </button>
            {error && <p className="text-sm text-[#D84040] mt-3">⚠️ {error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ─── render ───

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="mb-4 bg-[#E8F5EC] border border-[#2D7D46] rounded-lg px-4 py-2.5 text-sm text-[#2D7D46] font-600">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-[#FBE9E9] border border-[#D84040] rounded-lg px-4 py-2.5 text-sm text-[#D84040] font-600">
          ⚠️ {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <Stat label="Abiertas" value={totals?.open ?? "0"} accent="text-[#18191F]" />
        <Stat label="Hot 🔥" value={totals?.hot ?? "0"} accent="text-[#FF8A00]" />
        <Stat label="MRR potencial" value={fmtPEN(totals?.potential_mrr ?? 0)} accent="text-[#2D7D46]" />
        <Stat label="Ganadas / Perdidas" value={`${totals?.won ?? 0} / ${totals?.lost ?? 0}`} accent="text-[#666666]" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm text-[#666666]">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="rounded"
          />
          Mostrar cerradas (won / lost / snoozed)
        </label>
        <button
          onClick={() => startTransition(runRefresh)}
          disabled={busy}
          className="px-4 py-2 rounded-lg border border-[#1B4FFF] text-[#1B4FFF] text-sm font-700 hover:bg-[#F0F4FF] transition-colors disabled:opacity-50"
        >
          {busy ? "Recalculando…" : "🔄 Recalcular ahora"}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 text-center">
          <p className="text-sm text-[#666666]">
            No hay oportunidades abiertas. Probá <button onClick={() => startTransition(runRefresh)} className="underline text-[#1B4FFF]">recalcular</button> o activá “Mostrar cerradas”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Column
            title="🔥 Hot"
            subtitle="score ≥ 70"
            tone="hot"
            opps={byTemp.hot}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onAction={(id, body, msg) => startTransition(() => patch(id, body, msg))}
            onLost={(id) => { setLostModalId(id); setLostReason(""); }}
            busy={busy}
          />
          <Column
            title="🟡 Warm"
            subtitle="score 45-69"
            tone="warm"
            opps={byTemp.warm}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onAction={(id, body, msg) => startTransition(() => patch(id, body, msg))}
            onLost={(id) => { setLostModalId(id); setLostReason(""); }}
            busy={busy}
          />
          <Column
            title="🔵 Cold"
            subtitle="score < 45"
            tone="cold"
            opps={byTemp.cold}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onAction={(id, body, msg) => startTransition(() => patch(id, body, msg))}
            onLost={(id) => { setLostModalId(id); setLostReason(""); }}
            busy={busy}
          />
        </div>
      )}

      {/* Lost modal */}
      {lostModalId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setLostModalId(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-800 text-[#18191F] mb-1">Marcar como perdida</h3>
            <p className="text-sm text-[#666666] mb-3">
              Razón breve (opcional). Útil para aprender qué no funciona.
            </p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Ej: prefiere comprar, presupuesto cerrado, cambió de proveedor…"
              rows={3}
              className="w-full border border-[#E5E5E5] rounded-lg p-3 text-sm focus:outline-none focus:border-[#1B4FFF]"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setLostModalId(null)}
                className="px-4 py-2 text-sm text-[#666666] hover:text-[#18191F]"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLost}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-[#D84040] text-white text-sm font-700 hover:bg-[#B83030] disabled:opacity-50"
              >
                Confirmar pérdida
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────── subcomponents ────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
      <p className="text-xs text-[#999999]">{label}</p>
      <p className={`text-2xl font-800 ${accent}`}>{value}</p>
    </div>
  );
}

function Column({
  title, subtitle, tone, opps, expandedId, setExpandedId, onAction, onLost, busy,
}: {
  title: string;
  subtitle: string;
  tone: Temperature;
  opps: OpportunityRow[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onAction: (id: string, body: Record<string, unknown>, msg: string) => void;
  onLost: (id: string) => void;
  busy: boolean;
}) {
  const style = TEMP_STYLE[tone];
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      <div className={`${style.bg} border-b ${style.border} px-4 py-3 flex items-center justify-between`}>
        <div>
          <h2 className={`text-sm font-800 ${style.text}`}>{title}</h2>
          <p className="text-xs text-[#999999]">{subtitle}</p>
        </div>
        <span className={`text-sm font-800 ${style.text}`}>{opps.length}</span>
      </div>
      <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
        {opps.length === 0 ? (
          <p className="text-xs text-[#999999] text-center py-6">Sin oportunidades</p>
        ) : (
          opps.map((o) => (
            <Card
              key={o.id}
              opp={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              onAction={onAction}
              onLost={onLost}
              busy={busy}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Card({
  opp, expanded, onToggle, onAction, onLost, busy,
}: {
  opp: OpportunityRow;
  expanded: boolean;
  onToggle: () => void;
  onAction: (id: string, body: Record<string, unknown>, msg: string) => void;
  onLost: (id: string) => void;
  busy: boolean;
}) {
  const signals = opp.signals as ClientSignals | null;
  const [notes, setNotes] = useState(opp.admin_notes || "");
  const wa = waLink(opp);
  const isClosed = ["won", "lost", "snoozed"].includes(opp.status);

  const style = TEMP_STYLE[opp.temperature];

  return (
    <div className={`rounded-xl border ${isClosed ? "border-[#E5E5E5] opacity-60" : "border-[#E5E5E5]"} bg-white`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 hover:bg-[#FAFAFA] transition-colors rounded-t-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-700 text-[#18191F] truncate">{opp.user_name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} font-600`}>
                {opp.score}
              </span>
              {opp.status !== "new" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F7F7F7] text-[#666666] font-600">
                  {STATUS_LABEL[opp.status]}
                </span>
              )}
            </div>
            <p className="text-xs text-[#666666] truncate mt-0.5">
              {opp.user_company || opp.user_email}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-700 text-[#1B4FFF]">{PLAY_LABEL[opp.play_type]}</div>
            {opp.suggested_mrr_delta && Number(opp.suggested_mrr_delta) > 0 && (
              <div className="text-[10px] text-[#2D7D46] font-600">
                +{fmtPEN(opp.suggested_mrr_delta)}/mes
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[#E5E5E5] p-3 space-y-3">
          {/* Reason */}
          <div className="text-xs text-[#666666] bg-[#F7F7F7] rounded-lg p-2.5 leading-relaxed">
            {opp.play_reason}
          </div>

          {/* Signals grid */}
          {signals && (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Signal label="Producto" val={signals.max_product_name || "—"} />
              <Signal label="Equipos activos" val={String(signals.total_active_subs)} />
              <Signal label="Antigüedad" val={daysAgo(signals.first_sub_date)} />
              <Signal label="LTV" val={fmtPEN(signals.total_spent)} />
              <Signal label="Mora últ. 6m" val={signals.has_overdue_last_6mo ? "sí" : "no"} />
              <Signal label="RUC" val={signals.ruc ? "sí" : "no"} />
              <Signal label="AppleCare" val={signals.has_applecare ? "sí" : "no"} />
              <Signal
                label="Renovación"
                val={
                  signals.next_end_date
                    ? (() => {
                        const d = daysUntil(signals.next_end_date);
                        return d !== null ? (d >= 0 ? `en ${d}d` : `venció ${-d}d`) : "—";
                      })()
                    : "—"
                }
              />
            </div>
          )}

          {/* Actions */}
          {!isClosed && (
            <div className="flex flex-wrap gap-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onAction(opp.id, { status: "contacted" }, "💬 Marcado como contactado")}
                  className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-700 hover:bg-[#1EB658] transition-colors"
                >
                  💬 WhatsApp
                </a>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-[#F7F7F7] text-[#999999] text-xs font-600 cursor-not-allowed" title="Cliente sin teléfono">
                  💬 Sin teléfono
                </span>
              )}
              {opp.status !== "contacted" && (
                <button
                  onClick={() => onAction(opp.id, { status: "contacted" }, "✓ Contactado")}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#666666] text-xs font-700 hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors disabled:opacity-50"
                >
                  Contactado
                </button>
              )}
              {opp.status !== "in_conversation" && (
                <button
                  onClick={() => onAction(opp.id, { status: "in_conversation" }, "💬 En conversación")}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#666666] text-xs font-700 hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors disabled:opacity-50"
                >
                  En conversación
                </button>
              )}
              <button
                onClick={() => onAction(opp.id, { status: "won" }, "🎉 Ganada!")}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-[#2D7D46] text-white text-xs font-700 hover:bg-[#216035] transition-colors disabled:opacity-50"
              >
                ✅ Ganada
              </button>
              <button
                onClick={() => onLost(opp.id)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-[#D84040] text-[#D84040] text-xs font-700 hover:bg-[#FBE9E9] transition-colors disabled:opacity-50"
              >
                ❌ Perdida
              </button>
              <button
                onClick={() => onAction(opp.id, { status: "snoozed" }, "⏸ Pausada 14 días")}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#666666] text-xs font-700 hover:border-[#666666] transition-colors disabled:opacity-50"
              >
                ⏸ Snooze 14d
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] text-[#999999] font-600 uppercase tracking-wide">Notas internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if ((notes || "") !== (opp.admin_notes || "")) {
                  onAction(opp.id, { admin_notes: notes || null }, "📝 Notas guardadas");
                }
              }}
              rows={2}
              placeholder="Contexto, próximos pasos, objeciones…"
              className="w-full mt-1 border border-[#E5E5E5] rounded-lg p-2 text-xs focus:outline-none focus:border-[#1B4FFF]"
            />
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] text-[#999999] pt-1">
            <span>Creada {daysAgo(opp.created_at)}</span>
            {opp.contacted_at && <span>Contactado {daysAgo(opp.contacted_at)}</span>}
            {opp.snoozed_until && <span>Pausada hasta {new Date(opp.snoozed_until).toLocaleDateString("es-PE")}</span>}
            {opp.lost_reason && <span title={opp.lost_reason} className="truncate max-w-[40%]">❌ {opp.lost_reason}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Signal({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <div className="text-[#999999]">{label}</div>
      <div className="text-[#18191F] font-600">{val}</div>
    </div>
  );
}
