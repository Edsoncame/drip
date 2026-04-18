"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Captura guiada del DNI peruano con detección en tiempo real.
 *
 * Checks client-side (sin dependencias pesadas — canvas JS puro):
 *   - Encuadre: bordes del doc dentro del marco (aspect ratio ID-1 1.586:1)
 *   - Foco: varianza del Laplaciano en región central > umbral
 *   - Iluminación: histograma balanceado, sin zonas saturadas
 *   - Estabilidad: la imagen debe estar quieta (delta entre frames chico)
 *
 * El match detallado (bordes del documento, OCR, quality issues finos)
 * lo hace el backend con Claude. Acá solo filtramos basura antes de
 * llamar al API (ahorra tiempo + costo).
 */

const BLUR_THRESHOLD = Number(process.env.NEXT_PUBLIC_KYC_BLUR_THRESHOLD ?? "90");
const ID1_RATIO = 1.586; // 85.6 / 54 mm
const AUTO_CAPTURE_STABLE_MS = 1500;
// Delay inicial antes de arrancar el auto-capture. Le da tiempo al usuario
// para acomodar el DNI sin que se dispare por accidente.
const PRE_ROLL_MS = 2500;
// Si el delta entre frames (luminancia) supera esto, el usuario está
// moviendo la cámara o el DNI — reseteamos timer de estabilidad.
const MOTION_DELTA_THRESHOLD = 12;

type QualityState =
  | "idle"
  | "preroll"
  | "far"
  | "framing"
  | "stabilizing"
  | "captured"
  | "error";

interface Props {
  onCaptured: (file: File, captureMode: "auto" | "manual") => void;
  onCancel: () => void;
}

export default function DniCaptureGuided({ onCaptured, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const prerollStartRef = useRef<number | null>(null);
  const prevLumRef = useRef<Float32Array | null>(null);
  const capturedRef = useRef(false);
  const autoEnabledRef = useRef(true);

  const [state, setState] = useState<QualityState>("idle");
  const [message, setMessage] = useState("Permitiendo cámara…");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [blurScore, setBlurScore] = useState<number | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(true);

  // Sync ref — queremos que el loop lea el último valor sin reiniciarse
  useEffect(() => {
    autoEnabledRef.current = autoEnabled;
  }, [autoEnabled]);

  const stop = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const capture = useCallback(
    (mode: "auto" | "manual") => {
      if (capturedRef.current) return;
      const video = videoRef.current;
      if (!video) return;
      const canvas = document.createElement("canvas");
      // Resolución objetivo alta para OCR
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          capturedRef.current = true;
          setState("captured");
          setMessage("Listo ✓");
          const file = new File([blob], "dni-anverso.jpg", { type: "image/jpeg" });
          stop();
          onCaptured(file, mode);
        },
        "image/jpeg",
        0.92,
      );
    },
    [onCaptured, stop],
  );

  // Inicializar stream
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(
            "Tu navegador no soporta cámara en web. Usá el botón 'Subir archivo' de abajo.",
          );
          setState("error");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
          setState("preroll");
          prerollStartRef.current = Date.now();
          setMessage("Acomodá el DNI dentro del marco…");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")) {
          setError("Permiso de cámara denegado. Habilitalo en los ajustes del navegador.");
        } else if (msg.includes("NotFound") || msg.includes("device")) {
          setError("No encontramos cámara en este dispositivo.");
        } else {
          setError("No se pudo abrir la cámara.");
        }
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  // Detection loop
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tick = () => {
      if (capturedRef.current) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        loopRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = 320;
      canvas.height = Math.round(320 * (vh / vw));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Región central donde debería estar el DNI (~85% del ancho, centrado, aspect ID-1)
      const regionW = Math.round(canvas.width * 0.85);
      const regionH = Math.round(regionW / ID1_RATIO);
      const regionX = Math.round((canvas.width - regionW) / 2);
      const regionY = Math.round((canvas.height - regionH) / 2);

      const imageData = ctx.getImageData(regionX, regionY, regionW, regionH);

      // Pre-roll: no analizamos nada los primeros PRE_ROLL_MS para no confundir
      // al usuario con cambios de estado mientras intenta acomodar el DNI.
      const now = Date.now();
      if (
        prerollStartRef.current !== null &&
        now - prerollStartRef.current < PRE_ROLL_MS
      ) {
        const left = Math.ceil((PRE_ROLL_MS - (now - prerollStartRef.current)) / 1000);
        setState("preroll");
        setMessage(`Acomodá el DNI dentro del marco… ${left}s`);
        // Dejamos avanzar prevLumRef para que el motion delta del primer check
        // no sea espurio
        prevLumRef.current = toLuminance(imageData);
        loopRef.current = requestAnimationFrame(tick);
        return;
      }

      const { blur, lum } = computeBlurAndLum(imageData);
      setBlurScore(blur);

      // Motion delta vs frame anterior
      let motion = 0;
      if (prevLumRef.current && prevLumRef.current.length === lum.length) {
        motion = luminanceDelta(prevLumRef.current, lum);
      }
      prevLumRef.current = lum;

      const lighting = histogramBalance(imageData);

      // Estados
      if (blur < BLUR_THRESHOLD * 0.4) {
        setState("far");
        setMessage("Acercá tu DNI al marco, ocupá el recuadro");
        stableSinceRef.current = null;
      } else if (blur < BLUR_THRESHOLD) {
        setState("framing");
        setMessage("Enfocá mejor, mantené firme");
        stableSinceRef.current = null;
      } else if (lighting === "bad") {
        setState("framing");
        setMessage("Mejorá la iluminación, evitá reflejos");
        stableSinceRef.current = null;
      } else if (motion > MOTION_DELTA_THRESHOLD) {
        setState("framing");
        setMessage("Mantené la cámara firme");
        stableSinceRef.current = null;
      } else {
        // Estable
        if (stableSinceRef.current === null) {
          stableSinceRef.current = now;
          setState("stabilizing");
          setMessage("Listo… mantené firme");
        } else {
          const elapsed = now - stableSinceRef.current;
          if (elapsed >= AUTO_CAPTURE_STABLE_MS) {
            if (autoEnabledRef.current) {
              capture("auto");
              return;
            } else {
              // Auto desactivado — seguimos mostrando "listo" esperando tap manual
              setState("stabilizing");
              setMessage("Enfocado ✓ tocá capturar");
            }
          } else {
            setState("stabilizing");
            setMessage(
              autoEnabledRef.current
                ? `Capturando en ${Math.max(0, Math.ceil((AUTO_CAPTURE_STABLE_MS - elapsed) / 100) / 10).toFixed(1)}s…`
                : "Enfocado ✓ tocá capturar",
            );
          }
        }
      }

      loopRef.current = requestAnimationFrame(tick);
    };
    loopRef.current = requestAnimationFrame(tick);
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [ready, capture]);

  const borderColor =
    state === "stabilizing"
      ? "#22C55E"
      : state === "framing"
        ? "#F59E0B"
        : state === "captured"
          ? "#22C55E"
          : state === "preroll"
            ? "#60A5FA"
            : "#EF4444";
  const messageColor =
    state === "stabilizing" || state === "captured"
      ? "text-green-400"
      : state === "framing"
        ? "text-amber-400"
        : state === "preroll"
          ? "text-blue-300"
          : "text-red-400";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="p-4 flex items-center justify-between text-white">
        <h3 className="font-800 text-lg">Foto del DNI — anverso</h3>
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

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-white text-base mb-4">{error}</p>
              <button
                onClick={() => {
                  stop();
                  onCancel();
                }}
                className="py-2 px-6 rounded-full bg-white text-black font-700 text-sm"
              >
                Volver
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay oscuro fuera del marco */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: "85%",
                  aspectRatio: `${ID1_RATIO}`,
                  maxWidth: "640px",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                  border: `3px solid ${borderColor}`,
                  borderRadius: "14px",
                  transition: "border-color 150ms ease",
                }}
              />
            </div>

            {/* Status message */}
            <div className="absolute bottom-36 left-1/2 -translate-x-1/2 px-6 w-full max-w-md">
              <p className={`text-center text-base font-700 ${messageColor}`}>{message}</p>
              {blurScore !== null && state !== "preroll" && (
                <p className="text-center text-xs text-white/40 mt-1">
                  foco {blurScore.toFixed(0)}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {ready && !error && (
        <div className="p-4 pb-6 flex flex-col gap-3 bg-black">
          <button
            onClick={() => capture("manual")}
            disabled={!ready || capturedRef.current}
            className="w-full py-4 rounded-full bg-white text-black font-800 text-base disabled:opacity-50 cursor-pointer shadow-lg"
          >
            📸 Capturar ahora
          </button>
          <label className="flex items-center justify-center gap-2 text-xs text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
              className="accent-blue-500"
            />
            Captura automática al estar enfocado
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Quality helpers (canvas puro, sin deps) ───────────────────────────────

/**
 * Luminancia (Y = 0.299R + 0.587G + 0.114B) por pixel, subsampling cada 4.
 */
function toLuminance(img: ImageData): Float32Array {
  const { data, width, height } = img;
  const out = new Float32Array(Math.ceil((width * height) / 4));
  let j = 0;
  for (let i = 0; i < data.length; i += 16) {
    out[j++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/**
 * Delta promedio absoluto entre dos vectores de luminancia.
 * Valores > ~12 indican que el usuario está moviendo la cámara o el DNI.
 */
function luminanceDelta(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/**
 * Laplacian variance — proxy de enfoque. Valores bajos = borroso.
 * Operador 3×3: kernel [0,1,0, 1,-4,1, 0,1,0] aproximado.
 * Devuelve también la luminancia full-res para medir motion.
 */
function computeBlurAndLum(img: ImageData): { blur: number; lum: Float32Array } {
  const { data, width, height } = img;
  const lum = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    lum[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  if (width < 10 || height < 10) return { blur: 0, lum };
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const c = lum[y * width + x];
      const t = lum[(y - 1) * width + x];
      const b = lum[(y + 1) * width + x];
      const l = lum[y * width + x - 1];
      const r = lum[y * width + x + 1];
      const v = Math.abs(-4 * c + t + b + l + r);
      sum += v;
      sumSq += v * v;
      count++;
    }
  }
  if (count === 0) return { blur: 0, lum };
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return { blur: variance, lum };
}

/**
 * Chequea que el histograma de luminancia no esté saturado (sobre o sub expuesto).
 * 'good' = sin más del 25% de pixels en la zona oscura y 15% en la clara.
 */
function histogramBalance(img: ImageData): "good" | "bad" {
  const { data } = img;
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    hist[Math.min(255, Math.max(0, Math.round(y)))]++;
    n++;
  }
  if (n === 0) return "bad";
  let dark = 0;
  let light = 0;
  for (let k = 0; k < 20; k++) dark += hist[k];
  for (let k = 240; k < 256; k++) light += hist[k];
  if (dark / n > 0.25 || light / n > 0.15) return "bad";
  return "good";
}
