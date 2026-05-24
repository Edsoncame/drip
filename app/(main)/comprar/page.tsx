"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SaleEquipment } from "@/app/api/sale-equipment/route";

const CONDITION_LABEL: Record<string, string> = {
  Excelente: "Excelente",
  "Muy bueno": "Muy bueno",
  Bueno: "Bueno",
};

const CONDITION_COLOR: Record<string, string> = {
  Excelente: "bg-[#E5F3DF] text-[#2D7D46]",
  "Muy bueno": "bg-[#EEF2FF] text-[#1B4FFF]",
  Bueno: "bg-[#FFF8E5] text-[#B45309]",
};

function ConditionBadge({ condition }: { condition: string }) {
  const label = CONDITION_LABEL[condition] ?? condition;
  const color = CONDITION_COLOR[condition] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700 ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SaleCard({ item }: { item: SaleEquipment }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden hover:shadow-md transition-shadow">
      {/* Imagen */}
      <div className="bg-[#F7F7F7] h-48 flex items-center justify-center p-6">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.modelo_completo} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-6xl">💻</span>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-800 text-[#18191F] text-base leading-tight">{item.modelo_completo}</h3>
          <ConditionBadge condition={item.sale_condition} />
        </div>

        <div className="space-y-1 mb-4">
          {item.chip && (
            <p className="text-sm text-[#666666]">
              <span className="font-600">Chip</span> {item.chip}
            </p>
          )}
          {item.ram && (
            <p className="text-sm text-[#666666]">
              <span className="font-600">RAM</span> {item.ram}
            </p>
          )}
          {item.ssd && (
            <p className="text-sm text-[#666666]">
              <span className="font-600">SSD</span> {item.ssd}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#F0F0F0]">
          <div>
            <p className="text-2xl font-900 text-[#18191F]">
              ${item.sale_price_usd.toLocaleString("en-US")}
              <span className="text-sm font-500 text-[#999999] ml-1">USD</span>
            </p>
          </div>
          <Link
            href={`/comprar-checkout?id=${item.id}`}
            className="px-5 py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors"
          >
            Comprar
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-4">
      <div className="w-20 h-20 bg-[#F0F4FF] rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">💻</span>
      </div>
      <h2 className="text-xl font-800 text-[#18191F] mb-2">Pronto disponible</h2>
      <p className="text-[#666666] mb-6 max-w-sm mx-auto">
        Estamos preparando la primera tanda de MacBooks certificados. Déjanos tu email y te avisamos cuando estén listos.
      </p>
      <a
        href="https://wa.me/51900164769?text=Hola,%20quiero%20saber%20cu%C3%A1ndo%20estarán%20disponibles%20las%20MacBooks%20usadas"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors"
      >
        Avísame por WhatsApp
      </a>
    </div>
  );
}

export default function ComprarPage() {
  const [equipment, setEquipment] = useState<SaleEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sale-equipment")
      .then((r) => (r.ok ? r.json() : { equipment: [] }))
      .then((data) => setEquipment(data.equipment ?? []))
      .catch(() => setEquipment([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#E5F3DF] rounded-full text-[#2D7D46] text-xs font-700 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2D7D46]" />
          MacBooks certificados
        </div>
        <h1 className="text-4xl font-black mb-2" style={{ color: "var(--dark-text)" }}>
          MacBooks usados
        </h1>
        <p style={{ color: "var(--medium-text)" }}>
          Equipos de flota FLUX en perfecto estado. Probados, limpios y con garantía.
        </p>
      </div>

      {/* Garantías */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        {[
          { icon: "🔍", title: "Revisados", desc: "Cada equipo pasa inspección técnica antes de salir" },
          { icon: "🧹", title: "Formateados", desc: "Borrado seguro de datos. Llega como nuevo para ti" },
          { icon: "📦", title: "Entrega en Lima", desc: "Envío a domicilio en 24-48 horas hábiles" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 p-4 bg-[#F7F7F7] rounded-2xl">
            <span className="text-2xl flex-shrink-0">{item.icon}</span>
            <div>
              <p className="font-700 text-[#18191F] text-sm">{item.title}</p>
              <p className="text-xs text-[#666666] mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#F7F7F7] rounded-2xl h-72 animate-pulse" />
          ))}
        </div>
      ) : equipment.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {equipment.map((item) => (
            <SaleCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Footer info */}
      <div className="mt-12 p-6 rounded-2xl" style={{ background: "var(--primary-light)" }}>
        <h3 className="font-bold mb-2" style={{ color: "var(--primary)" }}>
          ¿Prefieres alquilar en vez de comprar?
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--medium-text)" }}>
          Renta un MacBook nuevo desde $85/mes. Sin pago inicial, con soporte incluido.
        </p>
        <Link
          href="/laptops"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full"
          style={{ background: "var(--primary)" }}
        >
          Ver MacBooks en renta
        </Link>
      </div>
    </div>
  );
}
