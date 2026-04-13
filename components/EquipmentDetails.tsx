"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  subscriptionId: string;
  equipmentCode: string;
  numeroSerie: string | null;
  modelo: string | null;
  color: string | null;
  teclado: string | null;
  usuarioDispositivo: string | null;
  claveDispositivo: string | null;
  colaborador: string | null;
  area: string | null;
  isCompany: boolean;
}

export default function EquipmentDetails({
  subscriptionId, equipmentCode, numeroSerie, modelo, color, teclado,
  usuarioDispositivo, claveDispositivo, colaborador, area, isCompany,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [colabValue, setColabValue] = useState(colaborador ?? "");
  const [areaValue, setAreaValue] = useState(area ?? "");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/rentals/${subscriptionId}/equipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaborador: colabValue, area: areaValue }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <div className="mt-5 pt-5 border-t border-[#F0F0F0]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-700 text-[#18191F]">Detalles del equipo</h3>
        <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-[#1B4FFF]/10 text-[#1B4FFF]">
          {equipmentCode}
        </span>
      </div>

      {/* Read-only equipment info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {numeroSerie && (
          <ReadField label="N° de Serie" value={numeroSerie} mono copy />
        )}
        {modelo && <ReadField label="Modelo" value={modelo} />}
        {color && <ReadField label="Color" value={color} />}
        {teclado && <ReadField label="Teclado" value={teclado} />}
      </div>

      {/* Device credentials */}
      {(usuarioDispositivo || claveDispositivo) && (
        <div className="bg-[#F5F8FF] rounded-xl p-4 mb-4">
          <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-2">🔐 Acceso al equipo</p>
          <div className="grid grid-cols-2 gap-3">
            {usuarioDispositivo && (
              <div>
                <p className="text-[11px] text-[#666] mb-0.5">Usuario</p>
                <p className="text-sm font-600 text-[#18191F] font-mono">{usuarioDispositivo}</p>
              </div>
            )}
            {claveDispositivo && (
              <div>
                <p className="text-[11px] text-[#666] mb-0.5">Contraseña</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-600 text-[#18191F] font-mono">
                    {showPassword ? claveDispositivo : "••••••••"}
                  </p>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#1B4FFF] hover:text-[#1340CC] cursor-pointer"
                    aria-label="Mostrar/ocultar contraseña"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {showPassword ? (
                        <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      ) : (
                        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable fields — only for empresa */}
      {isCompany && (
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-700 text-[#666] uppercase tracking-wider">Asignación en tu empresa</p>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-[#1B4FFF] font-600 hover:underline cursor-pointer"
              >
                Editar
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-600 text-[#333] mb-1">Colaborador (quién usa este equipo)</label>
                <input
                  type="text"
                  value={colabValue}
                  onChange={(e) => setColabValue(e.target.value)}
                  placeholder="Ej: María García"
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-[#333] mb-1">Área / Departamento</label>
                <input
                  type="text"
                  value={areaValue}
                  onChange={(e) => setAreaValue(e.target.value)}
                  placeholder="Ej: Marketing"
                  className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setColabValue(colaborador ?? "");
                    setAreaValue(area ?? "");
                  }}
                  className="px-4 py-2 border border-[#E5E5E5] text-[#666] text-sm font-600 rounded-full cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-[#999] mb-0.5">Colaborador</p>
                <p className="text-sm font-600 text-[#18191F]">{colaborador || <span className="text-[#BBBBBB]">Sin asignar</span>}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#999] mb-0.5">Área</p>
                <p className="text-sm font-600 text-[#18191F]">{area || <span className="text-[#BBBBBB]">Sin asignar</span>}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadField({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-[#F7F7F7] rounded-xl p-3">
      <p className="text-[11px] text-[#999] mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={`text-sm font-600 text-[#18191F] truncate flex-1 ${mono ? "font-mono" : ""}`}>{value}</p>
        {copy && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-[#1B4FFF] hover:text-[#1340CC] flex-shrink-0 cursor-pointer"
            aria-label="Copiar"
          >
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
