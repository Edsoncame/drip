import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada | FLUX",
  description: "La página que buscas no existe.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <Link href="/" className="block mb-10">
          <span className="text-3xl font-900 text-[#18191F] tracking-tight">flux</span>
        </Link>

        <div className="bg-white rounded-3xl p-10 shadow-sm">
          <p className="text-8xl font-900 text-[#1B4FFF] leading-none mb-4">404</p>
          <h1 className="text-2xl font-800 text-[#18191F] mb-2">Página no encontrada</h1>
          <p className="text-[#666666] text-sm mb-8">
            La URL que ingresaste no existe o fue movida. Prueba buscando desde el catálogo.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/laptops"
              className="w-full py-3.5 rounded-full bg-[#1B4FFF] text-white font-700 text-sm hover:bg-[#1340CC] transition-colors text-center"
            >
              Ver MacBooks disponibles
            </Link>
            <Link
              href="/"
              className="w-full py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors text-center"
            >
              Ir al inicio
            </Link>
          </div>
        </div>

        <p className="text-xs text-[#999999] mt-6">
          ¿Necesitas ayuda?{" "}
          <a href="mailto:hola@fluxperu.com" className="text-[#1B4FFF] hover:underline">hola@fluxperu.com</a>
        </p>
      </div>
    </div>
  );
}
