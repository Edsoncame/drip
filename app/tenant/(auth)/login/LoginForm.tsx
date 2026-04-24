"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Error" }));
        setError(body.error ?? `HTTP ${res.status}`);
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
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="tu@empresa.com"
        />
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:border-white/30 focus:outline-none"
        />
      </div>
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full bg-white text-black rounded-lg py-2.5 font-semibold hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
