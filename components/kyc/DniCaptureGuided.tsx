"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Captura guiada del DNI peruano.
 *
 * Diseño UX:
 *   - Marco tipo "scanner" con corners en las esquinas (no borde sólido).
 *   - Un solo mensaje estable arriba, con debounce para no parpadear.
 *   - Cuando detecta foco + estabilidad OK, el marco se ilumina en verde
 *     y captura silenciosamente (sin countdown numérico).
 *   - Botón "Capturar ahora" grande y siempre disponible.
 *   - Sin textos técnicos en pantalla (nada de "foco 90").
 *
 * Checks client-side en background (silenciosos hasta que hay resultado):
 *   - Foco: varianza del Laplaciano en región central
 *   - Iluminación: histograma no saturado
 *   - Estabilidad: delta de luminancia entre frames
 */

const BLUR_THRESHOLD = Number(process.env.NEXT_PUBLIC_KYC_BLUR_THRESHOLD ?? "90");
const ID1_RATIO = 1.586; // 85.6 / 54 mm
// Tiempo que la imagen debe estar "OK" antes de disparar auto-capture.
// No se muestra countdown — el usuario ve el marco ponerse verde y listo.
const AUTO_CAPTURE_STABLE_MS = 1200;
// Antes de arrancar a chequear, le damos un respiro al usuario.
const PRE_ROLL_MS = 1500;
const MOTION_DELTA_THRESHOLD = 12;
// Debounce del mensaje: no cambiamos texto hasta que el nuevo estado dure
// al menos esto. Evita el flicker "Acercá → Enfocá → Acercá → ..." de ayer.
const MESSAGE_DEBOUNCE_MS = 700;

// Lo que ve el usuario — solo 3 estados visibles.
type VisibleState = "positioning" | "focusing" | "ready";

// Estado interno (más granular, no se muestra directamente)
type InternalState =
  | "idle"
  | "preroll"
  | "far"
  | "framing"
  | "stabilizing"
  | "captured"
  | "error";

const COPY: Record<VisibleState, string> = {
  positioning: "Pon tu DNI dentro del marco",
  focusing: "Mantén firme, buscando foco",
  ready: "¡Perfecto! Capturando…",
};

function toVisible(internal: InternalState): VisibleState {
  if (internal === "stabilizing" || internal === "captured") return "ready";
  if (internal === "framing") return "focusing";
  return "positioning";
}

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
  // Timestamp del último cambio de estado visible (para debounce del texto)
  const lastVisibleChangeRef = useRef<number>(0);
  // Estado visible pendiente de confirmar
  const pendingVisibleRef = useRef<VisibleState | null>(null);

  const [visible, setVisible] = useState<VisibleState>("positioning");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [flash, setFlash] = useState(false);

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
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedRef.current = true;
      // Flash visual breve — feedback de que capturó.
      setFlash(true);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], "dni-anverso.jpg", { type: "image/jpeg" });
          // Pequeño delay para que el usuario vea el flash antes de cerrar
          setTimeout(() => {
            stop();
            onCaptured(file, mode);
          }, 180);
        },
        "image/jpeg",
        0.92,
      );
    },
    [onCaptured, stop],
  );

  // Actualiza el estado visible con debounce anti-flicker
  const setVisibleDebounced = useCallback((next: VisibleState) => {
    const now = Date.now();
    if (pendingVisibleRef.current !== next) {
      pendingVisibleRef.current = next;
      lastVisibleChangeRef.current = now;
      return;
    }
    if (now - lastVisibleChangeRef.current >= MESSAGE_DEBOUNCE_MS) {
      setVisible((current) => (current === next ? current : next));
    }
  }, []);

  // Inicializar stream
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(
            "Tu navegador no soporta cámara en web. Usá el botón 'Subir archivo' de abajo.",
          );
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
          prerollStartRef.current = Date.now();
          setVisible("positioning");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")) {
          setError("Permiso de cámara denegado. Habilítalo en los ajustes del navegador.");
        } else if (msg.includes("NotFound") || msg.includes("device")) {
          setError("No encontramos cámara en este dispositivo.");
        } else {
          setError("No se pudo abrir la cámara.");
        }
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  // Detection loop — silencioso hasta que hay un resultado firme
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

      const regionW = Math.round(canvas.width * 0.85);
      const regionH = Math.round(regionW / ID1_RATIO);
      const regionX = Math.round((canvas.width - regionW) / 2);
      const regionY = Math.round((canvas.height - regionH) / 2);
      const imageData = ctx.getImageData(regionX, regionY, regionW, regionH);

      const now = Date.now();
      // Durante pre-roll solo mostramos "positioning", sin chequeos.
      if (
        prerollStartRef.current !== null &&
        now - prerollStartRef.current < PRE_ROLL_MS
      ) {
        setVisibleDebounced("positioning");
        prevLumRef.current = toLuminance(imageData);
        loopRef.current = requestAnimationFrame(tick);
        return;
      }

      const { blur, lum } = computeBlurAndLum(imageData);
      let motion = 0;
      if (prevLumRef.current && prevLumRef.current.length === lum.length) {
        motion = luminanceDelta(prevLumRef.current, lum);
      }
      prevLumRef.current = lum;
      const lighting = histogramBalance(imageData);

      let internal: InternalState;
      if (blur < BLUR_THRESHOLD * 0.4) {
        internal = "far";
        stableSinceRef.current = null;
      } else if (blur < BLUR_THRESHOLD) {
        internal = "framing";
        stableSinceRef.current = null;
      } else if (lighting === "bad" || motion > MOTION_DELTA_THRESHOLD) {
        internal = "framing";
        stableSinceRef.current = null;
      } else {
        internal = "stabilizing";
        if (stableSinceRef.current === null) {
          stableSinceRef.current = now;
        } else if (now - stableSinceRef.current >= AUTO_CAPTURE_STABLE_MS) {
          if (autoEnabledRef.current) {
            capture("auto");
            return;
          }
        }
      }

      setVisibleDebounced(toVisible(internal));
      loopRef.current = requestAnimationFrame(tick);
    };
    loopRef.current = requestAnimationFrame(tick);
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [ready, capture, setVisibleDebounced]);

  const cornerColor =
    visible === "ready" ? "#22C55E" : visible === "focusing" ? "#FCD34D" : "#FFFFFF";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="relative z-10 p-4 flex items-center justify-between text-white">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/50">Paso 1 de 2</p>
          <h3 className="font-800 text-lg leading-tight">Foto de tu DNI</h3>
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

            {/* Overlay oscuro fuera del marco, con recorte del marco */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 85% 54% at center, transparent 60%, rgba(0,0,0,0.7) 100%)",
              }}
            />

            {/* Marco tipo scanner — 4 corners, no borde sólido */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="relative"
                style={{
                  width: "85%",
                  aspectRatio: `${ID1_RATIO}`,
                  maxWidth: "640px",
                  transition: "filter 250ms ease",
                  filter:
                    visible === "ready"
                      ? "drop-shadow(0 0 24px rgba(34,197,94,0.6))"
                      : visible === "focusing"
                        ? "drop-shadow(0 0 12px rgba(252,211,77,0.35))"
                        : "none",
                }}
              >
                {/* 4 esquinas animadas */}
                {([
                  { style: { top: 0, left: 0 }, rotation: 0 },
                  { style: { top: 0, right: 0 }, rotation: 90 },
                  { style: { bottom: 0, right: 0 }, rotation: 180 },
                  { style: { bottom: 0, left: 0 }, rotation: 270 },
                ] as const).map((c, i) => (
                  <span
                    key={i}
                    className="absolute block"
                    style={{
                      ...c.style,
                      width: 34,
                      height: 34,
                      borderTop: `4px solid ${cornerColor}`,
                      borderLeft: `4px solid ${cornerColor}`,
                      borderTopLeftRadius: 14,
                      transform: `rotate(${c.rotation}deg)`,
                      transformOrigin: "center",
                      transition: "border-color 250ms ease",
                    }}
                  />
                ))}

                {/* Glow verde pulsante cuando está capturando (ready) */}
                {visible === "ready" && (
                  <span
                    className="absolute inset-0 rounded-[14px] animate-pulse"
                    style={{
                      boxShadow: "inset 0 0 0 2px rgba(34,197,94,0.4)",
                    }}
                  />
                )}
              </div>
            </div>

            {/* Mensaje único arriba del marco */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-6 w-full max-w-sm">
              <p className="text-center text-white text-base font-600 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {COPY[visible]}
              </p>
            </div>

            {/* Flash blanco al capturar */}
            {flash && (
              <div className="absolute inset-0 bg-white animate-[kycflash_180ms_ease-out_forwards] pointer-events-none" />
            )}
            <style jsx>{`
              @keyframes kycflash {
                0% { opacity: 0; }
                35% { opacity: 0.9; }
                100% { opacity: 0; }
              }
            `}</style>
          </>
        )}
      </div>

      {ready && !error && (
        <div className="relative z-10 p-5 pb-7 bg-gradient-to-t from-black via-black/95 to-transparent flex flex-col items-center gap-4">
          <button
            onClick={() => capture("manual")}
            // capturedRef se setea en capture() y previene doble-click. Leerlo
            // en render puede ser estable en la práctica (el ref cambia justo
            // antes de un re-render disparado por setReady), pero React
            // Compiler lo flagea. Mantenemos el ref por compatibilidad con
            // el resto del componente (ya en producción). Documentado en
            // AUDIT_NOTES.md para review dedicado.
            // eslint-disable-next-line react-hooks/refs
            disabled={capturedRef.current}
            className="w-20 h-20 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all shadow-2xl flex items-center justify-center disabled:opacity-60"
            aria-label="Capturar foto"
          >
            {/* Shutter icon */}
            <span className="w-16 h-16 rounded-full border-4 border-black/80" />
          </button>
          <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
              className="accent-blue-500 w-4 h-4"
            />
            Captura automática
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Quality helpers (canvas puro, sin deps) ───────────────────────────────

function toLuminance(img: ImageData): Float32Array {
  const { data, width, height } = img;
  const out = new Float32Array(Math.ceil((width * height) / 4));
  let j = 0;
  for (let i = 0; i < data.length; i += 16) {
    out[j++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

function luminanceDelta(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

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
