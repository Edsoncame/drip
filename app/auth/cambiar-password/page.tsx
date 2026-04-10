"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

function CambiarPasswordForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!form.currentPassword) return "Ingresa tu contraseña actual.";
    if (form.newPassword.length < 8) return "La nueva contraseña debe tener al menos 8 caracteres.";
    if (form.newPassword !== form.confirmPassword) return "Las contraseñas no coinciden.";
    if (form.newPassword === form.currentPassword) return "La nueva contraseña debe ser diferente a la actual.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al cambiar la contraseña.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/cuenta"), 2500);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--light-bg)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-10 text-center max-w-sm w-full shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D7D46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-xl font-800 text-[#18191F] mb-2">¡Contraseña actualizada!</h2>
          <p className="text-sm text-[#666666]">Te redirigimos a tu cuenta en un momento...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--light-bg)" }}>
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link href="/cuenta" className="inline-flex items-center gap-2 text-sm text-[#666666] hover:text-[#1B4FFF] mb-8 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Volver a mi cuenta
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-[#E5E5E5]"
        >
          {/* Header */}
          <div className="mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-2xl font-800 text-[#18191F]">Cambiar contraseña</h1>
            <p className="text-sm text-[#666666] mt-1">Elige una contraseña segura de al menos 8 caracteres.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1.5">Contraseña actual</label>
              <div className="relative">
                <input
                  type={show.current ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all"
                  placeholder="Tu contraseña actual"
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, current: !s.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333] transition-colors cursor-pointer">
                  {show.current ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={show.new ? "text" : "password"}
                  value={form.newPassword}
                  onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all"
                  placeholder="Mínimo 8 caracteres"
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, new: !s.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333] transition-colors cursor-pointer">
                  {show.new ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {/* Strength indicator */}
              {form.newPassword && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map(i => {
                    const len = form.newPassword.length;
                    const hasSpecial = /[!@#$%^&*]/.test(form.newPassword);
                    const hasUpper = /[A-Z]/.test(form.newPassword);
                    const strength = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasSpecial ? 1 : 0) + (hasUpper ? 1 : 0);
                    const active = i <= strength;
                    return (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all"
                        style={{ background: active ? (strength <= 1 ? "#FF4D4D" : strength <= 2 ? "#FF9500" : strength <= 3 ? "#34C759" : "#1B4FFF") : "#E5E5E5" }} />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1.5">Confirmar nueva contraseña</label>
              <div className="relative">
                <input
                  type={show.confirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all"
                  placeholder="Repite la nueva contraseña"
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333] transition-colors cursor-pointer">
                  {show.confirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                <p className="text-xs text-[#FF4D4D] mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#FFF0F0] border border-[#FFD0D0] text-[#CC0000] text-sm rounded-xl px-4 py-3"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scaleX: 1.06, scaleY: 0.91 }}
              transition={{ type: "spring", stiffness: 700, damping: 30 }}
              className="w-full py-3.5 rounded-full bg-[#1B4FFF] text-white font-700 text-sm hover:bg-[#1340CC] transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Cambiar contraseña"}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default function CambiarPasswordPage() {
  return (
    <Suspense>
      <CambiarPasswordForm />
    </Suspense>
  );
}
