"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="Flux" className="h-10 mx-auto" />
        </Link>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="bg-white rounded-3xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h1 className="text-2xl font-800 text-[#18191F] mb-2">Revisa tu correo</h1>
              <p className="text-sm text-[#666666] mb-6">
                Si tu email está registrado en FLUX, recibirás un enlace para crear una nueva contraseña. Revisa también tu carpeta de spam.
              </p>
              <Link href="/auth/login" className="text-sm font-600 text-[#1B4FFF] hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-800 text-[#18191F] mb-1">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-[#666666] mb-6">
                Ingresa tu correo y te mandamos un enlace para crear una nueva.
              </p>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-600">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-600 text-[#333333] mb-1">Correo electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="juan@empresa.com" required
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>Enviando…</>
                  ) : "Enviar enlace"}
                </button>
              </form>
              <p className="text-center text-sm mt-5">
                <Link href="/auth/login" className="text-[#1B4FFF] font-600 hover:underline">Volver al inicio de sesión</Link>
              </p>
            </>
          )}
        </motion.div>
        <p className="text-center text-xs text-[#999999] mt-6">© 2026 FLUX — Tika Services S.A.C.</p>
      </div>
    </div>
  );
}
