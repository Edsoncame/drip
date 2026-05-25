"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SaleEquipment } from "@/app/api/sale-equipment/route";

// Specs adicionales por modelo (datos técnicos fijos por generación)
const MODEL_SPECS: Record<string, { label: string; value: string }[]> = {
  "MacBook Air": [
    { label: "Pantalla", value: "13.3\" Retina IPS, 2560 × 1600 px" },
    { label: "Batería", value: "Hasta 15 horas" },
    { label: "Cámara", value: "720p FaceTime HD" },
    { label: "Puertos", value: "2× Thunderbolt / USB 4, jack 3.5mm" },
    { label: "Peso", value: "1.29 kg" },
    { label: "Sistema", value: "macOS — actualizable" },
  ],
  "MacBook Pro 14": [
    { label: "Pantalla", value: "14.2\" Liquid Retina XDR, 3024 × 1964 px" },
    { label: "Batería", value: "Hasta 18 horas" },
    { label: "Cámara", value: "1080p FaceTime HD" },
    { label: "Puertos", value: "3× Thunderbolt 4, HDMI, SD, MagSafe 3" },
    { label: "Peso", value: "1.55 kg" },
    { label: "Sistema", value: "macOS — actualizable" },
  ],
};

function getExtraSpecs(modelo: string) {
  if (modelo.includes("MacBook Pro 14")) return MODEL_SPECS["MacBook Pro 14"];
  if (modelo.includes("MacBook Air")) return MODEL_SPECS["MacBook Air"];
  return [];
}

const CONDITION_COLOR: Record<string, string> = {
  Excelente: "bg-[#E5F3DF] text-[#2D7D46]",
  "Muy bueno": "bg-[#EEF2FF] text-[#1B4FFF]",
  Bueno: "bg-[#FFF8E5] text-[#B45309]",
};

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#F0F0F0]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-sm font-700 text-[#18191F] cursor-pointer hover:text-[#1B4FFF] transition-colors text-left"
      >
        {title}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="pb-4 text-sm text-[#555555] leading-relaxed">{children}</div>}
    </div>
  );
}

export default function ComprarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [equipment, setEquipment] = useState<SaleEquipment & { teclado?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    fetch(`/api/sale-equipment/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.equipment) setEquipment(data.equipment);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center text-[#999999]">
        Cargando equipo…
      </div>
    );
  }

  if (notFound || !equipment) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-xl font-700 text-[#18191F] mb-2">Equipo no disponible</p>
        <p className="text-[#666666] mb-6">Este equipo ya fue vendido o no está disponible.</p>
        <Link href="/comprar" className="px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full">
          Ver otros equipos
        </Link>
      </div>
    );
  }

  const eq = equipment;
  const condColor = CONDITION_COLOR[eq.sale_condition] ?? "bg-gray-100 text-gray-600";
  const extraSpecs = getExtraSpecs(eq.modelo_completo);
  const savings = eq.precio_compra_usd
    ? Math.round((1 - eq.sale_price_usd / eq.precio_compra_usd) * 100)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#999999] mb-6">
        <Link href="/" className="hover:text-[#1B4FFF]">Inicio</Link>
        <span>/</span>
        <Link href="/comprar" className="hover:text-[#1B4FFF]">FLUX Certified</Link>
        <span>/</span>
        <span className="text-[#333333] truncate">{eq.modelo_completo}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        {/* ── Columna izquierda — Imagen ── */}
        <div>
          <div className="relative bg-[#F7F7F7] rounded-3xl overflow-hidden aspect-square flex items-center justify-center p-10">
            <div className="absolute top-4 left-4 px-3 py-1 bg-[#1B4FFF] text-white text-xs font-700 rounded-full">
              FLUX Certified
            </div>
            <span className={`absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700 ${condColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {eq.sale_condition}
            </span>
            {eq.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={eq.image_url}
                alt={eq.modelo_completo}
                className="w-full max-w-sm object-contain"
              />
            ) : (
              <span className="text-8xl">💻</span>
            )}
          </div>

          {/* Sellos de confianza */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: "🛡️", label: "90 días de garantía" },
              { icon: "↩️", label: "7 días devolución" },
              { icon: "📦", label: "Despacho Lima 24h" },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-1 p-3 bg-[#F7F7F7] rounded-2xl text-center">
                <span className="text-xl">{t.icon}</span>
                <span className="text-[10px] font-600 text-[#555555] leading-tight">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Columna derecha — Info ── */}
        <div>
          {/* Título */}
          <div className="mb-1">
            <span className="text-xs font-700 text-[#1B4FFF] uppercase tracking-widest">
              FLUX Certified Reacondicionado
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#18191F] leading-tight mb-4">
            {eq.modelo_completo} Reacondicionado
          </h1>

          {/* Precio */}
          <div className="mb-5">
            {eq.precio_compra_usd && (
              <div className="flex items-center gap-3 mb-1">
                <span className="text-base text-[#999999] line-through">
                  ${eq.precio_compra_usd.toLocaleString("en-US")} USD
                </span>
                {savings && (
                  <span className="px-2 py-0.5 bg-[#E5F3DF] text-[#2D7D46] text-xs font-700 rounded-full">
                    {savings}% de ahorro
                  </span>
                )}
              </div>
            )}
            <p className="text-4xl font-black text-[#18191F]">
              ${eq.sale_price_usd.toLocaleString("en-US")}
              <span className="text-lg font-500 text-[#999999] ml-2">USD</span>
            </p>
            <p className="text-xs text-[#999999] mt-1">Impuestos incluidos · Envío se calcula al pagar</p>
          </div>

          {/* CTA */}
          <Link
            href={`/comprar-checkout?id=${eq.id}`}
            className="block w-full py-4 bg-[#1B4FFF] text-white text-center font-700 text-base rounded-full hover:bg-[#1340CC] transition-colors mb-3"
          >
            Comprar ahora →
          </Link>
          <Link
            href="/comprar"
            className="block w-full py-3 border border-[#E5E5E5] text-[#666666] text-center font-600 text-sm rounded-full hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors mb-6"
          >
            ← Ver todos los equipos
          </Link>

          {/* Especificaciones */}
          <div className="mb-6">
            <h2 className="text-sm font-800 text-[#18191F] uppercase tracking-widest mb-3">Especificaciones</h2>
            <div className="space-y-0 rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {[
                { label: "Procesador", value: eq.chip },
                { label: "Memoria RAM", value: eq.ram },
                { label: "Almacenamiento", value: eq.ssd },
                { label: "Color", value: eq.color },
                { label: "Teclado", value: (eq as { teclado?: string }).teclado ?? "Español" },
                ...extraSpecs,
              ].filter((s) => s.value).map((spec, i) => (
                <div
                  key={spec.label}
                  className={`flex justify-between items-start px-4 py-3 text-sm ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}
                >
                  <span className="text-[#666666] font-500 flex-shrink-0 w-36">{spec.label}</span>
                  <span className="font-600 text-[#18191F] text-right">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ¿Qué incluye? */}
          <div className="mb-6 p-5 bg-[#EEF2FF] rounded-2xl">
            <h2 className="text-sm font-800 text-[#18191F] mb-3">¿Qué incluye tu Mac?</h2>
            <ul className="space-y-2">
              {[
                { icon: "💻", text: `${eq.modelo_completo} certificado` },
                { icon: "📦", text: "Caja FLUX — packaging premium sellado" },
                { icon: "🔌", text: "Cable de carga USB-C incluido" },
                { icon: "🧹", text: "Formateado con macOS listo para usar" },
                { icon: "🛡️", text: "90 días de garantía por defecto de hardware" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2.5 text-sm text-[#333333]">
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Accordions */}
          <div className="border-t border-[#F0F0F0]">
            <Accordion title="¿Qué es un equipo FLUX Certified Reacondicionado?">
              <p className="mb-2">
                Los equipos <strong>FLUX Certified</strong> son MacBooks de nuestra flota de renta empresarial. Después de completar su ciclo de alquiler, cada equipo pasa por un proceso de <strong>15 puntos de revisión técnica</strong>:
              </p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Diagnóstico completo de batería (capacidad y ciclos)</li>
                <li>Pantalla: píxeles, brillo y uniformidad</li>
                <li>Teclado y trackpad: respuesta de todas las teclas</li>
                <li>Puertos: carga, datos y video</li>
                <li>Altavoces, micrófono y cámara</li>
                <li>Borrado seguro de todos los datos del usuario anterior</li>
                <li>Instalación limpia de macOS</li>
              </ul>
              <p className="mt-2">
                El resultado: un equipo que funciona como nuevo, con precio de reacondicionado y garantía incluida.
              </p>
            </Accordion>

            <Accordion title="¿Cómo funciona la garantía de 90 días?">
              <p>
                La garantía FLUX Certified cubre cualquier falla de hardware que aparezca durante los 90 días posteriores a la compra. Esto incluye problemas con la pantalla, batería, teclado, puertos y placa madre.
              </p>
              <p className="mt-2">
                No cubre daños físicos por caída o líquidos. Para activar la garantía escríbenos a <strong>hola@fluxperu.com</strong> con tu número de orden.
              </p>
            </Accordion>

            <Accordion title="¿Cuáles son los métodos de pago?">
              <p>
                Procesamos el pago de forma segura a través de <strong>Stripe</strong>. Aceptamos:
              </p>
              <ul className="mt-2 space-y-1 ml-4 list-disc">
                <li>Tarjeta de crédito o débito (Visa, Mastercard, Amex)</li>
                <li>Tarjetas peruanas (BCP, BBVA, Interbank, Scotiabank)</li>
              </ul>
              <p className="mt-2">El pago es único — no es una suscripción.</p>
            </Accordion>

            <Accordion title="¿Cómo es el despacho?">
              <p>
                Hacemos despacho a domicilio en <strong>Lima en 24 horas hábiles</strong>. El costo de envío se calcula automáticamente según tu distrito al momento del pago.
              </p>
              <p className="mt-2">
                También puedes recoger en nuestra oficina en <strong>Av. Primavera, Surco</strong> sin costo adicional.
              </p>
            </Accordion>
          </div>

          {/* T&C link */}
          <p className="mt-6 text-xs text-[#999999]">
            Al comprar aceptas nuestros{" "}
            <Link href="/terminos-certified" className="text-[#1B4FFF] hover:underline">
              Términos y Condiciones de compraventa FLUX Certified
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
