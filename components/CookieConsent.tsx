"use client";

/**
 * Banner de consentimiento de cookies.
 *
 * Aparece la primera vez que un visitante entra al sitio. Guarda la decisión
 * en localStorage para no mostrarlo de nuevo. Es un banner simple — no un
 * gestor avanzado tipo OneTrust — pero cumple con los requisitos básicos de
 * INDECOPI / Ley de protección de datos personales del Perú (Ley 29733).
 *
 * Si el usuario rechaza, se setea una cookie `cookies_consent=false` que el
 * código de tracking puede leer para no disparar eventos de analytics.
 */

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "flux_cookies_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar si el usuario nunca decidió antes
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Pequeño retraso para no aparecer junto al hero (mejor UX)
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    document.cookie = `${STORAGE_KEY}=accepted; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setVisible(false);
  };

  const reject = () => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    document.cookie = `${STORAGE_KEY}=rejected; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 bg-white border border-[#E5E5E5] rounded-2xl shadow-xl p-5"
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl flex-shrink-0">🍪</span>
        <div>
          <p id="cookie-title" className="font-700 text-[#18191F] text-sm mb-1">
            Usamos cookies
          </p>
          <p className="text-xs text-[#666] leading-relaxed">
            FLUX usa cookies para mejorar tu experiencia, recordar tus preferencias y analizar
            cómo navegas el sitio. Lee nuestra{" "}
            <Link href="/privacidad" className="text-[#1B4FFF] hover:underline">
              política de privacidad
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reject}
          className="flex-1 py-2 text-xs font-700 text-[#666] border border-[#E5E5E5] rounded-full hover:bg-[#F7F7F7] cursor-pointer"
        >
          Solo esenciales
        </button>
        <button
          type="button"
          onClick={accept}
          className="flex-1 py-2 text-xs font-700 text-white bg-[#1B4FFF] rounded-full hover:bg-[#1340CC] cursor-pointer"
        >
          Aceptar todas
        </button>
      </div>
    </div>
  );
}
