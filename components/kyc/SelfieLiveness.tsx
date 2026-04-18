"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Verificación facial con liveness por pose.
 *
 * Capturamos 3 frames: centro → izquierda → derecha. El backend valida con
 * AWS Rekognition que los yaw de los 3 frames sean consistentes (no es una
 * foto estática) y compara con la foto del DNI.
 *
 * UX:
 *   - Pantalla "Prepárate" con los 3 pasos dibujados antes de arrancar
 *   - Barra de progreso visual entre pasos (no countdown numérico que asusta)
 *   - Instrucción grande, fija por 2-3s para que el usuario procese antes
 *   - Feedback "Capturado ✓" entre pasos
 */

type Step = "intro" | "permitting" | "center" | "left" | "right" | "uploading" | "done" | "error";

interface Props {
  correlationId: string;
  onComplete: (result: { passed: boolean; score: number; selfieUrl: string }) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

// Tiempo que el usuario ve la instrucción ANTES de la captura, para que
// acomode la pose sin apuro.
const PREP_MS = 2400;
// Mini feedback "Capturado ✓" entre pasos
const ACK_MS = 700;

export default function SelfieLiveness({
  correlationId,
  onComplete,
  onCancel,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Blob[]>([]);

  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 de la prep bar
  const [ack, setAck] = useState(false); // flash "Capturado ✓"

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

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
    setErrorDetail(null);
    framesRef.current = [];
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Tu navegador no soporta cámara.");
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
      setStep("center");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")) {
        setError("Permiso de cámara denegado. Habilítalo en los ajustes del navegador.");
      } else if (msg.includes("NotFound")) {
        setError("No encontramos cámara frontal en este dispositivo.");
      } else {
        setError("No se pudo abrir la cámara.");
      }
      setStep("error");
    }
  }, []);

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
        setErrorDetail(
          data.category === "unknown" && data.debug?.original
            ? data.debug.original
            : null,
        );
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

  // Secuencia de captura — con prep bar visible y "Capturado ✓" entre pasos.
  useEffect(() => {
    if (step !== "center" && step !== "left" && step !== "right") return;

    let cancelled = false;
    let raf: number | null = null;
    const start = Date.now();

    const animate = () => {
      if (cancelled) return;
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / PREP_MS);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(animate);
      }
    };
    raf = requestAnimationFrame(animate);

    const run = async () => {
      await new Promise((r) => setTimeout(r, PREP_MS));
      if (cancelled) return;
      const blob = await grabFrame();
      if (blob) framesRef.current.push(blob);

      // Mini ack "Capturado ✓"
      setAck(true);
      await new Promise((r) => setTimeout(r, ACK_MS));
      setAck(false);
      setProgress(0);
      if (cancelled) return;

      if (step === "center") setStep("left");
      else if (step === "left") setStep("right");
      else if (step === "right") await uploadFrames();
    };
    run();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [step, grabFrame, uploadFrames]);

  const currentStepNumber = step === "center" ? 1 : step === "left" ? 2 : step === "right" ? 3 : 0;
  const instructionMain =
    step === "permitting"
      ? "Permitiendo acceso a la cámara…"
      : step === "center"
        ? "Mira de frente a la cámara"
        : step === "left"
          ? "Gira suavemente a la izquierda"
          : step === "right"
            ? "Gira suavemente a la derecha"
            : step === "uploading"
              ? "Verificando tu identidad…"
              : step === "done"
                ? "¡Listo!"
                : "";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="relative z-10 p-4 flex items-center justify-between text-white">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/50">Paso 2 de 2</p>
          <h3 className="font-800 text-lg leading-tight">Verifica tu rostro</h3>
        </div>
        <button
          onClick={() => {
            stop();
            onCancel();
          }}
          className="w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* Intro */}
      {step === "intro" && (
        <div className="flex-1 overflow-auto px-6 pb-8">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-800 text-white mb-2 mt-4">
              Vamos a confirmar que eres tú
            </h2>
            <p className="text-white/70 text-sm mb-8 leading-relaxed">
              Tomaremos 3 fotos con tu cámara frontal. Sigue las instrucciones que verás en pantalla.
            </p>

            {/* Preview visual de los 3 pasos */}
            <div className="bg-white/5 rounded-2xl p-5 mb-6">
              <p className="text-white text-sm font-700 mb-4">Cómo funciona</p>
              <div className="space-y-4">
                <StepRow num={1} label="Mira de frente" pose="center" />
                <StepRow num={2} label="Gira suavemente a la izquierda" pose="left" />
                <StepRow num={3} label="Gira suavemente a la derecha" pose="right" />
              </div>
            </div>

            {/* Tips */}
            <div className="bg-white/5 rounded-2xl p-5 mb-8">
              <p className="text-white text-sm font-700 mb-3">Antes de empezar</p>
              <ul className="text-white/70 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Quítate lentes, gorra o cualquier accesorio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Busca una zona con buena luz, sin contraluz</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Mantén tu cara dentro del óvalo que te mostraremos</span>
                </li>
              </ul>
            </div>

            <button
              onClick={startCamera}
              className="w-full py-4 rounded-full bg-white text-black font-800 text-base shadow-lg active:scale-[0.98] transition-transform"
            >
              Empezar verificación
            </button>
          </div>
        </div>
      )}

      {/* Captura */}
      {(step === "permitting" ||
        step === "center" ||
        step === "left" ||
        step === "right" ||
        step === "uploading" ||
        step === "done") && (
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          {/* Overlay oscuro con recorte del óvalo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 38% 28% at center, transparent 60%, rgba(0,0,0,0.7) 100%)",
            }}
          />
          {/* Óvalo de referencia con indicador de pose */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="relative rounded-full border-[3px]"
              style={{
                width: "62%",
                aspectRatio: "0.78",
                maxWidth: "320px",
                borderColor: ack ? "#22C55E" : "rgba(255,255,255,0.9)",
                boxShadow: ack ? "0 0 24px rgba(34,197,94,0.6)" : "none",
                transition: "border-color 200ms ease, box-shadow 200ms ease",
              }}
            >
              {/* Flechas que indican hacia dónde girar */}
              {step === "left" && !ack && (
                <ArrowIndicator direction="left" />
              )}
              {step === "right" && !ack && (
                <ArrowIndicator direction="right" />
              )}
            </div>
          </div>

          {/* Instrucción principal + prep bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md px-6">
            <div className="bg-black/70 backdrop-blur rounded-2xl px-5 py-4">
              {currentStepNumber > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className="h-1 flex-1 rounded-full"
                      style={{
                        background:
                          n < currentStepNumber
                            ? "#22C55E"
                            : n === currentStepNumber
                              ? `linear-gradient(to right, #22C55E ${progress * 100}%, rgba(255,255,255,0.25) ${progress * 100}%)`
                              : "rgba(255,255,255,0.25)",
                      }}
                    />
                  ))}
                </div>
              )}
              <p className="text-white text-lg font-700 leading-tight">
                {ack ? "Capturado ✓" : instructionMain}
              </p>
              {step === "uploading" && (
                <div className="flex items-center gap-2 mt-2">
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  <p className="text-white/70 text-xs">Esto toma unos segundos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="flex-1 overflow-auto p-6 flex items-center">
          <div className="max-w-md mx-auto text-center w-full">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-white text-base mb-3 whitespace-pre-line">{error}</p>
            {errorDetail && (
              <p className="text-white/50 text-xs mb-6 break-words">
                [técnico] {errorDetail}
              </p>
            )}
            <div className="flex gap-3 mt-2">
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
                  setErrorDetail(null);
                  startCamera();
                }}
                className="flex-1 py-3 rounded-full bg-white text-black font-700 text-sm"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepRow({
  num,
  label,
  pose,
}: {
  num: number;
  label: string;
  pose: "center" | "left" | "right";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-white/10 text-white text-xs font-800 flex items-center justify-center flex-shrink-0">
        {num}
      </div>
      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
        <FaceIcon pose={pose} />
      </div>
      <p className="text-white/90 text-sm">{label}</p>
    </div>
  );
}

function FaceIcon({ pose }: { pose: "center" | "left" | "right" }) {
  const rotate = pose === "left" ? -22 : pose === "right" ? 22 : 0;
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      style={{ transform: `rotate(${rotate}deg)`, transition: "transform 200ms ease" }}
    >
      <circle cx="12" cy="10" r="4" />
      <path d="M20 21c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
    </svg>
  );
}

function ArrowIndicator({ direction }: { direction: "left" | "right" }) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 text-green-400 animate-pulse"
      style={{
        left: direction === "left" ? "-46px" : undefined,
        right: direction === "right" ? "-46px" : undefined,
      }}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
        {direction === "left" ? (
          <path d="M15 4l-8 8 8 8V4z" />
        ) : (
          <path d="M9 4l8 8-8 8V4z" />
        )}
      </svg>
    </div>
  );
}
