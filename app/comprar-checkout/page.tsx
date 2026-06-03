"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AddressAutocomplete from "@/components/checkout/AddressAutocomplete";
import PhoneInput from "@/components/PhoneInput";
import { quoteShipping } from "@/lib/shipping/lima-rates";
import type { SaleEquipment } from "@/app/api/sale-equipment/route";

// ─── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ["Equipo", "Tus datos", "Pago"];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 transition-all ${done || active ? "bg-[#1B4FFF] text-white" : "bg-[#E5E5E5] text-[#999999]"}`}>
                {done ? "✓" : n}
              </div>
              <span className={`text-xs mt-1 font-600 ${active ? "text-[#1B4FFF]" : "text-[#999999]"}`}>{label}</span>
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

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  company: string;
  ruc: string;
  customerType: "persona" | "empresa";
}

interface DeliveryData {
  method: "pickup" | "shipping";
  address: string;
  street: string;
  streetNumber: string;
  distrito: string;
  reference: string;
  placeType: "casa" | "depto" | "edificio" | "";
  apartment: string;
  floor: string;
  lat?: number;
  lng?: number;
  shippingCost?: number;
  shippingFree?: boolean;
}

// ─── Step 1 — Resumen del equipo ───────────────────────────────────────────────
function Step1({ equipment, onNext }: { equipment: SaleEquipment; onNext: () => void }) {
  return (
    <div>
      <h2 className="text-2xl font-800 text-[#18191F] mb-6">Tu FLUX Certified</h2>

      <div className="bg-[#F7F7F7] rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[#E5E5E5]">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
            {equipment.image_url
              ? <img src={equipment.image_url} alt={equipment.modelo_completo} className="w-full h-full object-contain p-1" />
              : <span className="text-3xl">💻</span>
            }
          </div>
          <div>
            <p className="font-700 text-[#18191F] text-lg">{equipment.modelo_completo}</p>
            <p className="text-sm text-[#666666]">
              {[equipment.chip, equipment.ram, equipment.ssd].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {equipment.chip && (
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">Chip</span>
              <span className="font-700 text-[#18191F]">{equipment.chip}</span>
            </div>
          )}
          {equipment.ram && (
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">Memoria RAM</span>
              <span className="font-700 text-[#18191F]">{equipment.ram}</span>
            </div>
          )}
          {equipment.ssd && (
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">Almacenamiento</span>
              <span className="font-700 text-[#18191F]">{equipment.ssd}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Certificación</span>
            <span className="font-700 text-[#1B4FFF]">FLUX Certified · {equipment.sale_condition}</span>
          </div>
        </div>

        <div className="border-t border-[#E5E5E5] pt-4 mt-4 flex justify-between items-center">
          <span className="font-700 text-[#333333]">Precio</span>
          <span className="text-2xl font-900 text-[#1B4FFF]">
            ${equipment.sale_price_usd.toLocaleString("en-US")} USD
          </span>
        </div>
      </div>

      <div className="bg-[#EEF2FF] rounded-xl p-4 mb-6 text-sm text-[#333333]">
        <p className="font-700 mb-1">Incluye:</p>
        <ul className="space-y-1 text-[#666666]">
          <li>✅ 15 puntos revisados y formateado</li>
          <li>✅ 90 días de garantía incluida</li>
          <li>✅ Despacho Lima en 24h hábiles</li>
          <li>✅ Factura de venta</li>
        </ul>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors cursor-pointer"
      >
        Continuar con mis datos →
      </button>

      <a href="/comprar" className="block text-center mt-3 text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">
        ← Volver al catálogo
      </a>
    </div>
  );
}

// ─── Step 2 — Datos del cliente + entrega ──────────────────────────────────────
function Step2({
  onNext, onBack, data, onChange, delivery, onDeliveryChange,
}: {
  onNext: () => void;
  onBack: () => void;
  data: CustomerData;
  onChange: (d: CustomerData) => void;
  delivery: DeliveryData;
  onDeliveryChange: (d: DeliveryData) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const set = (field: keyof CustomerData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...data, [field]: e.target.value });

  const setDelivery = (field: keyof DeliveryData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onDeliveryChange({ ...delivery, [field]: e.target.value });

  const updateDelivery = (partial: Partial<DeliveryData>) =>
    onDeliveryChange({ ...delivery, ...partial });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = "Requerido";
    if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Email inválido";
    if (!/^\+\d{7,15}$/.test(data.phone.trim())) e.phone = "Número inválido con código de país";
    if (data.customerType === "empresa") {
      if (!data.company.trim()) e.company = "Razón social requerida";
      const ruc = data.ruc.trim();
      if (!/^\d{11}$/.test(ruc) || !/^(10|15|17|20)/.test(ruc)) {
        e.ruc = "RUC inválido (11 dígitos, empieza con 10/15/17/20)";
      }
    }
    if (delivery.method === "shipping") {
      if (!delivery.street.trim()) e.address = "Ingresa la calle";
      if (!delivery.streetNumber.trim()) e.streetNumber = "Ingresa el número";
      if (!delivery.placeType) e.placeType = "Indica si es casa, depto u oficina";
      if (
        (delivery.placeType === "depto" || delivery.placeType === "edificio") &&
        !delivery.apartment.trim()
      ) {
        e.apartment = "Requerido";
      }
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
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-2xl font-800 text-[#18191F] mb-6">Tus datos</h2>

      {/* Tipo de cliente */}
      <div className="flex gap-3 mb-5">
        {(["persona", "empresa"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...data, customerType: t })}
            className={`flex-1 py-2.5 rounded-full text-sm font-700 border-2 transition-all cursor-pointer ${
              data.customerType === t
                ? "bg-[#1B4FFF] text-white border-[#1B4FFF]"
                : "bg-white text-[#666666] border-[#E5E5E5] hover:border-[#1B4FFF]"
            }`}
          >
            {t === "persona" ? "Persona natural" : "Empresa"}
          </button>
        ))}
      </div>

      {/* Nombre */}
      <div className="mb-4">
        <label className="block text-sm font-600 text-[#333333] mb-1">
          {data.customerType === "empresa" ? "Nombre del contacto" : "Nombre completo"}
        </label>
        <input
          type="text"
          value={data.name}
          onChange={set("name")}
          placeholder="Juan Pérez"
          className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors ${errors.name ? "border-red-400" : "border-[#E5E5E5]"}`}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Empresa */}
      {data.customerType === "empresa" && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-600 text-[#333333] mb-1">Razón social</label>
            <input
              type="text"
              value={data.company}
              onChange={set("company")}
              placeholder="Mi Empresa S.A.C."
              className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors ${errors.company ? "border-red-400" : "border-[#E5E5E5]"}`}
            />
            {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-600 text-[#333333] mb-1">RUC</label>
            <input
              type="text"
              value={data.ruc}
              onChange={set("ruc")}
              maxLength={11}
              placeholder="20123456789"
              className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors font-mono ${errors.ruc ? "border-red-400" : "border-[#E5E5E5]"}`}
            />
            {errors.ruc && <p className="text-xs text-red-500 mt-1">{errors.ruc}</p>}
          </div>
        </>
      )}

      {/* Email */}
      <div className="mb-4">
        <label className="block text-sm font-600 text-[#333333] mb-1">Email</label>
        <input
          type="email"
          value={data.email}
          onChange={set("email")}
          placeholder="correo@ejemplo.com"
          className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors ${errors.email ? "border-red-400" : "border-[#E5E5E5]"}`}
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>

      {/* Teléfono */}
      <div className="mb-6">
        <label className="block text-sm font-600 text-[#333333] mb-1">Teléfono</label>
        <PhoneInput
          value={data.phone}
          onChange={(v) => onChange({ ...data, phone: v })}
          error={!!errors.phone}
        />
        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
      </div>

      {/* Entrega */}
      <div className="mb-6">
        <p className="text-sm font-700 text-[#333333] mb-3">¿Cómo quieres recibirlo?</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(["pickup", "shipping"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => updateDelivery({ method: m })}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-600 transition-all cursor-pointer text-left ${
                delivery.method === m
                  ? "border-[#1B4FFF] bg-[#EEF2FF] text-[#1B4FFF]"
                  : "border-[#E5E5E5] text-[#666666] hover:border-[#1B4FFF]"
              }`}
            >
              {m === "pickup" ? (
                <><p className="font-700">🏢 Recoger</p><p className="text-xs mt-0.5 opacity-75">Av. Primavera, Surco</p></>
              ) : (
                <><p className="font-700">🛵 Envío</p><p className="text-xs mt-0.5 opacity-75">Lima 24-48h hábiles</p></>
              )}
            </button>
          ))}
        </div>

        {delivery.method === "shipping" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">Calle</label>
              <AddressAutocomplete
                value={delivery.street}
                onChange={(v) => updateDelivery({ street: v })}
                onSelect={(s) => {
                  const quote = quoteShipping({ distrito: s.distrito, lat: s.lat, lng: s.lng });
                  updateDelivery({
                    street: s.short,
                    address: s.display,
                    distrito: s.distrito,
                    lat: s.lat,
                    lng: s.lng,
                    shippingCost: quote.cost,
                    shippingFree: quote.is_free,
                  });
                }}
                error={!!errors.address}
                placeholder="Ej: Av. Javier Prado Este"
              />
              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-600 text-[#333333] mb-1">Número</label>
                <input
                  type="text"
                  value={delivery.streetNumber}
                  onChange={setDelivery("streetNumber")}
                  placeholder="265"
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors ${errors.streetNumber ? "border-red-400" : "border-[#E5E5E5]"}`}
                />
                {errors.streetNumber && <p className="text-xs text-red-500 mt-1">{errors.streetNumber}</p>}
              </div>
              <div>
                <label className="block text-sm font-600 text-[#333333] mb-1">Tipo</label>
                <select
                  value={delivery.placeType}
                  onChange={setDelivery("placeType")}
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] bg-white transition-colors ${errors.placeType ? "border-red-400" : "border-[#E5E5E5]"}`}
                >
                  <option value="">Selecciona</option>
                  <option value="casa">Casa</option>
                  <option value="depto">Departamento</option>
                  <option value="edificio">Oficina / Edificio</option>
                </select>
                {errors.placeType && <p className="text-xs text-red-500 mt-1">{errors.placeType}</p>}
              </div>
            </div>

            {(delivery.placeType === "depto" || delivery.placeType === "edificio") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-600 text-[#333333] mb-1">
                    {delivery.placeType === "depto" ? "Depto / Piso" : "Oficina / Piso"}
                  </label>
                  <input
                    type="text"
                    value={delivery.apartment}
                    onChange={setDelivery("apartment")}
                    placeholder="301"
                    className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors ${errors.apartment ? "border-red-400" : "border-[#E5E5E5]"}`}
                  />
                  {errors.apartment && <p className="text-xs text-red-500 mt-1">{errors.apartment}</p>}
                </div>
                <div>
                  <label className="block text-sm font-600 text-[#333333] mb-1">Piso</label>
                  <input
                    type="text"
                    value={delivery.floor}
                    onChange={setDelivery("floor")}
                    placeholder="3"
                    className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-600 text-[#333333] mb-1">Referencia (opcional)</label>
              <input
                type="text"
                value={delivery.reference}
                onChange={setDelivery("reference")}
                placeholder="Puerta azul, al lado del parque"
                className="w-full px-4 py-3 border border-[#E5E5E5] rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors"
              />
            </div>

            {typeof delivery.shippingCost === "number" && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${delivery.shippingFree ? "bg-[#E5F3DF] text-[#2D7D46]" : "bg-[#F7F7F7] text-[#666666]"}`}>
                <span>{delivery.shippingFree ? "✅" : "🛵"}</span>
                <span>
                  {delivery.shippingFree
                    ? "Envío gratis"
                    : `Envío: S/ ${delivery.shippingCost} — se cobra contra entrega`}
                  {delivery.distrito && ` · ${delivery.distrito}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* T&C */}
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#1B4FFF] flex-shrink-0 cursor-pointer"
          />
          <span className="text-sm text-[#666666]">
            Acepto los{" "}
            <a href="/terminos" target="_blank" className="text-[#1B4FFF] underline">
              Términos y Condiciones
            </a>{" "}
            de FLUX para la compra de equipos certificados.
          </span>
        </label>
        {errors.terms && <p className="text-xs text-red-500 mt-1 ml-7">{errors.terms}</p>}
      </div>

      <button
        type="submit"
        className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors cursor-pointer"
      >
        Continuar al pago →
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

// ─── Step 3 — Confirmar y pagar ────────────────────────────────────────────────
function Step3({
  equipment, customer, delivery, onBack,
}: {
  equipment: SaleEquipment;
  customer: CustomerData;
  delivery: DeliveryData;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment_id: equipment.id, customer, delivery }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Error al procesar el pago");
        setLoading(false);
        return;
      }
      // Guardar teléfono + dirección para prellenar el próximo pedido (sin bloquear el pago)
      fetch("/api/me/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer.phone, delivery }),
      }).catch(() => {});
      window.location.href = data.url;
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-800 text-[#18191F] mb-2">Resumen y pago</h2>
      <p className="text-sm text-[#666666] mb-6">Revisa tu pedido antes de pagar.</p>

      {/* Resumen equipo */}
      <div className="bg-[#EEF2FF] rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-700 text-[#18191F] text-sm">{equipment.modelo_completo}</p>
            <p className="text-xs text-[#666666]">
              {[equipment.chip, equipment.ram, equipment.ssd].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="text-xl font-800 text-[#1B4FFF]">
            ${equipment.sale_price_usd.toLocaleString("en-US")}
          </p>
        </div>
        {delivery.method === "shipping" && typeof delivery.shippingCost === "number" && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#DDEAFF]">
            <div>
              <p className="text-xs text-[#666666]">🛵 Envío a domicilio</p>
              <p className="text-[10px] text-[#999999]">{delivery.shippingFree ? "¡Gratis!" : "Contra entrega"}</p>
            </div>
            <p className={`text-sm font-700 ${delivery.shippingFree ? "text-[#2D7D46]" : "text-[#18191F]"}`}>
              {delivery.shippingFree ? "Gratis" : `S/ ${delivery.shippingCost}`}
            </p>
          </div>
        )}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#DDEAFF]">
          <p className="text-sm font-700 text-[#333333]">Total a pagar hoy</p>
          <p className="text-2xl font-900 text-[#1B4FFF]">
            ${equipment.sale_price_usd.toLocaleString("en-US")} USD
          </p>
        </div>
      </div>

      {/* Datos resumen */}
      <div className="bg-[#F7F7F7] rounded-xl p-4 mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#666666]">Nombre</span>
          <span className="font-600 text-[#18191F]">{customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#666666]">Email</span>
          <span className="font-600 text-[#18191F]">{customer.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#666666]">Entrega</span>
          <span className="font-600 text-[#18191F]">
            {delivery.method === "pickup" ? "Recojo en oficina" : delivery.address || delivery.street}
          </span>
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
          <>
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
            Redirigiendo a Stripe…
          </>
        ) : (
          <>Pagar ${equipment.sale_price_usd.toLocaleString("en-US")} USD</>
        )}
      </motion.button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-2 mb-4 text-xs text-[#999999]">
        <span>🔒</span>
        <span>Pago único y seguro — procesado por Stripe</span>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer"
      >
        Volver
      </button>
    </div>
  );
}

// ─── Main checkout ─────────────────────────────────────────────────────────────
function PurchaseCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const equipmentId = searchParams.get("id") ?? "";

  const [step, setStep] = useState(1);
  const [equipment, setEquipment] = useState<SaleEquipment | null>(null);
  const [loadingEq, setLoadingEq] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [customer, setCustomer] = useState<CustomerData>({
    name: "", email: "", phone: "+51", company: "", ruc: "", customerType: "persona",
  });
  const [delivery, setDelivery] = useState<DeliveryData>({
    method: "shipping", address: "", street: "", streetNumber: "",
    distrito: "", reference: "", placeType: "", apartment: "", floor: "",
  });

  // Pre-fill email from session
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setCustomer((prev) => ({
            ...prev,
            name: prev.name || data.user.name || "",
            email: prev.email || data.user.email || "",
            phone: prev.phone !== "+51" ? prev.phone : (data.user.phone || "+51"),
          }));
          // Prellenar dirección guardada del último pedido
          const sd = data.user.saved_delivery;
          if (sd && (sd.street || sd.distrito)) {
            setDelivery((prev) => ({
              ...prev,
              method: sd.method || prev.method,
              street: prev.street || sd.street || "",
              streetNumber: prev.streetNumber || sd.streetNumber || "",
              distrito: prev.distrito || sd.distrito || "",
              reference: prev.reference || sd.reference || "",
              placeType: prev.placeType || sd.placeType || "",
              apartment: prev.apartment || sd.apartment || "",
              floor: prev.floor || sd.floor || "",
            }));
          }
        } else {
          // No session → redirect to login
          const next = encodeURIComponent(`/comprar-checkout?id=${equipmentId}`);
          router.push(`/auth/login?next=${next}`);
        }
      })
      .catch(() => {});
  }, [equipmentId, router]);

  // Load equipment
  useEffect(() => {
    if (!equipmentId) { setNotFound(true); setLoadingEq(false); return; }
    fetch("/api/sale-equipment")
      .then((r) => (r.ok ? r.json() : { equipment: [] }))
      .then((data) => {
        const found = (data.equipment as SaleEquipment[]).find((e) => e.id === equipmentId);
        if (found) setEquipment(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingEq(false));
  }, [equipmentId]);

  if (loadingEq) {
    return (
      <div className="max-w-lg w-full mx-auto py-20 text-center text-[#999999]">
        Cargando equipo…
      </div>
    );
  }

  if (notFound || !equipment) {
    return (
      <div className="max-w-lg w-full mx-auto py-20 text-center">
        <p className="text-xl font-700 text-[#18191F] mb-2">Equipo no disponible</p>
        <p className="text-[#666666] mb-6">Este equipo ya fue vendido o no está disponible.</p>
        <a href="/comprar" className="px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full">
          Ver otros equipos
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full mx-auto">
      <a href="/" className="block text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logoflux.svg" alt="Flux" className="h-10 mx-auto" />
      </a>

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm">
        <Steps current={step} />

        {step === 1 && (
          <Step1 equipment={equipment} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            data={customer}
            onChange={setCustomer}
            delivery={delivery}
            onDeliveryChange={setDelivery}
          />
        )}
        {step === 3 && (
          <Step3
            equipment={equipment}
            customer={customer}
            delivery={delivery}
            onBack={() => setStep(2)}
          />
        )}
      </div>

      <p className="text-center text-xs text-[#999999] mt-6">
        ¿Preguntas?{" "}
        <a href="mailto:hola@fluxperu.com" className="text-[#1B4FFF]">hola@fluxperu.com</a>
      </p>
    </div>
  );
}

export default function PurchaseCheckoutPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-start justify-center py-10 px-4">
      <Suspense
        fallback={
          <div className="max-w-lg w-full mx-auto py-20 text-center text-[#999999]">
            Cargando…
          </div>
        }
      >
        <PurchaseCheckoutContent />
      </Suspense>
    </div>
  );
}
