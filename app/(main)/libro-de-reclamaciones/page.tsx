import type { Metadata } from "next";
import ReclamacionesForm from "./ReclamacionesForm";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones | FLUX",
  description:
    "Libro de Reclamaciones virtual de FLUX (Tika Services S.A.C.) — Conforme a la Ley N° 29571 del Código de Protección y Defensa del Consumidor.",
};

export default function LibroReclamacionesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#1B4FFF]/10 flex items-center justify-center flex-shrink-0">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-800 text-[#18191F]">Libro de Reclamaciones</h1>
          <p className="text-sm text-[#666] mt-1">Conforme a la Ley N° 29571 del Código de Protección y Defensa del Consumidor</p>
        </div>
      </div>

      <div className="bg-[#F5F8FF] border border-[#1B4FFF]/20 rounded-2xl p-5 mb-8 text-sm text-[#333]">
        <p className="mb-2"><strong>Tika Services S.A.C.</strong> — RUC 20605702512</p>
        <p className="mb-2">Av. Primavera 543, Piso 4, San Borja, Lima, Perú</p>
        <p className="text-xs text-[#666] mt-3">
          Si tienes una queja o reclamo sobre nuestros productos o servicios, completa este formulario.
          Te responderemos en un plazo máximo de <strong>30 días calendario</strong> al correo que nos proporciones.
        </p>
      </div>

      <ReclamacionesForm />
    </div>
  );
}
