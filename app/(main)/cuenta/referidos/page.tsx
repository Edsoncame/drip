"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface ReferralData {
  referralCode: string | null;
  stats: { total: number; rewarded: number };
  referred: { name: string; created_at: string; status: string }[];
}

export default function ReferidosPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/me")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const shareUrl = data?.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth/registro?ref=${data.referralCode}`
    : "";

  const copyCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/cuenta" className="text-[#999999] hover:text-[#1B4FFF] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-800 text-[#18191F]">Programa de referidos</h1>
          <p className="text-sm text-[#666666]">Invita amigos y gana beneficios juntos</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-[#F0F0F0] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* How it works */}
          <div className="bg-gradient-to-br from-[#1B4FFF] to-[#0F3ACC] rounded-2xl p-6 mb-6 text-white">
            <h2 className="font-800 text-lg mb-4">¿Cómo funciona?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Comparte tu código", desc: "Envía tu enlace a colegas o amigos" },
                { step: "2", title: "Ellos se registran", desc: "Se crean una cuenta con tu código" },
                { step: "3", title: "Ambos ganan", desc: "Descuentos en tu próximo mes de renta" },
              ].map(s => (
                <div key={s.step} className="bg-white/10 rounded-xl p-4">
                  <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-800 mb-2">
                    {s.step}
                  </div>
                  <p className="font-700 text-sm mb-1">{s.title}</p>
                  <p className="text-xs text-white/70">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* My code */}
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
            <h2 className="font-700 text-[#18191F] mb-1">Tu código único</h2>
            <p className="text-sm text-[#666666] mb-4">Comparte este enlace directo o el código al registrarse.</p>

            {data?.referralCode ? (
              <>
                <div className="flex items-center gap-3 bg-[#F7F7F7] rounded-xl px-4 py-3 mb-3">
                  <span className="font-800 text-[#1B4FFF] text-xl tracking-widest flex-1">
                    {data.referralCode}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={copyCode}
                    className="flex-shrink-0 px-4 py-2 rounded-full bg-[#1B4FFF] text-white text-xs font-700 hover:bg-[#1340CC] transition-colors cursor-pointer"
                  >
                    {copied ? "¡Copiado!" : "Copiar enlace"}
                  </motion.button>
                </div>
                <p className="text-xs text-[#999999] break-all">{shareUrl}</p>
              </>
            ) : (
              <p className="text-sm text-[#999999]">Código no disponible aún. Contáctanos.</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: "Referidos totales", value: data?.stats.total ?? 0, icon: "👥" },
              { label: "Recompensas ganadas", value: data?.stats.rewarded ?? 0, icon: "🎁" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-[#E5E5E5] rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">{stat.icon}</div>
                <p className="text-3xl font-900 text-[#18191F]">{stat.value}</p>
                <p className="text-xs text-[#999999] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Referred users list */}
          {(data?.referred?.length ?? 0) > 0 && (
            <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0F0F0]">
                <h2 className="font-700 text-[#18191F]">Mis referidos</h2>
              </div>
              <div className="divide-y divide-[#F0F0F0]">
                {data!.referred.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#EEF2FF] rounded-full flex items-center justify-center text-sm font-700 text-[#1B4FFF]">
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-600 text-[#18191F]">{r.name}</p>
                        <p className="text-xs text-[#999999]">
                          {new Date(r.created_at).toLocaleDateString("es-PE", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-600 px-2.5 py-1 rounded-full ${
                      r.status === "rewarded"
                        ? "bg-green-50 text-green-700"
                        : "bg-[#F5F5F7] text-[#999999]"
                    }`}>
                      {r.status === "rewarded" ? "Recompensado" : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data?.referred?.length ?? 0) === 0 && (
            <div className="text-center py-12 bg-white border border-[#E5E5E5] rounded-2xl">
              <div className="text-5xl mb-3">🚀</div>
              <p className="font-700 text-[#18191F] mb-1">Aún no tienes referidos</p>
              <p className="text-sm text-[#999999]">Comparte tu código y empieza a ganar.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
