"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Suspense } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    phone: "",
    ruc: "",
  });
  const [errors, setErrors] = useState<Partial<typeof form & { general: string }>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Requerido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    if (form.password.length < 8) e.password = "Mínimo 8 caracteres";
    if (!form.company.trim()) e.company = "Requerido";
    if (!form.phone.trim()) e.phone = "Requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error });
        setLoading(false);
        return;
      }

      router.push(redirect);
    } catch {
      setErrors({ general: "Error de conexión. Intenta de nuevo." });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="block text-center mb-8">
          <span className="text-3xl font-900 text-[#18191F] tracking-tight">flux</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl p-8 shadow-sm"
        >
          <h1 className="text-2xl font-800 text-[#18191F] mb-1">Crea tu cuenta</h1>
          <p className="text-sm text-[#666666] mb-6">
            ¿Ya tienes cuenta?{" "}
            <Link href={`/auth/login${redirect !== "/" ? `?redirect=${redirect}` : ""}`} className="text-[#1B4FFF] font-600 hover:underline">
              Inicia sesión
            </Link>
          </p>

          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-600">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <Field
              label="Nombre completo"
              required
              error={errors.name}
            >
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Juan Pérez"
                className={inputClass(!!errors.name)}
              />
            </Field>

            {/* Email */}
            <Field label="Correo electrónico" required error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="juan@empresa.com"
                className={inputClass(!!errors.email)}
                autoComplete="email"
              />
            </Field>

            {/* Password */}
            <Field label="Contraseña" required error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Mínimo 8 caracteres"
                  className={`${inputClass(!!errors.password)} pr-12`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333] transition-colors"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </Field>

            {/* Company */}
            <Field label="Empresa" required error={errors.company}>
              <input
                type="text"
                value={form.company}
                onChange={set("company")}
                placeholder="Mi Empresa S.A.C."
                className={inputClass(!!errors.company)}
              />
            </Field>

            {/* Phone */}
            <Field label="Teléfono / WhatsApp" required error={errors.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+51 999 000 000"
                className={inputClass(!!errors.phone)}
              />
            </Field>

            {/* RUC optional */}
            <Field label="RUC" optional>
              <input
                type="text"
                value={form.ruc}
                onChange={set("ruc")}
                placeholder="20123456789"
                className={inputClass(false)}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner />
                  Creando cuenta…
                </>
              ) : (
                "Crear cuenta gratis"
              )}
            </button>
          </form>

          <p className="text-xs text-[#999999] text-center mt-4 leading-relaxed">
            Al registrarte aceptas nuestros{" "}
            <a href="#" className="text-[#1B4FFF] hover:underline">Términos de servicio</a>{" "}
            y{" "}
            <a href="#" className="text-[#1B4FFF] hover:underline">Política de privacidad</a>.
          </p>
        </motion.div>

        <p className="text-center text-xs text-[#999999] mt-6">
          © 2025 FLUX — Tika Services S.A.C.
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
    hasError
      ? "border-red-400 bg-red-50 focus:border-red-400"
      : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
  }`;
}

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-600 text-[#333333] mb-1">
        {label}{" "}
        {required && <span className="text-[#1B4FFF]">*</span>}
        {optional && <span className="text-[#999999] font-400">(opcional)</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
    </svg>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F7F7]" />}>
      <RegisterForm />
    </Suspense>
  );
}
