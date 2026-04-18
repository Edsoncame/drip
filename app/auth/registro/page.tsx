"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { trackSignUp } from "@/lib/analytics";
import Link from "next/link";
import GoogleAuthButton, { isGoogleOAuthEnabled } from "@/components/GoogleAuthButton";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const refParam = searchParams.get("ref") ?? "";

  const [customerType, setCustomerType] = useState<"persona" | "empresa">("persona");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    phone: "",
    ruc: "",
    referralCode: refParam,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rucStatus, setRucStatus] = useState<{ valid?: boolean; razonSocial?: string; loading?: boolean }>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Requerido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    if (form.password.length < 8) e.password = "Mínimo 8 caracteres";
    if (!form.phone.trim()) e.phone = "Requerido";
    if (customerType === "empresa") {
      if (!form.company.trim()) e.company = "Razón social requerida";
      const ruc = form.ruc.trim();
      if (!/^\d{11}$/.test(ruc)) {
        e.ruc = "RUC debe tener 11 dígitos";
      } else if (!/^(10|15|17|20)/.test(ruc)) {
        e.ruc = "RUC inválido. Debe empezar con 10, 15, 17 o 20";
      }
    }
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
        body: JSON.stringify({ ...form, customerType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error });
        setLoading(false);
        return;
      }

      trackSignUp("email");
      router.push(redirect);
    } catch {
      setErrors({ general: "Error de conexión. Intenta de nuevo." });
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

          {/* Customer type toggle */}
          <div className="flex gap-3 mb-5">
            <button type="button" onClick={() => {
              setCustomerType("persona");
              setForm(f => ({ ...f, ruc: "", company: "" }));
              setRucStatus({});
            }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-700 transition-all cursor-pointer ${
                customerType === "persona" ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]" : "border-[#E5E5E5] text-[#666666] hover:border-[#BBCAFF]"
              }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Persona natural
            </button>
            <button type="button" onClick={() => setCustomerType("empresa")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-700 transition-all cursor-pointer ${
                customerType === "empresa" ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]" : "border-[#E5E5E5] text-[#666666] hover:border-[#BBCAFF]"
              }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>
              Persona jurídica
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nombre completo" required error={errors.name}>
              <input type="text" value={form.name} onChange={set("name")}
                placeholder="Juan Pérez" className={inputClass(!!errors.name)} autoComplete="name" />
            </Field>

            <Field label="Correo electrónico" required error={errors.email}>
              <input type="email" value={form.email} onChange={set("email")}
                placeholder={customerType === "empresa" ? "juan@empresa.com" : "juan@gmail.com"}
                className={inputClass(!!errors.email)} autoComplete="email" />
            </Field>

            <Field label="Contraseña" required error={errors.password}>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")}
                  placeholder="Mínimo 8 caracteres" className={`${inputClass(!!errors.password)} pr-12`} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333]">
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </Field>

            <Field label="Teléfono / WhatsApp" required error={errors.phone}>
              <input type="tel" value={form.phone} onChange={set("phone")}
                placeholder="+51 999 000 000" className={inputClass(!!errors.phone)} autoComplete="tel" />
            </Field>

            {customerType === "empresa" && (
              <>
                <Field label="RUC" required error={errors.ruc}>
                  <input type="text" value={form.ruc} inputMode="numeric" maxLength={11}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setForm(f => ({ ...f, ruc: v }));
                      if (v.length === 11) verifyRuc(v);
                      else setRucStatus({});
                    }}
                    placeholder="20123456789" className={inputClass(!!errors.ruc || rucStatus.valid === false)} />
                  {rucStatus.loading && <p className="text-xs text-[#999999] mt-1">Verificando en SUNAT…</p>}
                  {rucStatus.valid === true && (
                    <p className="text-xs text-green-600 mt-1 font-600">✓ {rucStatus.razonSocial}</p>
                  )}
                  {!errors.ruc && rucStatus.valid === false && form.ruc.length === 11 && (
                    <p className="text-xs text-red-500 mt-1">✕ RUC no activo o no habido en SUNAT</p>
                  )}
                </Field>

                <Field label="Razón social" required error={errors.company}>
                  <input type="text" value={form.company} onChange={set("company")}
                    placeholder="Mi Empresa S.A.C." className={inputClass(!!errors.company)} autoComplete="organization" />
                </Field>
              </>
            )}

            <Field label="Código de referido" optional>
              <input type="text" value={form.referralCode} onChange={set("referralCode")}
                placeholder="Ej. FLUX-ABC1234" className={inputClass(false)} autoCapitalize="characters" />
            </Field>

            <div className="bg-[#F5F8FF] rounded-xl p-3 flex items-start gap-2 text-xs text-[#666666]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <p>Validaremos tu identidad (DNI + selfie) solo cuando quieras alquilar — toma ~2 minutos.</p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full mt-2 py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
              {loading ? (<><Spinner /> Creando cuenta…</>) : "Crear cuenta gratis"}
            </button>
          </form>

          <p className="text-xs text-[#999999] text-center mt-4 leading-relaxed">
            Al registrarte aceptas nuestros{" "}
            <Link href="/terminos" className="text-[#1B4FFF] hover:underline">Términos de servicio</Link>{" "}
            y{" "}
            <Link href="/privacidad" className="text-[#1B4FFF] hover:underline">Política de privacidad</Link>.
          </p>

          {isGoogleOAuthEnabled() && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#E5E5E5]" />
                <span className="text-xs text-[#999999]">o regístrate con</span>
                <div className="flex-1 h-px bg-[#E5E5E5]" />
              </div>
              <GoogleAuthButton redirect={redirect} label="Registrarse con Google" />
            </>
          )}
        </motion.div>

        <p className="text-center text-xs text-[#999999] mt-6">© 2026 FLUX — Tika Services S.A.C.</p>
      </div>
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
    hasError ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
  }`;
}

function Field({ label, required, optional, error, children }: { label: string; required?: boolean; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-600 text-[#333333] mb-1">
        {label} {required && <span className="text-[#1B4FFF]">*</span>}
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
