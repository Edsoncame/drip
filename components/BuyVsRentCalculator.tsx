"use client";

/**
 * Calculadora "Comprar vs Alquilar".
 *
 * Permite a un cliente B2B comparar el costo total de comprar X MacBooks
 * versus alquilarlas con FLUX por un plazo dado. Es la herramienta de
 * conversión #1 para empresas porque hace tangible el ahorro de capital.
 *
 * Asunciones de la fórmula (configurables abajo en CONSTANTS):
 *   - Precio de compra promedio por MacBook (mix Air/Pro)
 *   - Costo de soporte/garantía por equipo por año
 *   - Tasa de descuento del capital (cost of capital)
 *   - Depreciación anual estimada
 *
 * Resultado: muestra el desglose de ambos escenarios y el ahorro neto
 * que tendría el cliente alquilando con FLUX.
 */

import { useState, useMemo } from "react";

// ─── Constantes calibradas con datos reales de FLUX ────────────────────────

/** Precio de compra promedio en USD (mix Air M4 + Pro M4). */
const AVG_PURCHASE_PRICE_USD = 1450;

/** Tarifa mensual promedio de FLUX por equipo (Air M4 16m). */
const AVG_FLUX_MONTHLY_USD = 95;

/** Costo anual de soporte técnico + garantía si compra el equipo. */
const ANNUAL_SUPPORT_COST_USD = 120;

/** Costo de oportunidad del capital (8% anual, prudente para PYMEs). */
const COST_OF_CAPITAL_RATE = 0.08;

export default function BuyVsRentCalculator() {
  const [quantity, setQuantity] = useState(5);
  const [months, setMonths] = useState(16);

  const result = useMemo(() => {
    const years = months / 12;

    // Escenario A: Comprar
    // - Capital invertido al inicio
    // - Soporte/garantía durante el plazo
    // - Costo de oportunidad del capital congelado
    const purchaseTotal = AVG_PURCHASE_PRICE_USD * quantity;
    const supportTotal = ANNUAL_SUPPORT_COST_USD * quantity * years;
    const opportunityCost = purchaseTotal * COST_OF_CAPITAL_RATE * years;
    const buyTotal = purchaseTotal + supportTotal + opportunityCost;

    // Escenario B: Alquilar con FLUX
    // - Solo cuotas mensuales, soporte incluido
    const rentTotal = AVG_FLUX_MONTHLY_USD * quantity * months;

    const savings = buyTotal - rentTotal;
    const savingsPct = (savings / buyTotal) * 100;

    return {
      purchaseTotal,
      supportTotal,
      opportunityCost,
      buyTotal,
      rentTotal,
      savings,
      savingsPct,
    };
  }, [quantity, months]);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 md:p-10">
      <div className="text-center mb-8">
        <h3 className="text-2xl md:text-3xl font-800 text-[#18191F] mb-2">
          Comprar vs Alquilar
        </h3>
        <p className="text-sm text-[#666] max-w-xl mx-auto">
          Calcula cuánto puede ahorrar tu empresa alquilando MacBooks con FLUX en lugar de comprarlas.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div>
          <label className="block text-xs font-700 text-[#666] uppercase mb-2">
            Cantidad de MacBooks
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="flex-1 accent-[#1B4FFF]"
            />
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1")))}
              className="w-20 px-3 py-2 text-center border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] font-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-700 text-[#666] uppercase mb-2">
            Plazo (meses)
          </label>
          <div className="flex gap-2">
            {[8, 16, 24].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-700 transition-colors cursor-pointer ${
                  months === m
                    ? "bg-[#1B4FFF] text-white"
                    : "bg-[#F7F7F7] text-[#666] hover:bg-[#E5E5E5]"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Buy scenario */}
        <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl p-5">
          <p className="text-xs font-700 text-[#666] uppercase tracking-wider mb-3">Comprar</p>
          <p className="text-3xl font-800 text-[#18191F] mb-4">
            ${result.buyTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <div className="space-y-1.5 text-xs text-[#666]">
            <div className="flex justify-between">
              <span>Compra inicial</span>
              <span className="font-600 text-[#333]">
                ${result.purchaseTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Soporte y garantía</span>
              <span className="font-600 text-[#333]">
                ${result.supportTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Costo de capital (8%)</span>
              <span className="font-600 text-[#333]">
                ${result.opportunityCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Rent scenario (FLUX) */}
        <div className="bg-gradient-to-br from-[#1B4FFF] to-[#102F99] text-white rounded-2xl p-5">
          <p className="text-xs font-700 uppercase tracking-wider mb-3 opacity-80">
            Alquilar con FLUX
          </p>
          <p className="text-3xl font-800 mb-4">
            ${result.rentTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <div className="space-y-1.5 text-xs opacity-90">
            <div className="flex justify-between">
              <span>{quantity} equipos × ${AVG_FLUX_MONTHLY_USD}/mes</span>
              <span className="font-600">{months} meses</span>
            </div>
            <div className="flex justify-between">
              <span>Soporte técnico</span>
              <span className="font-600">Incluido</span>
            </div>
            <div className="flex justify-between">
              <span>Reemplazo por falla</span>
              <span className="font-600">Incluido</span>
            </div>
            <div className="flex justify-between">
              <span>Capital inicial</span>
              <span className="font-600">$0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Savings highlight */}
      {result.savings > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <p className="text-xs font-700 text-green-800 uppercase tracking-wider mb-1">
            Ahorro estimado con FLUX
          </p>
          <p className="text-4xl font-800 text-green-700">
            ${result.savings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            <span className="text-lg text-green-600 ml-2">({result.savingsPct.toFixed(0)}%)</span>
          </p>
          <p className="text-xs text-green-700 mt-2">
            Más liquidez, sin depreciación de activos, soporte incluido.
          </p>
        </div>
      ) : (
        <div className="bg-[#FFFBEB] border border-yellow-200 rounded-2xl p-5 text-center">
          <p className="text-sm text-yellow-800">
            Para esta combinación, comprar es ligeramente más económico. Cambia el plazo o la cantidad
            para comparar otros escenarios.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="#cotizar"
          className="px-6 py-3 bg-[#1B4FFF] text-white font-700 text-sm rounded-full hover:bg-[#1340CC] text-center"
        >
          Pedir cotización personalizada
        </a>
        <a
          href="https://wa.me/51932648703?text=Hola,%20quiero%20alquilar%20MacBooks%20para%20mi%20empresa"
          target="_blank"
          rel="noreferrer"
          className="px-6 py-3 border border-[#E5E5E5] bg-white text-[#333] font-700 text-sm rounded-full hover:bg-[#F7F7F7] text-center"
        >
          Hablar por WhatsApp
        </a>
      </div>

      <p className="text-[10px] text-[#999] text-center mt-4">
        * Cálculo estimado basado en precio promedio de $1,450 por MacBook, costo de capital 8% anual,
        soporte técnico $120/año/equipo. Cotización real puede variar según modelo y volumen.
      </p>
    </div>
  );
}
