"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Input de teléfono con selector de país.
 *
 * Guarda el valor en formato E.164 sin separadores (ej. "+51987654321")
 * para consistencia en la BD. Internamente maneja el split en prefijo +
 * número nacional.
 *
 * - Default: Perú (+51).
 * - Lista curada de países LATAM + algunos más — no todos los del mundo
 *   para no abrumar.
 * - Dropdown muestra flag + código (ej. "🇵🇪 +51").
 */

export interface Country {
  code: string; // ISO 3166 alpha-2
  name: string;
  dial: string; // con + (ej. "+51")
  flag: string; // emoji
  /** Longitud esperada del número nacional (solo para hints, no validación estricta) */
  digits?: number;
}

export const COUNTRIES: Country[] = [
  { code: "PE", name: "Perú", dial: "+51", flag: "🇵🇪", digits: 9 },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷", digits: 10 },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴", digits: 8 },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷", digits: 11 },
  { code: "CA", name: "Canadá", dial: "+1", flag: "🇨🇦", digits: 10 },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱", digits: 9 },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴", digits: 10 },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷", digits: 8 },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺", digits: 8 },
  { code: "DO", name: "Rep. Dominicana", dial: "+1", flag: "🇩🇴", digits: 10 },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨", digits: 9 },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻", digits: 8 },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸", digits: 9 },
  { code: "US", name: "Estados Unidos", dial: "+1", flag: "🇺🇸", digits: 10 },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹", digits: 8 },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳", digits: 8 },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽", digits: 10 },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮", digits: 8 },
  { code: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦", digits: 8 },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾", digits: 9 },
  { code: "PR", name: "Puerto Rico", dial: "+1", flag: "🇵🇷", digits: 10 },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾", digits: 8 },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪", digits: 10 },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳", digits: 11 },
  { code: "DE", name: "Alemania", dial: "+49", flag: "🇩🇪", digits: 10 },
  { code: "FR", name: "Francia", dial: "+33", flag: "🇫🇷", digits: 9 },
  { code: "IT", name: "Italia", dial: "+39", flag: "🇮🇹", digits: 10 },
  { code: "GB", name: "Reino Unido", dial: "+44", flag: "🇬🇧", digits: 10 },
  { code: "JP", name: "Japón", dial: "+81", flag: "🇯🇵", digits: 10 },
];

const DEFAULT_COUNTRY = COUNTRIES[0]; // Perú

/** Si value es E.164 (+dial + nacional), devuelve el país que matchea y el nacional */
function splitE164(value: string): { country: Country; national: string } {
  if (!value || !value.startsWith("+")) {
    return { country: DEFAULT_COUNTRY, national: value.replace(/\D/g, "") };
  }
  // Matchea el prefijo más largo primero (ej. "+1" y "+506" coexisten)
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { country: c, national: value.slice(c.dial.length).replace(/\D/g, "") };
    }
  }
  return { country: DEFAULT_COUNTRY, national: value.replace(/\D/g, "") };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  error,
  placeholder,
  autoComplete = "tel",
  disabled,
}: Props) {
  const initial = splitE164(value);
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync desde afuera (ej. prefill de /api/auth/me)
  useEffect(() => {
    const s = splitE164(value);
    setCountry((c) => (c.code === s.country.code ? c : s.country));
    setNational((n) => (n === s.national ? n : s.national));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Emit E.164 al padre cada vez que cambie algo
  const emit = (c: Country, nat: string) => {
    const clean = nat.replace(/\D/g, "");
    const out = clean ? `${c.dial}${clean}` : "";
    onChange(out);
  };

  // Cerrar dropdown on click outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filteredCountries = filter
    ? COUNTRIES.filter((c) => {
        const q = filter
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return (
          c.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(q) ||
          c.dial.includes(filter) ||
          c.code.toLowerCase().includes(q)
        );
      })
    : COUNTRIES;

  const hint = country.digits ? `${country.digits} dígitos` : "";

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-stretch rounded-xl border transition-all overflow-hidden ${
          error
            ? "border-red-400 bg-red-50"
            : "border-[#E5E5E5] focus-within:border-[#1B4FFF] focus-within:ring-2 focus-within:ring-[#1B4FFF]/10 bg-white"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 border-r border-[#E5E5E5] text-sm hover:bg-[#F5F5F7] active:bg-[#EEF0F3] cursor-pointer"
          aria-label={`País: ${country.name}`}
        >
          <span className="text-lg leading-none">{country.flag}</span>
          <span className="font-700 text-[#333333] text-sm">{country.dial}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#666"
            strokeWidth="2.5"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <input
          type="tel"
          inputMode="numeric"
          value={national}
          disabled={disabled}
          onChange={(e) => {
            const n = e.target.value.replace(/\D/g, "").slice(0, 15);
            setNational(n);
            emit(country, n);
          }}
          placeholder={placeholder ?? "999 000 000"}
          autoComplete={autoComplete}
          className="flex-1 px-3 py-3 text-sm outline-none bg-transparent"
        />
      </div>
      {hint && !error && (
        <p className="text-[11px] text-[#999999] mt-1">
          {country.flag} {country.name} — {hint}
        </p>
      )}

      {open && !disabled && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-[#E5E5E5] overflow-hidden">
          <div className="p-2 border-b border-[#F0F0F0]">
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar país…"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF]"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <li className="p-4 text-xs text-[#999999]">Sin resultados</li>
            ) : (
              filteredCountries.map((c) => (
                <li key={c.code + c.dial}>
                  <button
                    type="button"
                    onClick={() => {
                      setCountry(c);
                      setOpen(false);
                      setFilter("");
                      emit(c, national);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F5F8FF] active:bg-[#EEF2FF] cursor-pointer text-left ${
                      c.code === country.code ? "bg-[#F5F8FF]" : ""
                    }`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="flex-1 text-sm text-[#18191F]">{c.name}</span>
                    <span className="text-xs font-700 text-[#666666]">{c.dial}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
