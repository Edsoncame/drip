"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function CancelSubscriptionButton({ subscriptionId }: { subscriptionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al cancelar."); setLoading(false); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-600 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
      >
        Cancelar renta
      </button>

      {/* Confirm modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => !loading && setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-800 text-[#18191F] mb-2">¿Cancelar esta renta?</h3>
              <p className="text-sm text-[#666666] mb-6">
                La cancelación aplicará con <strong>30 días de aviso</strong>. Podrás seguir usando el equipo hasta que se procese. ¿Estás seguro?
              </p>
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3 mb-4">{error}</p>}
              <div className="flex flex-col gap-3">
                <motion.button
                  onClick={handleCancel}
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3.5 rounded-full bg-red-600 text-white font-700 hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>Cancelando…</>
                  ) : "Sí, cancelar renta"}
                </motion.button>
                <button
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="w-full py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors cursor-pointer"
                >
                  No, mantener renta
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
