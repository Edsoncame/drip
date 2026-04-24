"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      router.push("/tenant");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white/70 cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
          Tu nombre
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:border-white/30 focus:outline-none"
          placeholder="Ana Pérez"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
          Contraseña (mín 8 chars)
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:border-white/30 focus:outline-none"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
          Confirmar contraseña
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:border-white/30 focus:outline-none"
          autoComplete="new-password"
        />
      </div>
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !name || password.length < 8 || password !== confirmPassword}
        className="w-full bg-white text-black rounded-lg py-2.5 font-semibold hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? "Activando…" : "Crear mi cuenta"}
      </button>
    </form>
  );
}
