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
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [colabValue, setColabValue] = useState(colaborador ?? "");
  const [areaValue, setAreaValue] = useState(area ?? "");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="mt-5 pt-5 border-t border-[#F0F0F0]">
      {/* Compact header: code + collaborator */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 text-left cursor-pointer group"
      >
        <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-[#1B4FFF]/10 text-[#1B4FFF] text-xs font-700 font-mono">
          {equipmentCode}
        </div>
        {isCompany && colaborador && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-600 text-[#18191F] truncate">
              {colaborador}{area ? ` · ${area}` : ""}
            </p>
          </div>
        )}
        {isCompany && !colaborador && (
          <p className="text-sm text-[#999999] italic flex-1">Sin asignar — click para editar</p>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#999] flex-shrink-0 transition-transform group-hover:text-[#1B4FFF] ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Editable assignment for empresa */}
          {isCompany && (
            <div className="bg-[#F5F8FF] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider">Asignación</p>
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
                <div className="space-y-2">
                  <input
                    type="text"
                    value={colabValue}
                    onChange={(e) => setColabValue(e.target.value)}
                    placeholder="Colaborador (ej: María García)"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded-lg outline-none focus:border-[#1B4FFF]"
                  />
                  <input
                    type="text"
                    value={areaValue}
                    onChange={(e) => setAreaValue(e.target.value)}
                    placeholder="Área (ej: Marketing)"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded-lg outline-none focus:border-[#1B4FFF]"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-lg hover:bg-[#1340CC] disabled:opacity-60 cursor-pointer"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setColabValue(colaborador ?? "");
                        setAreaValue(area ?? "");
                      }}
                      className="px-4 py-2 text-xs font-600 text-[#666] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[11px] text-[#666]">Colaborador</p>
                    <p className="font-600 text-[#18191F]">{colaborador || <span className="text-[#BBB]">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666]">Área</p>
                    <p className="font-600 text-[#18191F]">{area || <span className="text-[#BBB]">—</span>}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Device credentials */}
          {(usuarioDispositivo || claveDispositivo) && (
            <div className="bg-[#FFF8E1] rounded-xl p-4">
              <p className="text-xs font-700 text-[#92400E] uppercase tracking-wider mb-2">🔐 Acceso al equipo</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {usuarioDispositivo && (
                  <div>
                    <p className="text-[11px] text-[#92400E]/70">Usuario</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono font-600 text-[#18191F]">{usuarioDispositivo}</p>
                      <button onClick={() => copy(usuarioDispositivo, "user")} className="text-[#92400E]/60 hover:text-[#92400E]">
                        {copied === "user" ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>
                )}
                {claveDispositivo && (
                  <div>
                    <p className="text-[11px] text-[#92400E]/70">Contraseña</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono font-600 text-[#18191F]">
                        {showPassword ? claveDispositivo : "••••••••"}
                      </p>
                      <button onClick={() => setShowPassword(!showPassword)} className="text-[#92400E]/60 hover:text-[#92400E]">
                        👁
                      </button>
                      <button onClick={() => copy(claveDispositivo, "pass")} className="text-[#92400E]/60 hover:text-[#92400E]">
                        {copied === "pass" ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hardware specs — compact list */}
          <div className="bg-[#F7F7F7] rounded-xl p-4">
            <p className="text-xs font-700 text-[#666] uppercase tracking-wider mb-2">Especificaciones</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {numeroSerie && (
                <>
                  <dt className="text-[#999]">N° Serie</dt>
                  <dd className="font-mono font-600 text-[#18191F] flex items-center gap-1">
                    {numeroSerie}
                    <button onClick={() => copy(numeroSerie, "serie")} className="text-[#BBB] hover:text-[#1B4FFF]">
                      {copied === "serie" ? "✓" : "📋"}
                    </button>
                  </dd>
                </>
              )}
              {modelo && <><dt className="text-[#999]">Modelo</dt><dd className="font-600 text-[#18191F]">{modelo}</dd></>}
              {color && <><dt className="text-[#999]">Color</dt><dd className="font-600 text-[#18191F]">{color}</dd></>}
              {teclado && <><dt className="text-[#999]">Teclado</dt><dd className="font-600 text-[#18191F]">{teclado}</dd></>}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
