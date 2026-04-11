"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

function NuevaPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 8) { setError("Mínimo 8 caracteres."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="text-center py-10">
      <p className="text-[#666]">Enlace inválido.</p>
      <Link href="/auth/recuperar" className="text-[#1B4FFF] font-600 mt-2 block">Solicitar nuevo enlace</Link>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }} className="bg-white rounded-3xl p-8 shadow-sm">
      {done ? (
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-800 text-[#18191F] mb-2">¡Contraseña actualizada!</h1>
          <p className="text-sm text-[#666666]">Redirigiendo al inicio de sesión…</p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-800 text-[#18191F] mb-1">Nueva contraseña</h1>
          <p className="text-sm text-[#666666] mb-6">Elige una contraseña segura de al menos 8 caracteres.</p>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">Nueva contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres" required minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">Confirmar contraseña</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña" required
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
              {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>Guardando…</>) : "Guardar contraseña"}
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}

export default function NuevaPasswordPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="Flux" className="h-10 mx-auto" />
        </Link>
        <Suspense fallback={<div className="bg-white rounded-3xl p-8 shadow-sm" />}>
          <NuevaPasswordForm />
        </Suspense>
        <p className="text-center text-xs text-[#999999] mt-6">© 2026 FLUX — Tika Services S.A.C.</p>
      </div>
    </div>
  );
}
