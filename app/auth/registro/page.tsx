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
  const [identity, setIdentity] = useState({
    dniNumber: "",
    dniPhoto: "",
    selfiePhoto: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rucStatus, setRucStatus] = useState<{ valid?: boolean; razonSocial?: string; loading?: boolean }>({});
  const [uploadingDni, setUploadingDni] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

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

  const handleFileUpload = async (file: File, type: "dni" | "selfie") => {
    if (type === "dni") setUploadingDni(true); else setUploadingSelfie(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.dataUrl) {
        if (type === "dni") setIdentity(p => ({ ...p, dniPhoto: data.dataUrl }));
        else setIdentity(p => ({ ...p, selfiePhoto: data.dataUrl }));
      }
    } catch { /* */ }
    if (type === "dni") setUploadingDni(false); else setUploadingSelfie(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Requerido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    if (form.password.length < 8) e.password = "Mínimo 8 caracteres";
    if (!form.phone.trim()) e.phone = "Requerido";
    if (customerType === "empresa") {
      if (!form.company.trim()) e.company = "Requerido";
      if (!form.ruc.trim() || form.ruc.length !== 11) e.ruc = "RUC válido requerido";
    }
    if (!identity.dniNumber.trim() || !/^\d{8,12}$/.test(identity.dniNumber.trim())) e.dniNumber = "DNI o CE válido (8-12 dígitos)";
    if (!identity.dniPhoto) e.dniPhoto = "Foto del DNI requerida";
    if (!identity.selfiePhoto) e.selfiePhoto = "Selfie con DNI requerida";
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
        body: JSON.stringify({
          ...form,
          customerType,
          dniNumber: identity.dniNumber,
          dniPhoto: identity.dniPhoto,
          selfiePhoto: identity.selfiePhoto,
        }),
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
            <button type="button" onClick={() => setCustomerType("persona")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-700 transition-all cursor-pointer ${
                customerType === "persona" ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]" : "border-[#E5E5E5] text-[#666666] hover:border-[#BBCAFF]"
              }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Persona
            </button>
            <button type="button" onClick={() => setCustomerType("empresa")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-700 transition-all cursor-pointer ${
                customerType === "empresa" ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]" : "border-[#E5E5E5] text-[#666666] hover:border-[#BBCAFF]"
              }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>
              Empresa
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nombre completo" required error={errors.name}>
              <input type="text" value={form.name} onChange={set("name")}
                placeholder="Juan Pérez" className={inputClass(!!errors.name)} />
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333]">
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </Field>

            <Field label="Teléfono / WhatsApp" required error={errors.phone}>
              <input type="tel" value={form.phone} onChange={set("phone")}
                placeholder="+51 999 000 000" className={inputClass(!!errors.phone)} />
            </Field>

            {customerType === "empresa" && (
              <>
                <Field label="RUC" required error={errors.ruc}>
                  <input type="text" value={form.ruc}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setForm(f => ({ ...f, ruc: v }));
                      if (v.length === 11) verifyRuc(v);
                      else setRucStatus({});
                    }}
                    placeholder="20123456789" className={inputClass(!!errors.ruc || rucStatus.valid === false)} />
                  {rucStatus.valid === true && (
                    <p className="text-xs text-green-600 mt-1 font-600">✓ {rucStatus.razonSocial}</p>
                  )}
                  {rucStatus.valid === false && form.ruc.length === 11 && (
                    <p className="text-xs text-red-500 mt-1">✕ RUC no válido en SUNAT</p>
                  )}
                </Field>

                <Field label="Empresa" required error={errors.company}>
                  <input type="text" value={form.company} onChange={set("company")}
                    placeholder="Mi Empresa S.A.C." className={inputClass(!!errors.company)} />
                </Field>
              </>
            )}

            {/* Identity verification */}
            <div className="bg-[#F5F8FF] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <h3 className="text-sm font-700 text-[#18191F]">Verificación de identidad</h3>
              </div>
              <p className="text-xs text-[#666666]">3 datos para confirmar que eres tú. Tu información se guarda de forma segura.</p>
            </div>

            <Field label="N° de DNI o Carnet de Extranjería" required error={errors.dniNumber}>
              <input type="text" inputMode="numeric" value={identity.dniNumber}
                onChange={(e) => setIdentity(p => ({ ...p, dniNumber: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                placeholder="Ej: 70123456" className={inputClass(!!errors.dniNumber)} />
            </Field>

            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">Foto del DNI (frente) <span className="text-[#1B4FFF]">*</span></label>
              {identity.dniPhoto ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-[#2D7D46]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={identity.dniPhoto} alt="DNI" className="w-full h-32 object-cover" />
                  <button type="button" onClick={() => setIdentity(p => ({ ...p, dniPhoto: "" }))}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full text-xs cursor-pointer">✕</button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${errors.dniPhoto ? "border-red-400 bg-red-50" : "border-[#CCCCCC] hover:border-[#1B4FFF] hover:bg-[#F5F8FF]"}`}>
                  <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploadingDni}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "dni"); }} />
                  <div className="w-10 h-10 bg-[#F0F0F0] rounded-lg flex items-center justify-center flex-shrink-0">
                    {uploadingDni ? <svg className="animate-spin w-4 h-4 text-[#1B4FFF]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="9" cy="11" r="2.5"/></svg>}
                  </div>
                  <div>
                    <p className="text-sm font-600 text-[#333333]">{uploadingDni ? "Subiendo..." : "Subir foto del DNI"}</p>
                    <p className="text-xs text-[#999999]">Toca para abrir cámara</p>
                  </div>
                </label>
              )}
              {errors.dniPhoto && <p className="text-red-500 text-xs mt-1">{errors.dniPhoto}</p>}
            </div>

            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">Selfie con tu DNI <span className="text-[#1B4FFF]">*</span></label>
              <p className="text-xs text-[#999999] mb-2">Tu cara junto a tu DNI en la misma foto</p>
              {identity.selfiePhoto ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-[#2D7D46]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={identity.selfiePhoto} alt="Selfie" className="w-full h-32 object-cover" />
                  <button type="button" onClick={() => setIdentity(p => ({ ...p, selfiePhoto: "" }))}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full text-xs cursor-pointer">✕</button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${errors.selfiePhoto ? "border-red-400 bg-red-50" : "border-[#CCCCCC] hover:border-[#1B4FFF] hover:bg-[#F5F8FF]"}`}>
                  <input type="file" accept="image/*" capture="user" className="sr-only" disabled={uploadingSelfie}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "selfie"); }} />
                  <div className="w-10 h-10 bg-[#F0F0F0] rounded-lg flex items-center justify-center flex-shrink-0">
                    {uploadingSelfie ? <svg className="animate-spin w-4 h-4 text-[#1B4FFF]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><circle cx="12" cy="10" r="4"/><path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8"/></svg>}
                  </div>
                  <div>
                    <p className="text-sm font-600 text-[#333333]">{uploadingSelfie ? "Subiendo..." : "Tomar selfie con DNI"}</p>
                    <p className="text-xs text-[#999999]">Cámara frontal</p>
                  </div>
                </label>
              )}
              {errors.selfiePhoto && <p className="text-red-500 text-xs mt-1">{errors.selfiePhoto}</p>}
            </div>

            <Field label="Código de referido" optional>
              <input type="text" value={form.referralCode} onChange={set("referralCode")}
                placeholder="Ej. FLUX-ABC1234" className={inputClass(false)} autoCapitalize="characters" />
            </Field>

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
