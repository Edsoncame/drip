"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useProducts } from "@/lib/use-products";
import BuyVsRentCalculator from "@/components/BuyVsRentCalculator";
import { motion } from "framer-motion";
import { trackGenerateLead } from "@/lib/analytics";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

// ── GA4 helper ──────────────────────────────────────────────────────────────
function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // via GTM dataLayer
  if (window.dataLayer) {
    window.dataLayer.push({ event: eventName, ...params });
  }
  // direct gtag fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.gtag === "function") {
    w.gtag("event", eventName, params);
  }
}

// ── Pain points (arquetipos reales) ─────────────────────────────────────────
const painPoints = [
  {
    icon: "⚡",
    role: "CTO / IT Manager",
    quote: "Necesito equipar al equipo rápido sin pasar por procurement de 3 meses.",
    solution: "Con FLUX, 10 MacBooks listas en 24 horas. Sin licitación, sin PO, sin esperas.",
  },
  {
    icon: "💸",
    role: "CEO / Founder startup",
    quote: "No quiero inmovilizar capital en laptops que quedan obsoletas.",
    solution: "Pagas mensual desde OPEX. Tu capital se queda donde genera retorno.",
  },
  {
    icon: "🧩",
    role: "Gerente de RRHH / Ops",
    quote: "El onboarding de nuevos empleados tarda demasiado por los equipos.",
    solution: "Nuevo colaborador hoy, Mac lista mañana. FLUX gestiona el ciclo completo.",
  },
];

// ── Value props ──────────────────────────────────────────────────────────────
const valueProps = [
  {
    icon: "🏦",
    title: "Cero CAPEX",
    desc: "Todo sale de OPEX. Tu flujo de caja queda libre para crecer, contratar o invertir donde importa.",
  },
  {
    icon: "🔒",
    title: "MDM incluido",
    desc: "Enrola, controla y gestiona cada equipo desde el día uno. Sin configuraciones complicadas.",
  },
  {
    icon: "📋",
    title: "Factura con RUC",
    desc: "Factura electrónica mensual consolidada. Deducible como gasto operativo ante SUNAT.",
  },
  {
    icon: "💰",
    title: "Opción de compra para tu equipo",
    desc: "Al terminar el plazo, tu colaborador puede comprar la Mac en 16 cuotas. Tú no gestionas nada.",
  },
  {
    icon: "🔄",
    title: "Sin activos tirados",
    desc: "Cuando un equipo termina su ciclo, se reasigna o vende al valor residual. Cero desperdicio.",
  },
  {
    icon: "📊",
    title: "Dashboard de flota",
    desc: "Estado de cada dispositivo, fecha de vencimiento, asignación y opciones — todo en un panel.",
  },
];

// ── Testimonios ──────────────────────────────────────────────────────────────
const testimonials = [
  {
    name: "Andrea C.",
    role: "Head of Ops · Fintech Lima",
    text: "Equipamos a 12 personas con MacBook Pro en una semana. Sin comprar nada. FLUX lo hizo fácil.",
    stars: 5,
    equipos: "12 equipos",
  },
  {
    name: "Marco V.",
    role: "CEO · Agencia Digital",
    text: "El modelo es perfecto para nosotros. Pagas mes a mes, y cuando tu equipo crece solo agregas más Macs. Sin trámites.",
    stars: 5,
    equipos: "8 equipos",
  },
  {
    name: "Lucía R.",
    role: "CFO · Startup SaaS",
    text: "Lo mejor: cero CAPEX. Todo va a OPEX y eso cambia totalmente el flujo de caja. Ya renovamos por segundo año.",
    stars: 5,
    equipos: "20 equipos",
  },
  {
    name: "Diego M.",
    role: "CTO · Consultora Tech",
    text: "En 24 horas teníamos 5 MacBook Pro M4 listas para nuestros devs. Impresionante la velocidad de respuesta.",
    stars: 5,
    equipos: "5 equipos",
  },
  {
    name: "Valeria S.",
    role: "Gerente de RRHH · Retail",
    text: "El onboarding de nuevos empleados cambió completamente. Ahora el equipo llega el mismo día que el colaborador.",
    stars: 5,
    equipos: "15 equipos",
  },
];

// ── FAQ ──────────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "¿La factura es deducible ante SUNAT?",
    a: "Sí. Emitimos factura electrónica mensual a tu RUC. El alquiler de equipos es gasto operativo deducible al 100% como arrendamiento de activos.",
  },
  {
    q: "¿Qué pasa si un equipo se daña o lo roban?",
    a: "Todos los equipos tienen cobertura incluida. Ante daño accidental coordinamos el reemplazo. Para robo con denuncia policial, el proceso es igual de rápido.",
  },
  {
    q: "¿En cuánto tiempo recibo los equipos en Lima?",
    a: "24 horas hábiles desde que confirmamos el contrato. Para flotas de más de 10 equipos, coordinamos entrega escalonada según tu cronograma de onboarding.",
  },
  {
    q: "¿Puedo ampliar o reducir la flota durante el contrato?",
    a: "Sí. Puedes agregar equipos en cualquier momento (se suma al contrato con facturación prorrateada). Para reducir, lo coordinamos al vencimiento del plazo de cada equipo.",
  },
  {
    q: "¿Cuál es el plazo mínimo de contrato?",
    a: "8 meses. Ofrecemos planes de 8, 16 y 24 meses. A mayor plazo, menor cuota mensual. Para startups en etapa temprana tenemos condiciones especiales.",
  },
  {
    q: "¿Qué modelos tienen disponibles?",
    a: "MacBook Air M2 y M3, MacBook Pro M4 Pro y M4 Max. Todos con Apple Silicon. Stock en Lima disponible para entrega inmediata.",
  },
];

// ── Formulario B2B ───────────────────────────────────────────────────────────
function B2BForm() {
  const [form, setForm] = useState({
    name: "",
    legal_representative: "",
    email: "",
    company: "",
    ruc: "",
    phone: "",
    quantity: "1-5",
    message: "",
  });
  const [rucStatus, setRucStatus] = useState<{
    valid?: boolean;
    razonSocial?: string;
    loading?: boolean;
  }>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trackedFocus = useRef(false);

  const verifyRuc = async (ruc: string) => {
    if (ruc.length !== 11) return;
    setRucStatus({ loading: true });
    try {
      const res = await fetch(`/api/verify-ruc?ruc=${ruc}`);
      const data = await res.json();
      setRucStatus({ valid: data.valid, razonSocial: data.razonSocial });
      if (data.valid && data.razonSocial && !form.company) {
        setForm((f) => ({ ...f, company: data.razonSocial }));
      }
    } catch {
      setRucStatus({});
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Dispara cotizacion_iniciada la primera vez que el usuario toca el formulario
  const handleFirstFocus = () => {
    if (trackedFocus.current) return;
    trackedFocus.current = true;
    trackEvent("cotizacion_iniciada", {
      form_location: "landing_empresas",
      form_type: "b2b_cotizacion",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al enviar.");
        setLoading(false);
        return;
      }
      // GA4: generate_lead (cotización completada)
      trackGenerateLead("b2b_form_empresas");
      trackEvent("cotizacion_completada", {
        form_location: "landing_empresas",
        cantidad_equipos: form.quantity,
      });
      // Meta Pixel: Lead event
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fbq = (window as any).fbq;
        if (typeof fbq === "function") {
          fbq("track", "Lead", {
            content_name: "b2b_cotizacion_empresas",
            content_category: "lead_generation",
            value: form.quantity,
            currency: "PEN",
          });
        }
      }
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  if (sent)
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-2xl font-black text-white mb-3">
          ¡Recibimos tu solicitud!
        </h3>
        <p className="text-white/70 mb-6 text-lg">
          Te contactamos en menos de 24 horas hábiles.
        </p>
        <a
          href={`https://wa.me/51900164769?text=Hola%2C%20acabo%20de%20enviar%20una%20solicitud%20de%20cotizaci%C3%B3n%20para%20${encodeURIComponent(form.company || "mi empresa")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-full text-sm transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Hablar por WhatsApp ahora
        </a>
      </div>
    );

  return (
    <form onSubmit={handleSubmit} onFocus={handleFirstFocus} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">
            Tu nombre (contacto operativo)
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Quién usará el panel"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">
            Representante legal
          </label>
          <input
            type="text"
            value={form.legal_representative}
            onChange={(e) => set("legal_representative", e.target.value)}
            placeholder="Para contrato y factura"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">
            Correo corporativo
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="juan@empresa.com"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">
            RUC <span className="text-white/50">*</span>
          </label>
          <input
            type="text"
            required
            value={form.ruc}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 11);
              set("ruc", v);
              if (v.length === 11) verifyRuc(v);
              else setRucStatus({});
            }}
            placeholder="20123456789"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all"
          />
          {rucStatus.loading && (
            <p className="text-xs text-white/50 mt-1">Verificando RUC…</p>
          )}
          {rucStatus.valid === true && (
            <p className="text-xs text-green-300 mt-1 font-600">
              ✓ {rucStatus.razonSocial}
            </p>
          )}
          {rucStatus.valid === false && form.ruc.length === 11 && (
            <p className="text-xs text-red-300 mt-1">✕ RUC no válido en SUNAT</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">
            Empresa
          </label>
          <input
            type="text"
            required
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Nombre de tu empresa"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">
            WhatsApp / Teléfono
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+51 999 999 999"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-600 text-white/80 mb-1">
          ¿Cuántos equipos necesitas?
        </label>
        <select
          value={form.quantity}
          onChange={(e) => set("quantity", e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm outline-none focus:border-white/60 transition-all"
        >
          {["1-5", "6-10", "11-20", "21-50", "50+"].map((q) => (
            <option key={q} value={q} style={{ background: "#1B4FFF", color: "#fff" }}>
              {q} equipos
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-600 text-white/80 mb-1">
          Cuéntanos más (opcional)
        </label>
        <textarea
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          rows={3}
          placeholder="¿Qué modelos te interesan? ¿Tienes un plazo específico?"
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all resize-none"
        />
      </div>
      {error && (
        <p className="text-sm text-red-300 bg-red-900/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      <motion.button
        type="submit"
        disabled={loading}
        whileTap={{ scaleX: 1.04, scaleY: 0.93 }}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="w-full py-4 bg-white font-700 rounded-full text-sm hover:bg-gray-100 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
        style={{ color: "var(--primary)" }}
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
            Enviando…
          </>
        ) : (
          "Quiero mi propuesta en 24h →"
        )}
      </motion.button>
      <p className="text-center text-white/50 text-xs">
        Sin compromiso · Respondemos en menos de 24 horas hábiles
      </p>
    </form>
  );
}

// ── FAQ Accordion ────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-sm pr-4" style={{ color: "var(--dark-text)" }}>
          {q}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="shrink-0 transition-transform"
          style={{
            color: "var(--primary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>
            {a}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Empresas() {
  const { products } = useProducts();

  return (
    <div>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24" style={{ background: "var(--dark)" }}>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="max-w-5xl mx-auto px-4 sm:px-6 text-center"
        >
          <span
            className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-6"
            style={{
              background: "rgba(27,79,255,0.3)",
              color: "#7EA8FF",
              border: "1px solid rgba(27,79,255,0.4)",
            }}
          >
            FLUX para Empresas · Lima, Perú
          </span>
          <h1
            className="text-4xl md:text-6xl font-black text-white mb-5"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.05 }}
          >
            La Mac que tu empresa
            <br />
            necesita, hoy.
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-4 max-w-2xl mx-auto">
            Sin comprar. Sin CAPEX. Sin esperar 3 meses a procurement.
          </p>
          <p className="text-base text-white/50 mb-10 max-w-xl mx-auto">
            MacBooks para tu equipo desde <strong className="text-white/80">$85/mes</strong> · Entrega en Lima en 24h · Factura con RUC
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#cotizar"
              className="px-8 py-4 font-bold rounded-full text-sm transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              Pedir cotización gratis →
            </a>
            <a
              href={`https://wa.me/51900164769?text=Hola%2C%20quiero%20cotizar%20MacBooks%20para%20mi%20empresa`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 font-bold rounded-full text-sm text-white transition-all hover:bg-white/10 flex items-center justify-center gap-2"
              style={{ border: "2px solid rgba(255,255,255,0.3)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Hablar por WhatsApp
            </a>
          </div>
          {/* Social proof bar */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-white/40 text-xs font-600">
            <span>✓ +50 empresas en Lima</span>
            <span className="hidden sm:inline">·</span>
            <span>✓ Entrega en 24h</span>
            <span className="hidden sm:inline">·</span>
            <span>✓ Factura electrónica con RUC</span>
            <span className="hidden sm:inline">·</span>
            <span>✓ MDM incluido</span>
          </div>
        </motion.div>
      </section>

      {/* ── PAIN POINTS ───────────────────────────────────────────────────── */}
      <section className="py-14" style={{ background: "var(--light-bg)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: "var(--dark-text)" }}>
              ¿Te suena familiar?
            </h2>
            <p className="text-sm" style={{ color: "var(--medium-text)" }}>
              Estas son las situaciones que resolvemos todos los días.
            </p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {painPoints.map((p) => (
              <motion.div
                key={p.role}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="text-3xl mb-3">{p.icon}</div>
                <p className="text-xs font-bold mb-2" style={{ color: "var(--primary)" }}>
                  {p.role}
                </p>
                <p
                  className="text-sm italic leading-relaxed mb-4"
                  style={{ color: "var(--medium-text)" }}
                >
                  &ldquo;{p.quote}&rdquo;
                </p>
                <div
                  className="border-t pt-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="text-sm font-bold" style={{ color: "var(--dark-text)" }}>
                    {p.solution}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── VALUE PROPS ───────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: "var(--dark-text)" }}>
              Todo lo que incluye el plan empresas
            </h2>
            <p className="text-sm" style={{ color: "var(--medium-text)" }}>
              No es solo alquiler. Es infraestructura tecnológica gestionada.
            </p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {valueProps.map((v) => (
              <motion.div
                key={v.title}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-6 rounded-2xl border"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-3xl mb-4">{v.icon}</div>
                <h3 className="font-black mb-2" style={{ color: "var(--dark-text)" }}>
                  {v.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRICING TABLE ─────────────────────────────────────────────────── */}
      <section className="py-14" style={{ background: "var(--light-bg)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: "var(--dark-text)" }}>
              Precios para empresas
            </h2>
            <p className="text-sm" style={{ color: "var(--medium-text)" }}>
              Transparentes. Sin sorpresas. Para flotas de 5+ equipos, consulta descuentos por volumen.
            </p>
          </div>
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: "var(--primary)" }}>
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-bold text-white">
                      Modelo
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">
                      8 meses
                    </th>
                    <th className="px-4 py-4 text-sm font-bold text-white text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.25)" }}
                        >
                          MÁS POPULAR
                        </span>
                        16 meses
                      </div>
                    </th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">
                      24 meses
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr
                      key={p.slug}
                      style={{
                        borderBottom:
                          i < products.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm" style={{ color: "var(--dark-text)" }}>
                          {p.shortName}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--light-text)" }}>
                          {p.chip} · {p.ram} · {p.ssd}
                        </p>
                      </td>
                      {p.pricing.map((pr, idx) => (
                        <td
                          key={pr.months}
                          className="px-6 py-4 text-center"
                          style={
                            idx === 1
                              ? { background: "rgba(27,79,255,0.04)" }
                              : undefined
                          }
                        >
                          <span
                            className="text-xl font-black"
                            style={{ color: idx === 1 ? "var(--primary)" : "var(--dark-text)" }}
                          >
                            ${pr.price}
                          </span>
                          <span className="text-xs ml-0.5" style={{ color: "var(--light-text)" }}>
                            /mes
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className="px-6 py-4 text-xs flex flex-wrap gap-4 items-center justify-between"
              style={{ color: "var(--light-text)", borderTop: "1px solid var(--border)" }}
            >
              <span>* Precios en USD · IGV no incluido</span>
              <a
                href="#cotizar"
                className="font-bold text-xs hover:underline"
                style={{ color: "var(--primary)" }}
              >
                Flotas 5+ equipos → consultar descuento
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ───────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: "var(--dark-text)" }}>
              Empresas que ya hacen flux
            </h2>
            <p className="text-sm" style={{ color: "var(--medium-text)" }}>
              +50 empresas en Lima confían en FLUX para gestionar su flota de MacBooks.
            </p>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {testimonials.slice(0, 3).map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FFC700">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                    ))}
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(27,79,255,0.08)",
                      color: "var(--primary)",
                    }}
                  >
                    {t.equipos}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: "var(--dark-text)" }}
                >
                  &ldquo;{t.text}&rdquo;
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--dark-text)" }}>
                  {t.name}
                </p>
                <p className="text-xs" style={{ color: "var(--light-text)" }}>
                  {t.role}
                </p>
              </motion.div>
            ))}
          </motion.div>
          {/* Segunda fila de testimonios */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 max-w-3xl mx-auto"
          >
            {testimonials.slice(3).map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FFC700">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                    ))}
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(27,79,255,0.08)",
                      color: "var(--primary)",
                    }}
                  >
                    {t.equipos}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: "var(--dark-text)" }}
                >
                  &ldquo;{t.text}&rdquo;
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--dark-text)" }}>
                  {t.name}
                </p>
                <p className="text-xs" style={{ color: "var(--light-text)" }}>
                  {t.role}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CALCULADORA ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: "var(--dark-text)" }}>
              ¿Cuánto ahorras vs. comprar?
            </h2>
            <p className="text-sm" style={{ color: "var(--medium-text)" }}>
              Calculá el impacto real en tu flujo de caja.
            </p>
          </div>
          <BuyVsRentCalculator />
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ color: "var(--dark-text)" }}>
              Preguntas frecuentes
            </h2>
            <p className="text-sm" style={{ color: "var(--medium-text)" }}>
              Todo lo que necesitás saber antes de firmar.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULARIO COTIZACIÓN ─────────────────────────────────────────── */}
      <section id="cotizar" className="py-16" style={{ background: "var(--primary)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span
              className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-4"
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Propuesta en 24 horas hábiles
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              ¿Cuántas Macs necesita
              <br />
              tu equipo?
            </h2>
            <p className="text-white/70 text-base">
              Llenás el formulario, nosotros armamos la propuesta. Sin vueltas, sin llamadas en frío.
            </p>
          </div>
          <B2BForm />
          {/* WhatsApp alternativo */}
          <div className="mt-8 text-center">
            <p className="text-white/50 text-sm mb-3">¿Preferís hablar directo?</p>
            <a
              href="https://wa.me/51900164769?text=Hola%2C%20quiero%20cotizar%20MacBooks%20para%20mi%20empresa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              +51 900 164 769
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
