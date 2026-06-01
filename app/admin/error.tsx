"use client";

import { useEffect } from "react";

/**
 * Error boundary del admin. En vez de dejar la página en blanco (o que el
 * navegador muestre "This page couldn't load"), captura el error de render y
 * muestra el mensaje real, para poder diagnosticar.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin/error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#E5E5E5] max-w-lg w-full p-6 text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <h1 className="text-xl font-800 text-[#18191F] mb-1">Algo falló en esta pantalla</h1>
        <p className="text-sm text-[#666] mb-4">Esto es el error real (cópialo y mándamelo):</p>
        <pre className="text-left text-xs bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-3 overflow-auto max-h-48 text-red-700 whitespace-pre-wrap">
          {error.message || "Error desconocido"}{error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="flex gap-3 justify-center mt-4">
          <button onClick={() => reset()} className="px-5 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] cursor-pointer">Reintentar</button>
          <a href="/admin" className="px-5 py-2 border border-[#E5E5E5] text-sm font-700 rounded-full text-[#666] hover:bg-[#F7F7F7]">Ir al panel</a>
        </div>
      </div>
    </div>
  );
}
