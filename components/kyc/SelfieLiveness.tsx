"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Selfie con liveness challenge: el usuario mira al frente, gira a la izquierda,
 * mira al frente, gira a la derecha. Capturamos 3 frames en los 3 momentos.
 *
 * Backend (AWS Rekognition DetectFaces) valida:
 *   - Los 3 frames tienen cara detectable
 *   - El yaw (rotación horizontal) cambia entre frames → no es foto estática
 *   - La cara es la misma persona en los 3 (Rekognition compare interno)
 *
 * Esto es liveness "básico" — resiste foto impresa pero no video deepfake.
 * Para defensas más duras se necesita un SDK dedicado (AWS Liveness, FaceTec).
 */

type Step = "intro" | "permitting" | "center" | "left" | "right" | "uploading" | "done" | "error";

interface Props {
  correlationId: string;
  onComplete: (result: { passed: boolean; score: number; selfieUrl: string }) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

export default function SelfieLiveness({ correlationId, onComplete, onCancel, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const grabFrame = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
    });
  }, []);

  const startCamera = useCallback(async () => {
    setStep("permitting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Tu navegador no soporta cámara");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Arrancar secuencia: center → left → right con 2s cada uno
      setStep("center");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")) {
        setError("Permiso de cámara denegado. Habilitalo en los ajustes del navegador.");
      } else if (msg.includes("NotFound")) {
        setError("No encontramos cámara frontal en este dispositivo.");
      } else {
        setError("No se pudo abrir la cámara.");
      }
      setStep("error");
    }
  }, []);

  // Secuencia de captura
  useEffect(() => {
    if (step !== "center" && step !== "left" && step !== "right") return;

    let cancelled = false;
    const run = async () => {
      // Countdown visible de 2s antes de capturar
      for (let s = 2; s > 0; s--) {
        if (cancelled) return;
        setCountdown(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(null);
      if (cancelled) return;
      const blob = await grabFrame();
      if (blob) framesRef.current.push(blob);

      // Avanzar
      if (step === "center") setStep("left");
      else if (step === "left") setStep("right");
      else if (step === "right") {
        // Último frame → subir
        await uploadFrames();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, grabFrame]);

  const uploadFrames = useCallback(async () => {
    setStep("uploading");
    stop();
    try {
      const form = new FormData();
      form.append("correlation_id", correlationId);
      framesRef.current.forEach((blob, i) => {
        form.append(`frame_${i}`, blob, `selfie-${i}.jpg`);
      });
      const res = await fetch("/api/kyc/selfie", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Error al procesar la selfie";
        setError(msg);
        setStep("error");
        onError?.(msg);
        return;
      }
      setStep("done");
      onComplete({
        passed: data.passed,
        score: data.score,
        selfieUrl: data.selfie_url ?? "",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setError(msg);
      setStep("error");
      onError?.(msg);
    }
  }, [correlationId, onComplete, onError, stop]);

  const instruction =
    step === "intro"
      ? "Vamos a validar que sos vos con 3 capturas rápidas. Mantené buena luz y mirá a la cámara."
      : step === "permitting"
        ? "Permitiendo cámara…"
        : step === "center"
          ? "Mirá al frente"
          : step === "left"
            ? "Girá la cabeza a la izquierda"
            : step === "right"
              ? "Girá la cabeza a la derecha"
              : step === "uploading"
                ? "Verificando…"
                : step === "done"
                  ? "Listo ✓"
                  : error ?? "Error";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="p-4 flex items-center justify-between text-white">
        <h3 className="font-800 text-lg">Selfie con liveness</h3>
        <button
          onClick={() => {
            stop();
            onCancel();
          }}
          className="text-white/70 hover:text-white text-sm underline"
        >
          Cancelar
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        {step === "intro" && (
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">🤳</div>
            <h2 className="text-2xl font-800 text-white mb-4">Validación con tu cara</h2>
            <p className="text-white/80 text-sm mb-6 leading-relaxed">{instruction}</p>
            <ul className="text-left text-white/70 text-sm space-y-2 mb-8">
              <li>• Sacate lentes y gorra</li>
              <li>• Iluminación uniforme (nada de contraluz)</li>
              <li>• Seguí las instrucciones que aparezcan</li>
            </ul>
            <button
              onClick={startCamera}
              className="w-full py-3 rounded-full bg-white text-black font-700 text-sm"
            >
              Comenzar
            </button>
          </div>
        )}

        {(step === "permitting" ||
          step === "center" ||
          step === "left" ||
          step === "right" ||
          step === "uploading" ||
          step === "done") && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            />
            {/* Oval overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/80"
                style={{ width: "60%", aspectRatio: "0.78", maxWidth: "320px" }}
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
            <div className="relative z-10 bg-black/60 backdrop-blur rounded-2xl px-6 py-4 text-center">
              <p className="text-white text-lg font-700">{instruction}</p>
              {countdown !== null && (
                <p className="text-white/80 text-3xl font-800 mt-2">{countdown}</p>
              )}
              {step === "uploading" && (
                <svg
                  className="animate-spin w-5 h-5 text-white mx-auto mt-3"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="30 70"
                  />
                </svg>
              )}
            </div>
          </>
        )}

        {step === "error" && (
          <div className="text-center p-8 max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-white text-base mb-6">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-full border border-white/30 text-white font-700 text-sm"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  framesRef.current = [];
                  setError(null);
                  startCamera();
                }}
                className="flex-1 py-3 rounded-full bg-white text-black font-700 text-sm"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
