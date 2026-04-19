import type { Metadata } from "next";
import ReclamacionForm from "./ReclamacionForm";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones | FLUX",
  description:
    "Conforme al Código de Protección y Defensa del Consumidor (Ley 29571), pone a disposición el Libro de Reclamaciones virtual de Tika Services S.A.C. (FLUX).",
  robots: { index: true, follow: true },
};

export default function ReclamacionesPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 sm:py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-10 mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-800 text-[#18191F]">Libro de Reclamaciones</h1>
          <p className="text-sm text-[#666] mt-2 max-w-xl mx-auto">
            Conforme al <strong>Código de Protección y Defensa del Consumidor (Ley 29571)</strong>, FLUX
            (Tika Services S.A.C., RUC 20605702512) pone a disposición el Libro de Reclamaciones virtual.
            Responderemos tu reclamo en un plazo máximo de <strong>30 días hábiles</strong>.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8">
          <ReclamacionForm />
        </div>

        <div className="text-center mt-6 text-xs text-[#999]">
          <p>FLUX · Tika Services S.A.C. · Lima, Perú</p>
          <p>La presentación del reclamo no impide el derecho de recurrir a <a className="text-[#1B4FFF]" href="https://www.consumidor.gob.pe" target="_blank" rel="noreferrer">consumidor.gob.pe</a> (Indecopi).</p>
        </div>
      </div>
    </div>
  );
}
