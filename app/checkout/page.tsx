"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useProduct } from "@/lib/use-products";
import type { Product } from "@/lib/products";
import { trackBeginCheckout } from "@/lib/analytics";

// ─── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ["Tu plan", "Tus datos", "Pago"];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 transition-all ${
                  done || active ? "bg-[#1B4FFF] text-white" : "bg-[#E5E5E5] text-[#999999]"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span className={`text-xs mt-1 font-600 ${active ? "text-[#1B4FFF]" : "text-[#999999]"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 mb-4 ${done ? "bg-[#1B4FFF]" : "bg-[#E5E5E5]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const APPLECARE_PRICE = 12;

// ─── Step 1 — Plan summary ─────────────────────────────────────────────────────
function Step1({
  product, months, appleCare, onAppleCare, quantity, onQuantity, onNext,
}: {
  product: Product; months: number; appleCare: boolean;
  onAppleCare: (v: boolean) => void; quantity: number;
  onQuantity: (v: number) => void; onNext: () => void;
}) {
  const router = useRouter();
  const plan = product.pricing.find((p) => p.months === months)!;
  const unitPrice = plan.price + (appleCare ? APPLECARE_PRICE : 0);
  const total = unitPrice * quantity;

  return (
    <div>
      <h2 className="text-2xl font-800 text-[#18191F] mb-6">Tu plan seleccionado</h2>

      <div className="bg-[#F7F7F7] rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[#E5E5E5]">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-3xl shadow-sm">
            💻
          </div>
          <div>
            <p className="font-700 text-[#18191F] text-lg">{product.name}</p>
            <p className="text-sm text-[#666666]">
              {product.chip} · {product.ram} · {product.ssd}
            </p>
          </div>
        </div>

        {/* Quantity selector */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#E5E5E5]">
          <span className="text-sm font-600 text-[#333333]">Cantidad de equipos</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-full border border-[#E5E5E5] flex items-center justify-center text-lg font-700 text-[#333333] hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer disabled:opacity-40"
              disabled={quantity <= 1}>−</button>
            <span className="w-8 text-center font-700 text-[#18191F]">{quantity}</span>
            <button type="button" onClick={() => onQuantity(Math.min(20, quantity + 1))}
              className="w-8 h-8 rounded-full border border-[#E5E5E5] flex items-center justify-center text-lg font-700 text-[#333333] hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer">+</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Plan elegido</span>
            <span className="font-700 text-[#18191F]">{months} meses</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Renta por equipo</span>
            <span className="font-700 text-[#18191F]">${plan.price}/mes</span>
          </div>
          {appleCare && (
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">AppleCare+ (×{quantity})</span>
              <span className="font-700 text-[#18191F]">+${APPLECARE_PRICE * quantity}/mes</span>
            </div>
          )}
          {quantity > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">Subtotal mensual</span>
              <span className="font-700 text-[#18191F]">${unitPrice * quantity}/mes</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Total del plan</span>
            <span className="font-700 text-[#18191F]">${total * months}</span>
          </div>
          <div className="border-t border-[#E5E5E5] pt-3 flex justify-between">
            <span className="font-700 text-[#333333]">Cobro hoy (1er mes)</span>
            <span className="text-xl font-800 text-[#1B4FFF]">${total}</span>
          </div>
        </div>
      </div>

      {/* AppleCare+ toggle */}
      <motion.button
        type="button"
        onClick={() => onAppleCare(!appleCare)}
        whileTap={{ scale: 0.98 }}
        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 mb-5 transition-all cursor-pointer text-left ${
          appleCare ? "border-[#1B4FFF] bg-[#EEF2FF]" : "border-[#E5E5E5] bg-white hover:border-[#BBCAFF]"
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${appleCare ? "bg-[#1B4FFF]/10" : "bg-[#F5F5F7]"}`}>
          🛡️
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-700 text-[#18191F] text-sm">Agregar AppleCare+</p>
            <span className="text-xs font-700 px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Recomendado</span>
          </div>
          <p className="text-xs text-[#666666] mt-0.5">Cobertura completa por daños accidentales · +${APPLECARE_PRICE}/mes</p>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          appleCare ? "border-[#1B4FFF] bg-[#1B4FFF]" : "border-[#CCCCCC]"
        }`}>
          {appleCare && <svg width="10" height="10" viewBox="0 0 12 12" fill="white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none"/></svg>}
        </div>
      </motion.button>

      <div className="bg-[#E5F3DF] rounded-2xl p-5 mb-6">
        <p className="font-700 text-[#2D7D46] mb-3">Incluido en tu renta</p>
        <ul className="space-y-2">
          {[
            "Entrega en tu empresa (Lima)",
            "Seguro contra robo y daños",
            "Soporte técnico incluido",
            "Sin deuda en tu historial crediticio",
            "Cancela con 30 días de aviso",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[#2D7D46]">
              <span className="font-700">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-lg hover:bg-[#1340CC] transition-colors cursor-pointer"
      >
        Continuar con mis datos
      </button>
      <button
        onClick={() => router.push(`/laptops/${product.slug}`)}
        className="w-full py-3 mt-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer"
      >
        Cambiar plan
      </button>
    </div>
  );
}

// ─── Step 2 — Customer data + delivery ────────────────────────────────────────
type CustomerData = {
  name: string;
  email: string;
  phone: string;
  company: string;
  ruc: string;
  customerType: "persona" | "empresa";
};

type DeliveryData = {
  method: "pickup" | "shipping";
  address: string;
  distrito: string;
  reference: string;
};

type IdentityData = {
  dniNumber: string;
  dniPhoto: string;   // base64 data URL
  selfiePhoto: string; // base64 data URL
};

const LIMA_DISTRITOS = [
  "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos",
  "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesús María",
  "La Molina", "La Victoria", "Lima Cercado", "Lince", "Los Olivos",
  "Lurigancho-Chosica", "Lurín", "Magdalena del Mar", "Miraflores",
  "Pachacámac", "Pueblo Libre", "Puente Piedra", "Punta Hermosa",
  "Punta Negra", "Rímac", "San Bartolo", "San Borja", "San Isidro",
  "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis",
  "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar",
  "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador",
  "Villa María del Triunfo",
];

// ─── Camera capture modal (getUserMedia) ─────────────────────────────────────
function CameraModal({
  facing,
  title,
  hint,
  onCapture,
  onCancel,
}: {
  facing: "user" | "environment";
  title: string;
  hint: string;
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Tu navegador no soporta cámara en web. Usa el botón 'Subir archivo' de abajo.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")) {
          setError("Permiso de cámara denegado. Habilítalo en los ajustes del navegador o usá 'Subir archivo'.");
        } else if (msg.includes("NotFound") || msg.includes("device")) {
          setError("No encontramos cámara en este dispositivo. Usá 'Subir archivo'.");
        } else {
          setError("No se pudo abrir la cámara. Usá 'Subir archivo'.");
        }
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `${facing === "user" ? "selfie" : "dni"}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.88,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-[#E5E5E5]">
          <h3 className="font-800 text-[#18191F] text-lg">{title}</h3>
          <p className="text-xs text-[#666666] mt-1">{hint}</p>
        </div>
        <div className="relative bg-black aspect-video">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-white text-sm">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                // El stream de getUserMedia viene en vivo, no necesita src
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin w-8 h-8 text-white" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={capture}
            disabled={!ready || !!error}
            className="flex-1 py-3 rounded-full bg-[#1B4FFF] text-white font-700 text-sm hover:bg-[#1340CC] transition-colors disabled:opacity-50 cursor-pointer"
          >
            📸 Capturar
          </button>
        </div>
      </div>
    </div>
  );
}

function Step2({
  onNext,
  onBack,
  data,
  onChange,
  delivery,
  onDeliveryChange,
  identity,
  onIdentityChange,
}: {
  onNext: () => void;
  onBack: () => void;
  data: CustomerData;
  onChange: (d: CustomerData) => void;
  delivery: DeliveryData;
  onDeliveryChange: (d: DeliveryData) => void;
  identity: IdentityData;
  onIdentityChange: (d: IdentityData) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rucStatus, setRucStatus] = useState<{ valid?: boolean; razonSocial?: string; loading?: boolean }>({});
  const [uploadingDni, setUploadingDni] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [cameraMode, setCameraMode] = useState<"dni" | "selfie" | null>(null);

  const verifyRuc = async (ruc: string) => {
    if (ruc.length !== 11) return;
    setRucStatus({ loading: true });
    try {
      const res = await fetch(`/api/verify-ruc?ruc=${ruc}`);
      const data = await res.json();
      setRucStatus({ valid: data.valid, razonSocial: data.razonSocial });
    } catch {
      setRucStatus({});
    }
  };

  const handleFileUpload = async (file: File, type: "dni" | "selfie") => {
    if (type === "dni") setUploadingDni(true);
    else setUploadingSelfie(true);
    // Limpiar errores previos
    setErrors((prev) => {
      const next = { ...prev };
      delete next[type === "dni" ? "dniPhoto" : "selfiePhoto"];
      return next;
    });

    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [type === "dni" ? "dniPhoto" : "selfiePhoto"]: data.error ?? "Error al subir",
        }));
      } else if (data.dataUrl) {
        if (type === "dni") onIdentityChange({ ...identity, dniPhoto: data.dataUrl });
        else onIdentityChange({ ...identity, selfiePhoto: data.dataUrl });
      } else {
        setErrors((prev) => ({
          ...prev,
          [type === "dni" ? "dniPhoto" : "selfiePhoto"]: "Respuesta inesperada del servidor",
        }));
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [type === "dni" ? "dniPhoto" : "selfiePhoto"]:
          err instanceof Error ? err.message : "Error de red al subir",
      }));
    }
    if (type === "dni") setUploadingDni(false);
    else setUploadingSelfie(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = "Requerido";
    if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Email inválido";
    if (!data.phone.trim()) e.phone = "Requerido";
    if (data.customerType === "empresa" && !data.company.trim()) e.company = "Requerido";
    if (!identity.dniNumber.trim() || !/^\d{8,12}$/.test(identity.dniNumber.trim())) e.dniNumber = "DNI o CE válido requerido (8-12 dígitos)";
    if (!identity.dniPhoto) e.dniPhoto = "Foto del DNI requerida";
    if (!identity.selfiePhoto) e.selfiePhoto = "Selfie con DNI requerida";
    if (delivery.method === "shipping") {
      if (!delivery.address.trim()) e.address = "Requerido";
      if (!delivery.distrito) e.distrito = "Selecciona un distrito";
    }
    if (!acceptedTerms) e.terms = "Debes aceptar los términos para continuar";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext();
  };

  return (
    <form onSubmit={handleSubmit}>
      {cameraMode && (
        <CameraModal
          facing={cameraMode === "selfie" ? "user" : "environment"}
          title={cameraMode === "selfie" ? "Selfie con DNI" : "Foto del DNI"}
          hint={
            cameraMode === "selfie"
              ? "Sostené tu DNI junto a tu cara. Asegurate de que ambos se vean claramente."
              : "Mostrá el lado frontal del DNI. Cuidado con reflejos o sombras."
          }
          onCapture={(file) => {
            setCameraMode(null);
            handleFileUpload(file, cameraMode);
          }}
          onCancel={() => setCameraMode(null)}
        />
      )}
      <h2 className="text-2xl font-800 text-[#18191F] mb-6">Tus datos</h2>

      {/* Customer type selector */}
      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={() => onChange({ ...data, customerType: "persona" })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-700 transition-all cursor-pointer ${
            data.customerType === "persona" ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]" : "border-[#E5E5E5] text-[#666666] hover:border-[#BBCAFF]"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Persona
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...data, customerType: "empresa" })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-700 transition-all cursor-pointer ${
            data.customerType === "empresa" ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]" : "border-[#E5E5E5] text-[#666666] hover:border-[#BBCAFF]"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>
          Empresa
        </button>
      </div>

      <div className="space-y-4">
        {/* Common fields */}
        <div>
          <label className="block text-sm font-600 text-[#333333] mb-1">
            Nombre completo <span className="text-[#1B4FFF]">*</span>
          </label>
          <input type="text" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Juan Pérez"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${errors.name ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"}`} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-600 text-[#333333] mb-1">
            Correo electrónico <span className="text-[#1B4FFF]">*</span>
          </label>
          <input type="email" value={data.email} onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder={data.customerType === "empresa" ? "juan@empresa.com" : "juan@gmail.com"}
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${errors.email ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"}`} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-600 text-[#333333] mb-1">
            Teléfono / WhatsApp <span className="text-[#1B4FFF]">*</span>
          </label>
          <input type="tel" value={data.phone} onChange={(e) => onChange({ ...data, phone: e.target.value })}
            placeholder="+51 999 000 000"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${errors.phone ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"}`} />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Empresa fields */}
        {data.customerType === "empresa" && (
          <>
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">
                Empresa <span className="text-[#1B4FFF]">*</span>
              </label>
              <input type="text" value={data.company} onChange={(e) => onChange({ ...data, company: e.target.value })}
                placeholder="Mi Empresa S.A.C."
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${errors.company ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"}`} />
              {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
            </div>
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">
                RUC <span className="text-[#1B4FFF]">*</span>
              </label>
              <div className="flex gap-2">
                <input type="text" value={data.ruc}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    onChange({ ...data, ruc: v });
                    if (v.length === 11) verifyRuc(v);
                    else setRucStatus({});
                  }}
                  placeholder="20123456789"
                  className={`flex-1 px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                    rucStatus.valid === false ? "border-red-400" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
                  }`} />
                {rucStatus.loading && <div className="flex items-center text-xs text-[#999999]">Verificando...</div>}
              </div>
              {rucStatus.valid === true && (
                <p className="text-xs text-green-600 mt-1 font-600">✓ {rucStatus.razonSocial} — ACTIVO/HABIDO</p>
              )}
              {rucStatus.valid === false && data.ruc.length === 11 && (
                <p className="text-xs text-red-500 mt-1">✕ RUC no activo o no habido en SUNAT</p>
              )}
            </div>
          </>
        )}

        {/* Persona — optional RUC for boleta */}
        {data.customerType === "persona" && (
          <div>
            <label className="block text-sm font-600 text-[#333333] mb-1">
              RUC <span className="text-[#999999] font-400">(opcional — solo si necesitas factura)</span>
            </label>
            <input type="text" value={data.ruc}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                onChange({ ...data, ruc: v });
                if (v.length === 11) verifyRuc(v);
                else setRucStatus({});
              }}
              placeholder="10123456789"
              className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all" />
            {rucStatus.valid === true && (
              <p className="text-xs text-green-600 mt-1 font-600">✓ {rucStatus.razonSocial}</p>
            )}
          </div>
        )}
      </div>

      {/* Identity verification — skip if already verified */}
      {identity.dniPhoto === "verified" && identity.selfiePhoto === "verified" ? (
        <div className="mt-8">
          <div className="bg-[#E5F3DF] rounded-2xl p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2D7D46] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div>
              <h3 className="text-base font-700 text-[#2D7D46]">Identidad verificada</h3>
              <p className="text-xs text-[#666666]">Tu DNI {identity.dniNumber} ya fue verificado anteriormente.</p>
            </div>
          </div>
        </div>
      ) : (
      <div className="mt-8">
        <div className="bg-[#F5F8FF] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#1B4FFF] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <h3 className="text-base font-700 text-[#18191F]">Verifica tu identidad</h3>
              <p className="text-xs text-[#666666]">3 pasos rápidos para proteger tu equipo</p>
            </div>
          </div>
          <p className="text-xs text-[#999999] leading-relaxed">Esto nos permite confirmar que eres tú. Tus documentos se guardan de forma segura y nunca se comparten con terceros.</p>
        </div>

        <div className="space-y-5">
          {/* Step 1 — DNI number */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 flex-shrink-0 ${
                identity.dniNumber.length >= 8 ? "bg-[#2D7D46] text-white" : "bg-[#E5E5E5] text-[#999999]"
              }`}>
                {identity.dniNumber.length >= 8 ? "✓" : "1"}
              </div>
              <div className="w-0.5 flex-1 bg-[#E5E5E5] mt-2" />
            </div>
            <div className="flex-1 pb-2">
              <p className="font-700 text-[#18191F] text-sm mb-1">Escribe tu número de DNI o CE</p>
              <p className="text-xs text-[#999999] mb-2">El mismo que aparece en tu documento de identidad</p>
              <input
                type="text"
                inputMode="numeric"
                value={identity.dniNumber}
                onChange={(e) => onIdentityChange({ ...identity, dniNumber: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                placeholder="Ej: 70123456"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  errors.dniNumber ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
                }`}
              />
              {errors.dniNumber && <p className="text-red-500 text-xs mt-1">{errors.dniNumber}</p>}
            </div>
          </div>

          {/* Step 2 — DNI photo */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 flex-shrink-0 ${
                identity.dniPhoto ? "bg-[#2D7D46] text-white" : "bg-[#E5E5E5] text-[#999999]"
              }`}>
                {identity.dniPhoto ? "✓" : "2"}
              </div>
              <div className="w-0.5 flex-1 bg-[#E5E5E5] mt-2" />
            </div>
            <div className="flex-1 pb-2">
              <p className="font-700 text-[#18191F] text-sm mb-1">Toma una foto de tu DNI</p>
              <p className="text-xs text-[#999999] mb-3">Solo el lado frontal, donde aparece tu foto y nombre</p>
              {identity.dniPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#2D7D46]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={identity.dniPhoto} alt="Tu DNI" className="w-full h-36 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <span className="bg-[#2D7D46] text-white text-[10px] font-700 px-2 py-1 rounded-full">Listo</span>
                    <button type="button" onClick={() => onIdentityChange({ ...identity, dniPhoto: "" })}
                      className="w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-black/70">✕</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setCameraMode("dni")}
                    disabled={uploadingDni}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      errors.dniPhoto ? "border-red-400 bg-red-50" : "border-[#1B4FFF] bg-[#F5F8FF] hover:bg-[#EEF2FF]"
                    }`}
                  >
                    <div className="w-12 h-12 bg-[#1B4FFF] rounded-xl flex items-center justify-center flex-shrink-0 text-white">
                      {uploadingDni ? (
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-700 text-[#1B4FFF]">{uploadingDni ? "Subiendo..." : "Abrir cámara"}</p>
                      <p className="text-xs text-[#666666]">Captura tu DNI con la cámara</p>
                    </div>
                  </button>
                  <label className="w-full block text-center text-xs text-[#999999] hover:text-[#1B4FFF] underline cursor-pointer">
                    <input type="file" accept="image/*,.heic,.heif" className="sr-only" disabled={uploadingDni}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "dni"); }} />
                    o subir archivo desde tu dispositivo
                  </label>
                </div>
              )}
              {errors.dniPhoto && <p className="text-red-500 text-xs mt-1">{errors.dniPhoto}</p>}
            </div>
          </div>

          {/* Step 3 — Selfie */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 flex-shrink-0 ${
                identity.selfiePhoto ? "bg-[#2D7D46] text-white" : "bg-[#E5E5E5] text-[#999999]"
              }`}>
                {identity.selfiePhoto ? "✓" : "3"}
              </div>
            </div>
            <div className="flex-1">
              <p className="font-700 text-[#18191F] text-sm mb-1">Tomate una selfie con tu DNI</p>
              <p className="text-xs text-[#999999] mb-3">Sostiene tu DNI junto a tu cara. Así confirmamos que eres el titular.</p>
              {identity.selfiePhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#2D7D46]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={identity.selfiePhoto} alt="Tu selfie" className="w-full h-36 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <span className="bg-[#2D7D46] text-white text-[10px] font-700 px-2 py-1 rounded-full">Listo</span>
                    <button type="button" onClick={() => onIdentityChange({ ...identity, selfiePhoto: "" })}
                      className="w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-black/70">✕</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setCameraMode("selfie")}
                    disabled={uploadingSelfie}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      errors.selfiePhoto ? "border-red-400 bg-red-50" : "border-[#1B4FFF] bg-[#F5F8FF] hover:bg-[#EEF2FF]"
                    }`}
                  >
                    <div className="w-12 h-12 bg-[#1B4FFF] rounded-xl flex items-center justify-center flex-shrink-0 text-white">
                      {uploadingSelfie ? (
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="10" r="4"/><path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8"/></svg>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-700 text-[#1B4FFF]">{uploadingSelfie ? "Subiendo..." : "Abrir cámara frontal"}</p>
                      <p className="text-xs text-[#666666]">Tu cara + tu DNI en la misma foto</p>
                    </div>
                  </button>
                  <label className="w-full block text-center text-xs text-[#999999] hover:text-[#1B4FFF] underline cursor-pointer">
                    <input type="file" accept="image/*,.heic,.heif" className="sr-only" disabled={uploadingSelfie}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "selfie"); }} />
                    o subir archivo desde tu dispositivo
                  </label>
                </div>
              )}
              {errors.selfiePhoto && <p className="text-red-500 text-xs mt-1">{errors.selfiePhoto}</p>}
            </div>
          </div>
        </div>

        {/* All 3 complete */}
        {identity.dniNumber.length >= 8 && identity.dniPhoto && identity.selfiePhoto && identity.dniPhoto !== "verified" && (
          <div className="mt-4 bg-[#E5F3DF] rounded-xl p-3 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <p className="text-sm font-600 text-[#2D7D46]">Identidad verificada. ¡Ya casi terminas!</p>
          </div>
        )}
      </div>
      )}

      {/* Delivery method */}
      <div className="mt-6">
        <h3 className="text-base font-700 text-[#18191F] mb-3">¿Cómo quieres recibir tu Mac?</h3>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onDeliveryChange({ ...delivery, method: "pickup" })}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
              delivery.method === "pickup" ? "border-[#1B4FFF] bg-[#EEF2FF]" : "border-[#E5E5E5] hover:border-[#BBCAFF]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
              delivery.method === "pickup" ? "bg-[#1B4FFF]/10" : "bg-[#F5F5F7]"
            }`}>🏢</div>
            <div className="flex-1">
              <p className="font-700 text-[#18191F] text-sm">Recojo en oficina</p>
              <p className="text-xs text-[#666666] mt-0.5">Disponible en 24h · Lima, Perú</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              delivery.method === "pickup" ? "border-[#1B4FFF]" : "border-[#CCCCCC]"
            }`}>
              {delivery.method === "pickup" && <div className="w-2.5 h-2.5 rounded-full bg-[#1B4FFF]" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onDeliveryChange({ ...delivery, method: "shipping" })}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
              delivery.method === "shipping" ? "border-[#1B4FFF] bg-[#EEF2FF]" : "border-[#E5E5E5] hover:border-[#BBCAFF]"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
              delivery.method === "shipping" ? "bg-[#1B4FFF]/10" : "bg-[#F5F5F7]"
            }`}>🚚</div>
            <div className="flex-1">
              <p className="font-700 text-[#18191F] text-sm">Envío gratis a domicilio</p>
              <p className="text-xs text-[#666666] mt-0.5">24-48h hábiles · Solo Lima Metropolitana</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              delivery.method === "shipping" ? "border-[#1B4FFF]" : "border-[#CCCCCC]"
            }`}>
              {delivery.method === "shipping" && <div className="w-2.5 h-2.5 rounded-full bg-[#1B4FFF]" />}
            </div>
          </button>
        </div>

        {/* Shipping address fields */}
        {delivery.method === "shipping" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-3"
          >
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">
                Distrito <span className="text-[#1B4FFF]">*</span>
              </label>
              <select
                value={delivery.distrito}
                onChange={(e) => onDeliveryChange({ ...delivery, distrito: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all bg-white ${
                  errors.distrito
                    ? "border-red-400 bg-red-50"
                    : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
                }`}
              >
                <option value="">Selecciona tu distrito</option>
                {LIMA_DISTRITOS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {errors.distrito && <p className="text-red-500 text-xs mt-1">{errors.distrito}</p>}
            </div>
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">
                Dirección <span className="text-[#1B4FFF]">*</span>
              </label>
              <input
                type="text"
                value={delivery.address}
                onChange={(e) => onDeliveryChange({ ...delivery, address: e.target.value })}
                placeholder="Av. Javier Prado 1234, Oficina 501"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  errors.address
                    ? "border-red-400 bg-red-50"
                    : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
                }`}
              />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
            </div>
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">
                Referencia <span className="text-[#999999] font-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={delivery.reference}
                onChange={(e) => onDeliveryChange({ ...delivery, reference: e.target.value })}
                placeholder="Edificio Torre Azul, piso 5, preguntar por recepción"
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all"
              />
            </div>
          </motion.div>
        )}

        {/* Pickup info */}
        {delivery.method === "pickup" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="mt-4 bg-[#F7F7F7] rounded-xl p-4"
          >
            <p className="text-sm font-600 text-[#333333] mb-1">📍 Dirección de recojo</p>
            <p className="text-sm text-[#666666]">Te enviaremos la dirección y horario por email una vez confirmado el pago.</p>
            <p className="text-xs text-[#999999] mt-2">Lunes a viernes · 9am – 6pm</p>
          </motion.div>
        )}
      </div>

      <p className="text-xs text-[#999999] mt-4">
        Tus datos solo se usan para coordinar la entrega y facturación. No los compartimos con terceros.
      </p>

      {/* Terms acceptance */}
      <div className="mt-5">
        <label className={`flex items-start gap-3 cursor-pointer select-none ${errors.terms ? "text-red-500" : "text-[#333333]"}`}>
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) setErrors(prev => { const next = { ...prev }; delete next.terms; return next; });
              }}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              acceptedTerms ? "bg-[#1B4FFF] border-[#1B4FFF]" : errors.terms ? "border-red-400" : "border-[#CCCCCC]"
            }`}>
              {acceptedTerms && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm leading-relaxed">
            He leído y acepto los{" "}
            <a href="/terminos" target="_blank" rel="noreferrer" className="text-[#1B4FFF] hover:underline font-600">
              Términos y Condiciones
            </a>
            {" "}y la{" "}
            <a href="/privacidad" target="_blank" rel="noreferrer" className="text-[#1B4FFF] hover:underline font-600">
              Política de Privacidad
            </a>
            {" "}de FLUX — Tika Services S.A.C.
          </span>
        </label>
        {errors.terms && <p className="text-red-500 text-xs mt-2">{errors.terms}</p>}
      </div>

      <button
        type="submit"
        className="w-full mt-6 py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-lg hover:bg-[#1340CC] transition-colors cursor-pointer"
      >
        Continuar al pago
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 mt-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer"
      >
        Volver
      </button>
    </form>
  );
}

// ─── Step 3 — Redirect to Stripe Checkout ─────────────────────────────────────
function PaymentForm({
  product,
  months,
  appleCare,
  quantity,
  customer,
  delivery,
  identity,
  onBack,
}: {
  product: Product;
  months: number;
  appleCare: boolean;
  quantity: number;
  customer: CustomerData;
  delivery: DeliveryData;
  identity: IdentityData;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const plan = product.pricing.find((p) => p.months === months)!;
  const totalMonthly = (plan.price + (appleCare ? APPLECARE_PRICE : 0)) * quantity;

  const pay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: product.slug,
          months,
          appleCare,
          quantity,
          customer,
          delivery,
          identity: {
            dniNumber: identity.dniNumber,
            dniPhoto: identity.dniPhoto,
            selfiePhoto: identity.selfiePhoto,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Error al procesar el pago");
        setLoading(false);
        return;
      }
      // Redirect a Stripe Checkout — Stripe aloja la página de pago.
      // trackPurchase se dispara en /checkout/success cuando Stripe redirige de vuelta.
      window.location.href = data.url;
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-800 text-[#18191F] mb-2">Pago seguro</h2>
      <p className="text-sm text-[#666666] mb-6">
        Se cobrará <strong className="text-[#18191F]">${totalMonthly} USD</strong> hoy por el primer mes.
        Los siguientes meses se cobran automáticamente.
      </p>

      {/* Order summary mini */}
      <div className="bg-[#EEF2FF] rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="text-sm">
            <p className="font-700 text-[#18191F]">{product.shortName}{quantity > 1 ? ` ×${quantity}` : ""}</p>
            <p className="text-[#666666]">{months} meses · ${plan.price}/mes</p>
          </div>
          <p className="text-lg font-800 text-[#1B4FFF]">${plan.price * quantity}</p>
        </div>
        {appleCare && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#DDEAFF]">
            <p className="text-sm text-[#666666]">🛡️ AppleCare+</p>
            <p className="text-sm font-700 text-[#18191F]">+${APPLECARE_PRICE}</p>
          </div>
        )}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#DDEAFF]">
          <p className="text-sm font-700 text-[#333333]">Cobro hoy</p>
          <p className="text-xl font-800 text-[#1B4FFF]">${totalMonthly}</p>
        </div>
      </div>

      <motion.button
        onClick={pay}
        disabled={loading}
        whileTap={!loading ? { scaleX: 1.06, scaleY: 0.91 } : {}}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-lg hover:bg-[#1340CC] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 mb-4"
      >
        {loading ? (
          <><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/></svg>Redirigiendo a Stripe…</>
        ) : (
          <>Pagar ${totalMonthly} USD</>
        )}
      </motion.button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-3 mb-4 text-xs text-[#999999]">
        <span>🔒</span>
        <span>Pago seguro con cifrado SSL — procesado por Stripe</span>
      </div>

      <button
        onClick={onBack}
        disabled={loading}
        className="w-full py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer disabled:opacity-50"
      >
        Volver
      </button>
    </div>
  );
}

// ─── Main checkout wrapper ─────────────────────────────────────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = searchParams.get("slug") ?? "";
  const months = parseInt(searchParams.get("months") ?? "8", 10);
  const { product } = useProduct(slug);

  const [step, setStep] = useState(1);
  const [appleCare, setAppleCare] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = loading
  const [customer, setCustomer] = useState<CustomerData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    ruc: "",
    customerType: "persona",
  });
  const [delivery, setDelivery] = useState<DeliveryData>({
    method: "shipping",
    address: "",
    distrito: "",
    reference: "",
  });
  const [identity, setIdentity] = useState<IdentityData>({
    dniNumber: "",
    dniPhoto: "",
    selfiePhoto: "",
  });

  useEffect(() => {
    // Check login + pre-fill all data
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setIsLoggedIn(true);
          const u = data.user;
          setCustomer(prev => ({
            name: prev.name || u.name || "",
            email: prev.email || u.email || "",
            phone: prev.phone || u.phone || "",
            company: prev.company || u.company || "",
            ruc: prev.ruc || u.ruc || "",
            customerType: u.company ? "empresa" : prev.customerType,
          }));
          if (u.dni_number) {
            setIdentity(prev => ({
              ...prev,
              dniNumber: prev.dniNumber || u.dni_number || "",
              // If already verified, mark photos as done so we skip the upload
              ...(u.identity_verified ? { dniPhoto: "verified", selfiePhoto: "verified" } : {}),
            }));
          }
        } else {
          setIsLoggedIn(false);
        }
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-700 text-[#333333] mb-4">Producto no encontrado</p>
          <a href="/laptops" className="text-[#1B4FFF] font-600">
            Ver todos los MacBooks
          </a>
        </div>
      </div>
    );
  }

  const plan = product.pricing.find((p) => p.months === months);
  if (!plan) {
    router.push("/laptops");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10">
      <div className="max-w-lg mx-auto px-4">
        {/* Logo */}
        <a href="/" className="block text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="Flux" className="h-10 mx-auto" />
        </a>

        <Steps current={step === 1.5 ? 2 : step} />

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-3xl p-8 shadow-sm"
        >
          {step === 1 && <Step1 product={product} months={months} appleCare={appleCare} onAppleCare={setAppleCare} quantity={quantity} onQuantity={setQuantity} onNext={() => {
            trackBeginCheckout({ name: product.name, slug: product.slug, price: plan.price, months, quantity });
            setStep(2);
          }} />}

          {/* Login banner for guests in step 2 */}
          {step === 2 && isLoggedIn === false && (
            <div className="bg-[#EEF2FF] rounded-xl p-4 mb-5 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1B4FFF] rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#333333]">
                  <strong>¿Ya tienes cuenta?</strong>{" "}
                  <a href={`/auth/login?redirect=${encodeURIComponent(`/checkout?slug=${slug}&months=${months}`)}`}
                    className="text-[#1B4FFF] font-600 hover:underline">Inicia sesión</a> para llenar tus datos automáticamente.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <Step2
              data={customer}
              onChange={setCustomer}
              delivery={delivery}
              onDeliveryChange={setDelivery}
              identity={identity}
              onIdentityChange={setIdentity}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <PaymentForm
              product={product}
              months={months}
              appleCare={appleCare}
              quantity={quantity}
              customer={customer}
              delivery={delivery}
              identity={identity}
              onBack={() => setStep(2)}
            />
          )}
        </motion.div>

        <p className="text-center text-xs text-[#999999] mt-6">
          © 2026 FLUX — Tika Services S.A.C.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
          <div className="text-[#666666] font-600">Cargando…</div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
