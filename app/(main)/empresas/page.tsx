"use client";
import Link from "next/link";
import { useState } from "react";
import { products } from "@/lib/products";
import { motion } from "framer-motion";
import { trackGenerateLead } from "@/lib/analytics";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

function B2BForm() {
  const [form, setForm] = useState({ name: "", legal_representative: "", email: "", company: "", ruc: "", phone: "", quantity: "1-5", message: "" });
  const [rucStatus, setRucStatus] = useState<{ valid?: boolean; razonSocial?: string; loading?: boolean }>({});

  const verifyRuc = async (ruc: string) => {
    if (ruc.length !== 11) return;
    setRucStatus({ loading: true });
    try {
      const res = await fetch(`/api/verify-ruc?ruc=${ruc}`);
      const data = await res.json();
      setRucStatus({ valid: data.valid, razonSocial: data.razonSocial });
      if (data.valid && data.razonSocial && !form.company) {
        setForm(f => ({ ...f, company: data.razonSocial }));
      }
    } catch {
      setRucStatus({});
    }
  };
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error al enviar."); setLoading(false); return; }
      trackGenerateLead("b2b_form");
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  if (sent) return (
    <div className="text-center py-10">
      <div className="text-5xl mb-4">🎉</div>
      <h3 className="text-2xl font-800 text-white mb-2">¡Recibimos tu solicitud!</h3>
      <p className="text-white/70">Te contactamos en menos de 24 horas hábiles.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">Tu nombre (contacto operativo)</label>
          <input type="text" required value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Quién usará el panel"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">Representante legal</label>
          <input type="text" value={form.legal_representative} onChange={e => set("legal_representative", e.target.value)}
            placeholder="Para contrato y factura"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">Correo corporativo</label>
          <input type="email" required value={form.email} onChange={e => set("email", e.target.value)}
            placeholder="juan@empresa.com"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">RUC <span className="text-white/50">*</span></label>
          <input type="text" required value={form.ruc}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 11);
              set("ruc", v);
              if (v.length === 11) verifyRuc(v);
              else setRucStatus({});
            }}
            placeholder="20123456789"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all" />
          {rucStatus.valid === true && (
            <p className="text-xs text-green-300 mt-1 font-600">✓ {rucStatus.razonSocial}</p>
          )}
          {rucStatus.valid === false && form.ruc.length === 11 && (
            <p className="text-xs text-red-300 mt-1">✕ RUC no válido en SUNAT</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">Empresa</label>
          <input type="text" required value={form.company} onChange={e => set("company", e.target.value)}
            placeholder="Nombre de tu empresa"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-600 text-white/80 mb-1">WhatsApp / Teléfono</label>
          <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
            placeholder="+51 999 999 999"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-600 text-white/80 mb-1">¿Cuántos equipos necesitas?</label>
        <select value={form.quantity} onChange={e => set("quantity", e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm outline-none focus:border-white/60 transition-all">
          {["1-5", "6-10", "11-20", "21-50", "50+"].map(q => (
            <option key={q} value={q} style={{ background: "#1B4FFF", color: "#fff" }}>{q} equipos</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-600 text-white/80 mb-1">Cuéntanos más (opcional)</label>
        <textarea value={form.message} onChange={e => set("message", e.target.value)}
          rows={3} placeholder="¿Qué modelos te interesan? ¿Tienes un plazo específico?"
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm outline-none focus:border-white/60 transition-all resize-none" />
      </div>
      {error && <p className="text-sm text-red-300 bg-red-900/30 rounded-xl px-4 py-3">{error}</p>}
      <motion.button type="submit" disabled={loading}
        whileTap={{ scaleX: 1.04, scaleY: 0.93 }}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="w-full py-4 bg-white font-700 rounded-full text-sm hover:bg-gray-100 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
        style={{ color: "var(--primary)" }}>
        {loading ? (
          <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>Enviando…</>
        ) : "Quiero una propuesta →"}
      </motion.button>
    </form>
  );
}

export default function Empresas() {
  return (
    <div>
      {/* Hero */}
      <section className="py-16 md:py-24" style={{ background: "var(--dark)" }}>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="max-w-5xl mx-auto px-4 sm:px-6 text-center"
        >
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-6"
            style={{ background: "rgba(27,79,255,0.3)", color: "#7EA8FF", border: "1px solid rgba(27,79,255,0.4)" }}>
            FLUX para Empresas
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-5" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Dale Mac a tu equipo.<br />Sin gastar un sol hoy.
          </h1>
          <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
            Paga mensual, olvídate del hardware y enfócate en lo que realmente importa. FLUX arma el plan para tu empresa en 24 horas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/laptops" className="px-8 py-4 font-bold rounded-full text-sm transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "#fff" }}>
              Ver MacBooks disponibles
            </Link>
            <a href="#cotizar" className="px-8 py-4 font-bold rounded-full text-sm text-white transition-all hover:bg-white/10"
              style={{ border: "2px solid rgba(255,255,255,0.3)" }}>
              Pedir cotización gratis
            </a>
          </div>
        </motion.div>
      </section>

      {/* Value props */}
      <section className="py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { icon: "🏦", title: "Cero CAPEX", desc: "Todo sale de OPEX. Tu flujo de caja queda libre para crecer, contratar o invertir en lo que importa." },
              { icon: "🔒", title: "MDM incluido", desc: "Enrola, controla y gestiona los equipos de tu equipo desde el día uno. Sin configuraciones raras." },
              { icon: "💼", title: "Contratos a tu medida", desc: "Arreglamos un contrato marco para tu empresa con facturación mensual consolidada. Sin papeleo infinito." },
              { icon: "💰", title: "Tu equipo puede comprarla", desc: "Al terminar el plazo, tu trabajador compra la Mac en 16 cuotas. Tú no tienes que gestionar nada." },
              { icon: "🔄", title: "Sin activos tirados", desc: "Cuando un equipo termina su ciclo, se reasigna o se vende al valor residual. Cero desperdicio." },
              { icon: "📊", title: "Todo en un dashboard", desc: "Ves el estado de cada dispositivo, cuándo vence, quién lo tiene y qué opciones hay. Sin llamadas." },
            ].map(v => (
              <motion.div
                key={v.title}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-6 rounded-2xl border"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-3xl mb-4">{v.icon}</div>
                <h3 className="font-black mb-2" style={{ color: "var(--dark-text)" }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>{v.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing table */}
      <section className="py-14" style={{ background: "var(--light-bg)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black mb-8 text-center" style={{ color: "var(--dark-text)" }}>Precios para empresas</h2>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: "var(--primary)" }}>
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-bold text-white">Modelo</th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">8 meses</th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">16 meses</th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">24 meses</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.slug} style={{ borderBottom: i < products.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm" style={{ color: "var(--dark-text)" }}>{p.shortName}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--light-text)" }}>{p.chip} · {p.ram} · {p.ssd}</p>
                      </td>
                      {p.pricing.map(pr => (
                        <td key={pr.months} className="px-6 py-4 text-center">
                          <span className="text-xl font-black" style={{ color: "var(--dark-text)" }}>${pr.price}</span>
                          <span className="text-xs ml-0.5" style={{ color: "var(--light-text)" }}>/mes</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 text-xs" style={{ color: "var(--light-text)", borderTop: "1px solid var(--border)" }}>
              * Precios en USD · IGV no incluido · Para flotas de 5+ equipos consultar precios especiales
            </div>
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="cotizar" className="py-16" style={{ background: "var(--primary)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-white mb-3">¿Cuántas Macs necesita tu equipo?</h2>
            <p className="text-white/80">Llena el formulario y en menos de 24 horas tienes una propuesta lista. Sin vueltas.</p>
          </div>
          <B2BForm />
        </div>
      </section>
    </div>
  );
}
