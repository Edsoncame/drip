"use client";

import { useState, useMemo } from "react";

// Linear residual model calibrated from our 3 anchor plans:
//  0m  →  100%   (equipo nuevo, sin uso)
//  8m  →   77.5%
// 16m  →   55%
// 24m  →   32.5%
// Pendiente: -2.8125% por mes. Floor 10% después de 32 meses.
const SLOPE = -2.8125;
const FLOOR = 10;

function residualPct(monthsUsed: number): number {
  const raw = 100 + SLOPE * Math.max(0, monthsUsed);
  return Math.max(FLOOR, raw);
}

// Round to nearest $5 for cleaner offers
function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export default function ResaleCalculator() {
  const [cost, setCost] = useState("900");
  const [months, setMonths] = useState("8");

  const costNum = parseFloat(cost) || 0;
  const monthsNum = parseFloat(months) || 0;

  const result = useMemo(() => {
    if (costNum <= 0 || monthsNum < 0) return null;
    const pct = residualPct(monthsNum);
    const raw = costNum * (pct / 100);
    const offline = roundTo5(raw);
    const online = roundTo5(raw * 1.045); // Stripe commission
    return { pct, raw, offline, online };
  }, [costNum, monthsNum]);

  const referencePoints = [
    { months: 0,  label: "Equipo nuevo (sin uso)" },
    { months: 8,  label: "8 meses rentado" },
    { months: 16, label: "16 meses rentado" },
    { months: 24, label: "24 meses rentado" },
    { months: 32, label: "32+ meses (mínimo)" },
  ];

  return (
    <div className="mt-6 bg-white rounded-2xl border border-[#E5E5E5] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💰</span>
        <h3 className="font-700 text-[#18191F] text-base">Calculadora de venta — equipos usados</h3>
      </div>
      <p className="text-xs text-[#666] mb-4">
        Ingresa el costo original del equipo y los meses que ha estado alquilado.
        Calcula el precio de venta sugerido basado en el valor residual (a más meses de uso, menor residual).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-600 text-[#333] mb-1">Costo original del equipo (USD)</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="900"
            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF]"
          />
        </div>
        <div>
          <label className="block text-xs font-600 text-[#333] mb-1">Meses alquilado (tiempo de uso)</label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            placeholder="8"
            min="0"
            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF]"
          />
        </div>
      </div>

      {result && (
        <>
          {/* Highlighted result */}
          <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F8FF] border border-[#1B4FFF]/20 rounded-2xl p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-[#666] uppercase tracking-wider font-700">Valor residual</p>
                <p className="text-3xl font-800 text-[#1B4FFF] mt-1">{result.pct.toFixed(1)}%</p>
                <p className="text-[10px] text-[#999] mt-0.5">del costo original</p>
              </div>
              <div>
                <p className="text-[10px] text-[#666] uppercase tracking-wider font-700">Precio venta offline</p>
                <p className="text-3xl font-800 text-[#18191F] mt-1">${result.offline}</p>
                <p className="text-[10px] text-[#999] mt-0.5">empresas / transferencia</p>
              </div>
              <div>
                <p className="text-[10px] text-[#666] uppercase tracking-wider font-700">Precio venta online</p>
                <p className="text-3xl font-800 text-[#18191F] mt-1">${result.online}</p>
                <p className="text-[10px] text-[#999] mt-0.5">con comisión Stripe (+4.5%)</p>
              </div>
            </div>
          </div>

          {/* Reference table */}
          <div className="overflow-x-auto">
            <p className="text-xs font-700 text-[#666] uppercase tracking-wider mb-2">Tabla de referencia</p>
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7F7]">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-700 text-[#666]">Escenario</th>
                  <th className="text-center px-3 py-2 text-xs font-700 text-[#666]">Meses</th>
                  <th className="text-center px-3 py-2 text-xs font-700 text-[#666]">Residual</th>
                  <th className="text-right px-3 py-2 text-xs font-700 text-[#666]">Venta offline</th>
                  <th className="text-right px-3 py-2 text-xs font-700 text-[#666]">Venta online</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {referencePoints.map(rp => {
                  const pct = residualPct(rp.months);
                  const raw = costNum * (pct / 100);
                  const isCurrent = rp.months === monthsNum;
                  return (
                    <tr key={rp.months} className={isCurrent ? "bg-[#F5F8FF]" : ""}>
                      <td className="px-3 py-2.5 text-xs text-[#333]">
                        {rp.label}
                        {isCurrent && <span className="ml-2 text-[10px] font-700 text-[#1B4FFF]">← actual</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-[#666]">{rp.months}m</td>
                      <td className="px-3 py-2.5 text-center text-xs font-600 text-[#1B4FFF]">{pct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-right font-700 text-[#18191F]">${roundTo5(raw)}</td>
                      <td className="px-3 py-2.5 text-right font-700 text-[#18191F]">${roundTo5(raw * 1.045)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 bg-[#F5F8FF] rounded-xl p-3 text-xs text-[#666]">
        <p><strong>Fórmula:</strong> residual = 100% − (2.8125% × meses usado), mínimo 10%.</p>
        <p className="mt-1"><strong>Calibración:</strong> anclada en 77.5% / 55% / 32.5% para 8m / 16m / 24m (los 3 planes de estreno).</p>
        <p className="mt-1"><strong>Re-alquiler:</strong> para un equipo que ya fue alquilado X meses y luego Y meses más, usa <strong>X + Y</strong> como total de meses.</p>
      </div>
    </div>
  );
}
