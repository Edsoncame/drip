"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { motion } from "framer-motion";
import { getProduct } from "@/lib/products";
import type { Product } from "@/lib/products";
import type { ICardPaymentFormData, ICardPaymentBrickPayer, IAdditionalData } from "@mercadopago/sdk-react/esm/bricks/cardPayment/type";

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

// ─── Step 1 — Plan summary ─────────────────────────────────────────────────────
function Step1({ product, months, onNext }: { product: Product; months: number; onNext: () => void }) {
  const router = useRouter();
  const plan = product.pricing.find((p) => p.months === months)!;

  return (
    <div>
      <h2 className="text-2xl font-800 text-[#18191F] mb-6">Tu plan seleccionado</h2>

      <div className="bg-[#F7F7F7] rounded-2xl p-6 mb-6">
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

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Plan elegido</span>
            <span className="font-700 text-[#18191F]">{months} meses</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Renta mensual</span>
            <span className="font-700 text-[#18191F]">${plan.price}/mes</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666666]">Total del plan</span>
            <span className="font-700 text-[#18191F]">${plan.price * months}</span>
          </div>
          <div className="border-t border-[#E5E5E5] pt-3 flex justify-between">
            <span className="font-700 text-[#333333]">Cobro hoy (1er mes)</span>
            <span className="text-xl font-800 text-[#1B4FFF]">${plan.price}</span>
          </div>
        </div>
      </div>

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

// ─── Step 2 — Customer data ────────────────────────────────────────────────────
type CustomerData = {
  name: string;
  email: string;
  phone: string;
  company: string;
  ruc: string;
};

function Step2({
  onNext,
  onBack,
  data,
  onChange,
}: {
  onNext: () => void;
  onBack: () => void;
  data: CustomerData;
  onChange: (d: CustomerData) => void;
}) {
  const [errors, setErrors] = useState<Partial<CustomerData>>({});

  const validate = () => {
    const e: Partial<CustomerData> = {};
    if (!data.name.trim()) e.name = "Requerido";
    if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Email inválido";
    if (!data.phone.trim()) e.phone = "Requerido";
    if (!data.company.trim()) e.company = "Requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-2xl font-800 text-[#18191F] mb-6">Tus datos</h2>

      <div className="space-y-4">
        {(
          [
            { key: "name", label: "Nombre completo", placeholder: "Juan Pérez", type: "text" },
            { key: "email", label: "Correo electrónico", placeholder: "juan@empresa.com", type: "email" },
            { key: "phone", label: "Teléfono / WhatsApp", placeholder: "+51 999 000 000", type: "tel" },
            { key: "company", label: "Empresa", placeholder: "Mi Empresa S.A.C.", type: "text" },
          ] as const
        ).map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="block text-sm font-600 text-[#333333] mb-1">
              {label} <span className="text-[#1B4FFF]">*</span>
            </label>
            <input
              type={type}
              value={data[key]}
              onChange={(e) => onChange({ ...data, [key]: e.target.value })}
              placeholder={placeholder}
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                errors[key]
                  ? "border-red-400 bg-red-50"
                  : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
              }`}
            />
            {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
          </div>
        ))}

        <div>
          <label className="block text-sm font-600 text-[#333333] mb-1">
            RUC <span className="text-[#999999] font-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={data.ruc}
            onChange={(e) => onChange({ ...data, ruc: e.target.value })}
            placeholder="20123456789"
            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all"
          />
        </div>
      </div>

      <p className="text-xs text-[#999999] mt-4">
        Tus datos solo se usan para coordinar la entrega y facturación. No los compartimos con terceros.
      </p>

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

// ─── Step 3 — Mercado Pago Card Brick ─────────────────────────────────────────
function PaymentForm({
  product,
  months,
  customer,
  onBack,
}: {
  product: Product;
  months: number;
  customer: CustomerData;
  onBack: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const plan = product.pricing.find((p) => p.months === months)!;

  const handleSubmit = async (formData: ICardPaymentFormData<ICardPaymentBrickPayer>, _additionalData?: IAdditionalData) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: product.slug,
          months,
          cardToken: formData.token,
          customer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al procesar el pago");
        setLoading(false);
        return;
      }

      router.push(
        `/checkout/success?slug=${product.slug}&months=${months}&name=${encodeURIComponent(customer.name)}&email=${encodeURIComponent(customer.email)}`
      );
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-800 text-[#18191F] mb-2">Pago seguro</h2>
      <p className="text-sm text-[#666666] mb-6">
        Se cobrará <strong className="text-[#18191F]">${plan.price}</strong> hoy por el primer mes.
        Los siguientes meses se cobran automáticamente.
      </p>

      {/* Order summary mini */}
      <div className="bg-[#EEF2FF] rounded-xl p-4 mb-6 flex justify-between items-center">
        <div className="text-sm">
          <p className="font-700 text-[#18191F]">{product.shortName}</p>
          <p className="text-[#666666]">
            {months} meses · ${plan.price}/mes
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#666666]">Cobro hoy</p>
          <p className="text-xl font-800 text-[#1B4FFF]">${plan.price}</p>
        </div>
      </div>

      {/* MP Card Brick */}
      <div className="mb-4">
        <CardPayment
          initialization={{ amount: plan.price, payer: { email: customer.email } }}
          customization={{
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 1,
            },
            visual: {
              hideFormTitle: true,
              hidePaymentButton: loading,
            },
          }}
          onSubmit={handleSubmit}
          onError={(err) => {
            setError(err?.message ?? "Error en el formulario de pago");
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-4 text-[#1B4FFF] font-600">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
          </svg>
          Procesando suscripción…
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-3 mb-4 text-xs text-[#999999]">
        <span>🔒</span>
        <span>Pago seguro con cifrado SSL — procesado por Mercado Pago</span>
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer"
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
  const product = getProduct(slug);

  const [step, setStep] = useState(1);
  const [mpReady, setMpReady] = useState(false);
  const [customer, setCustomer] = useState<CustomerData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    ruc: "",
  });

  useEffect(() => {
    initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, { locale: "es-PE" });
    setMpReady(true);
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
          <span className="text-3xl font-900 text-[#18191F] tracking-tight">drip</span>
        </a>

        <Steps current={step} />

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-3xl p-8 shadow-sm"
        >
          {step === 1 && <Step1 product={product} months={months} onNext={() => setStep(2)} />}

          {step === 2 && (
            <Step2
              data={customer}
              onChange={setCustomer}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && mpReady && (
            <PaymentForm
              product={product}
              months={months}
              customer={customer}
              onBack={() => setStep(2)}
            />
          )}
        </motion.div>

        <p className="text-center text-xs text-[#999999] mt-6">
          © 2025 DRIP — Tika Services S.A.C.
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
