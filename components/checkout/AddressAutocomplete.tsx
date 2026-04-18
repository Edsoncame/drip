"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Autocomplete de direcciones para Lima, alimentado por /api/geocode (proxy
 * a Nominatim/OSM). Estilo Rappi/Uber — el user escribe y abajo se abren
 * resultados con dirección completa + distrito.
 *
 * Cuando elige un resultado, emite onSelect con lat/lng/distrito + el string
 * de dirección. El padre decide qué hacer con eso (setear address, calcular
 * flete, etc.).
 */

export interface AddressSuggestion {
  id: number;
  display: string;
  short: string;
  distrito: string;
  neighborhood: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  error?: boolean;
  placeholder?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  error,
  placeholder,
}: Props) {
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Cerrar cuando click fuera
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    // Si el user acaba de seleccionar, no relanzamos búsqueda hasta que tipee
    // algo distinto.
    if (hasSelected) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!value || value.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 450);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, hasSelected]);

  const pick = useCallback(
    (s: AddressSuggestion) => {
      setHasSelected(true);
      onSelect(s);
      setOpen(false);
    },
    [onSelect],
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setHasSelected(false);
            onChange(e.target.value);
            if (e.target.value.trim().length >= 3) setOpen(true);
          }}
          onFocus={() => value.trim().length >= 3 && results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Ej: Av. Javier Prado 1234, San Isidro"}
          autoComplete="off"
          className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-all ${
            error
              ? "border-red-400 bg-red-50"
              : "border-[#E5E5E5] focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10"
          }`}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999]">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
          </span>
        )}
      </div>

      {open && (results.length > 0 || (!loading && value.trim().length >= 3)) && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-[#E5E5E5] overflow-hidden">
          {results.length === 0 && !loading ? (
            <div className="p-4 text-xs text-[#999999]">
              No encontramos resultados. Intenta con la calle + número + distrito.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-[#F5F8FF] active:bg-[#EEF2FF] cursor-pointer text-left transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#F0F4FF] flex items-center justify-center flex-shrink-0 text-[#1B4FFF]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-600 text-[#18191F] truncate">
                        {r.short}
                      </span>
                      <span className="block text-xs text-[#666666] truncate">
                        {[r.neighborhood, r.distrito, "Lima"].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-3 py-2 border-t border-[#F0F0F0] text-[10px] text-[#999999] flex items-center gap-1">
            <span>Sugerencias vía OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  );
}
