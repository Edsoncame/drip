"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  subscriptionId: string;
  productName: string;
  months: number;
  monthlyPrice: number;
  daysLeft: number;
  deliveryAddress: string | null;
  deliveryDistrito: string | null;
  endAction: string | null;
  purchasePrice: number;
}

export default function EndOfContractActions({
  subscriptionId, productName, months, monthlyPrice,
  daysLeft, deliveryAddress, deliveryDistrito, endAction, purchasePrice,
}: Props) {
  const maxReached = endAction === "max_reached";
  const router = useRouter();
  const [action, setAction] = useState<"return" | "purchase" | null>(null);
  const [returnMethod, setReturnMethod] = useState<"pickup" | "office">("pickup");
  const [returnAddress, setReturnAddress] = useState(deliveryAddress ?? "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(endAction && endAction !== "auto_extend" ? endAction : null);

  const handleReturn = async () => {
    setLoading(true);
    const res = await fetch(`/api/rentals/${subscriptionId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: returnMethod, address: returnAddress }),
    });
    if (res.ok) {
      setDone("return");
      setAction(null);
      router.refresh();
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    setLoading(true);
    const res = await fetch(`/api/rentals/${subscriptionId}/purchase`, {
      method: "POST",
    });
    if (res.ok) {
      setDone("purchase");
      setAction(null);
      router.refresh();
    }
    setLoading(false);
  };

  // Already submitted
  if (done === "return") {
    return (
      <div className="mt-5 pt-5 border-t border-[#F0F0F0]">
        <div className="bg-[#E5F3DF] rounded-2xl p-5 flex items-center gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <p className="font-700 text-[#2D7D46]">Devolución en proceso</p>
            <p className="text-sm text-[#666666]">Te contactaremos por WhatsApp para coordinar el recojo.</p>
          </div>
        </div>
      </div>
    );
  }

  if (done === "purchase") {
    return (
      <div className="mt-5 pt-5 border-t border-[#F0F0F0]">
        <div className="bg-[#EEF2FF] rounded-2xl p-5 flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="font-700 text-[#1B4FFF]">Compra en proceso — ${purchasePrice} USD</p>
            <p className="text-sm text-[#666666]">Te contactaremos para coordinar el pago.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-[#F0F0F0]">
      <div className={`rounded-2xl p-5 ${maxReached ? "bg-red-50 border border-red-200" : daysLeft <= 0 ? "bg-orange-50 border border-orange-200" : "bg-[#F5F8FF] border border-[#DDEAFF]"}`}>
        <h3 className="font-700 text-[#18191F] mb-1">
          {maxReached
            ? "Tu renta llegó al plazo máximo"
            : daysLeft <= 0
              ? "Tu contrato ha vencido"
              : `Tu contrato vence en ${daysLeft} días`}
        </h3>
        <p className="text-sm text-[#666666] mb-4">
          {maxReached
            ? "Debes comprar o devolver el equipo. Si no decides en 30 días, se cobrará automáticamente el valor de compra."
            : daysLeft <= 0
              ? "Mientras decides, tu renta sigue activa mes a mes. Elige cuando estés listo:"
              : "Tu renta se extenderá automáticamente mes a mes. O puedes elegir:"}
        </p>

        <AnimatePresence mode="wait">
          {!action && (
            <motion.div
              key="options"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Return */}
              <button
                onClick={() => setAction("return")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#E5E5E5] bg-white hover:border-[#1B4FFF] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 bg-[#F0F0F0] rounded-xl flex items-center justify-center text-xl flex-shrink-0">↩️</div>
                <div className="flex-1">
                  <p className="font-700 text-[#18191F] text-sm">Devolver equipo</p>
                  <p className="text-xs text-[#666666]">Sin costo. Coordinamos el recojo o lo traes a oficina.</p>
                </div>
                <span className="text-sm font-700 text-[#2D7D46]">Gratis</span>
              </button>

              {/* Purchase */}
              <button
                onClick={() => setAction("purchase")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#1B4FFF] bg-[#EEF2FF] hover:bg-[#DDEAFF] transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 bg-[#1B4FFF]/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">💰</div>
                <div className="flex-1">
                  <p className="font-700 text-[#18191F] text-sm">Comprar este equipo</p>
                  <p className="text-xs text-[#666666]">Quédate con tu Mac para siempre.</p>
                </div>
                <span className="text-lg font-800 text-[#1B4FFF]">${purchasePrice}</span>
              </button>

              {/* Continue — only if NOT at max */}
              {!maxReached && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F7F7F7]">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl flex-shrink-0">🔄</div>
                  <div className="flex-1">
                    <p className="font-700 text-[#18191F] text-sm">Seguir rentando</p>
                    <p className="text-xs text-[#666666]">No hagas nada. Tu renta sigue mes a mes automáticamente.</p>
                  </div>
                  <span className="text-sm font-700 text-[#333333]">${monthlyPrice}/mes</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Return form */}
          {action === "return" && (
            <motion.div
              key="return-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h4 className="font-700 text-[#18191F]">¿Cómo prefieres devolver tu {productName}?</h4>

              <button
                onClick={() => setReturnMethod("pickup")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  returnMethod === "pickup" ? "border-[#1B4FFF] bg-[#EEF2FF]" : "border-[#E5E5E5] hover:border-[#BBCAFF]"
                }`}
              >
                <div className="w-10 h-10 bg-[#F0F0F0] rounded-xl flex items-center justify-center text-xl flex-shrink-0">🚚</div>
                <div className="flex-1">
                  <p className="font-700 text-[#18191F] text-sm">FLUX lo recoge</p>
                  <p className="text-xs text-[#666666]">Enviamos a alguien a tu dirección. Gratis.</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  returnMethod === "pickup" ? "border-[#1B4FFF]" : "border-[#CCCCCC]"
                }`}>
                  {returnMethod === "pickup" && <div className="w-2.5 h-2.5 rounded-full bg-[#1B4FFF]" />}
                </div>
              </button>

              <button
                onClick={() => setReturnMethod("office")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  returnMethod === "office" ? "border-[#1B4FFF] bg-[#EEF2FF]" : "border-[#E5E5E5] hover:border-[#BBCAFF]"
                }`}
              >
                <div className="w-10 h-10 bg-[#F0F0F0] rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏢</div>
                <div className="flex-1">
                  <p className="font-700 text-[#18191F] text-sm">Lo llevo a la oficina</p>
                  <p className="text-xs text-[#666666]">Lunes a viernes, 9am – 6pm. Lima.</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  returnMethod === "office" ? "border-[#1B4FFF]" : "border-[#CCCCCC]"
                }`}>
                  {returnMethod === "office" && <div className="w-2.5 h-2.5 rounded-full bg-[#1B4FFF]" />}
                </div>
              </button>

              {returnMethod === "pickup" && (
                <div>
                  <label className="block text-sm font-600 text-[#333333] mb-1">
                    Dirección de recojo
                  </label>
                  <input
                    type="text"
                    value={returnAddress}
                    onChange={(e) => setReturnAddress(e.target.value)}
                    placeholder="Av. Javier Prado 1234, San Isidro"
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-sm outline-none focus:border-[#1B4FFF] focus:ring-2 focus:ring-[#1B4FFF]/10 transition-all"
                  />
                  {deliveryDistrito && (
                    <p className="text-xs text-[#999999] mt-1">Última dirección registrada: {deliveryAddress}, {deliveryDistrito}</p>
                  )}
                </div>
              )}

              {/* Checklist reminder */}
              <div className="bg-[#FFF8E1] rounded-xl p-4">
                <p className="text-sm font-700 text-[#92400E] mb-2">Antes de devolver, recuerda:</p>
                <ul className="space-y-1 text-xs text-[#92400E]">
                  <li>✓ Respalda tu información</li>
                  <li>✓ Cierra sesión en tus cuentas</li>
                  <li>✓ Desactiva &quot;Buscar mi Mac&quot;</li>
                  <li>✓ Restaura de fábrica</li>
                  <li>✓ Incluye cargador y cable original</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReturn}
                  disabled={loading || (returnMethod === "pickup" && !returnAddress.trim())}
                  className="flex-1 py-3 rounded-full bg-[#1B4FFF] text-white font-700 text-sm hover:bg-[#1340CC] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Procesando..." : "Confirmar devolución"}
                </button>
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm cursor-pointer"
                >
                  Volver
                </button>
              </div>
            </motion.div>
          )}

          {/* Purchase confirmation */}
          {action === "purchase" && (
            <motion.div
              key="purchase-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h4 className="font-700 text-[#18191F]">Confirma tu compra</h4>

              <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 text-center">
                <p className="text-sm text-[#666666] mb-1">{productName}</p>
                <p className="text-3xl font-900 text-[#1B4FFF] mb-1">${purchasePrice} USD</p>
                <p className="text-xs text-[#999999]">Precio de compra</p>
              </div>

              <div className="bg-[#F7F7F7] rounded-xl p-4">
                <p className="text-sm text-[#666666] leading-relaxed">
                  Al confirmar, nuestro equipo te contactará por WhatsApp para coordinar el pago.
                  Una vez pagado, removemos el MDM y el equipo es 100% tuyo.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePurchase}
                  disabled={loading}
                  className="flex-1 py-3 rounded-full bg-[#1B4FFF] text-white font-700 text-sm hover:bg-[#1340CC] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Procesando..." : "Quiero comprar"}
                </button>
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm cursor-pointer"
                >
                  Volver
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
