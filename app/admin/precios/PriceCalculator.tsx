"use client";

import { useState, useMemo } from "react";
import { calcAllPrices } from "@/lib/pricing-formula";

export default function PriceCalculator() {
  const [cost, setCost] = useState("900");

  const costNum = parseFloat(cost) || 0;
  const prices = useMemo(() => costNum > 0 ? calcAllPrices(costNum) : [], [costNum]);

  return (
    <div className="mt-6 bg-white rounded-2xl border border-[#E5E5E5] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🧮</span>
        <h3 className="font-700 text-[#18191F] text-base">Calculadora de precios</h3>
      </div>
      <p className="text-xs text-[#666] mb-4">Ingresa el costo de un equipo nuevo y te muestro los precios sugeridos para cada plan (offline para empresas, online para web con Culqi).</p>

      <div className="mb-5">
        <label className="block text-xs font-600 text-[#333] mb-1">Costo del equipo (USD)</label>
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="900"
          className="w-full sm:w-64 px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF]"
        />
      </div>

      {prices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-700 text-[#666]">Plan</th>
                <th className="text-center px-3 py-2 text-xs font-700 text-[#666]">Meses</th>
                <th className="text-center px-3 py-2 text-xs font-700 text-[#666]">Residual</th>
                <th className="text-right px-3 py-2 text-xs font-700 text-[#666]">Offline (empresas)</th>
                <th className="text-right px-3 py-2 text-xs font-700 text-[#666]">Online (web + Culqi)</th>
                <th className="text-right px-3 py-2 text-xs font-700 text-[#666]">Total del plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {prices.map(p => (
                <tr key={p.plan}>
                  <td className="px-3 py-2.5">
                    <p className="font-600 text-[#18191F] text-xs">{p.label}</p>
                    {p.plan.startsWith("realquiler") && (
                      <span className="text-[10px] text-orange-600 font-600">Re-alquiler</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-[#666]">{p.months}m</td>
                  <td className="px-3 py-2.5 text-center text-xs text-[#666]">{p.residualPct}%</td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="font-700 text-[#18191F]">${p.offline}</p>
                    <p className="text-[10px] text-[#999]">/mes</p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="font-700 text-[#1B4FFF]">${p.online}</p>
                    <p className="text-[10px] text-[#999]">/mes</p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="font-600 text-[#333] text-xs">${p.offline * p.months}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 bg-[#F5F8FF] rounded-xl p-3 text-xs text-[#666]">
        <p><strong>Fórmula:</strong> price = (costo × ratio) / meses, donde el ratio está calibrado con datos reales de los 3 modelos actuales.</p>
        <p className="mt-1"><strong>Online:</strong> offline + comisión Culqi (~4.5%) redondeado al siguiente $5.</p>
      </div>
    </div>
  );
}
