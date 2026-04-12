"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadReceipt({ paymentId, hasReceipt }: { paymentId: string; hasReceipt: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(hasReceipt);

  const handleUpload = async (file: File) => {
    setUploading(true);

    // Convert to base64
    const form = new FormData();
    form.append("file", file);
    const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
    const uploadData = await uploadRes.json();

    if (!uploadData.dataUrl) {
      setUploading(false);
      return;
    }

    // Save receipt to payment
    const res = await fetch(`/api/payments/${paymentId}/receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptUrl: uploadData.dataUrl }),
    });

    if (res.ok) {
      setDone(true);
      router.refresh();
    }
    setUploading(false);
  };

  if (done) {
    return (
      <div className="bg-[#DBEAFE] rounded-xl p-3 flex items-center gap-2">
        <span>⏳</span>
        <p className="text-sm text-[#1D4ED8] font-600">Comprobante enviado. Estamos revisándolo.</p>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-[#CCCCCC] hover:border-[#1B4FFF] hover:bg-[#F5F8FF] transition-all cursor-pointer">
      <input
        type="file"
        accept="image/*,.pdf"
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />
      <div className="w-10 h-10 bg-[#F0F0F0] rounded-xl flex items-center justify-center flex-shrink-0">
        {uploading ? (
          <svg className="animate-spin w-5 h-5 text-[#1B4FFF]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-700 text-[#333333]">{uploading ? "Subiendo..." : "Subir comprobante de pago"}</p>
        <p className="text-xs text-[#999999]">Foto de la transferencia o captura del voucher</p>
      </div>
    </label>
  );
}
