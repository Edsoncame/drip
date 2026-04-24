"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandingTokens } from "@/lib/kyc/sdk/branding";
import { DEFAULT_BRANDING } from "@/lib/kyc/sdk/branding";

type Step =
  | { kind: "loading" }
  | { kind: "dni-front" }
  | { kind: "dni-back" }
  | { kind: "selfie"; frameIndex: 0 | 1 | 2; capturedFrames: string[] }
  | { kind: "processing" }
  | { kind: "done"; verdict: Verdict }
  | { kind: "error"; message: string };

interface Verdict {
  status: "verified" | "rejected" | "review" | "pending";
  reason: string;
  face_score?: number | null;
  forensics_overall?: number | null;
  sanctions_hit?: boolean;
}

interface Props {
  sessionId: string;
  initialToken: string;
  tenantId: string;
  branding?: BrandingTokens;
  /** True cuando la página vive en un iframe embebido en el sitio del tenant. */
  embedMode?: boolean;
}

const TOKEN_KEY = "flux_kyc_session_token";

export function KycSdkFlow({
  sessionId,
  initialToken,
  tenantId,
  branding: brandingProp,
  embedMode = false,
}: Props) {
  const branding = brandingProp ?? DEFAULT_BRANDING;
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const tokenRef = useRef<string | null>(null);

  // Al montar: guardar el token en sessionStorage y limpiar la URL.
  // Evita que quede en server logs o en Referer cuando hagamos fetches.
  useEffect(() => {
    if (typeof window === "undefined") return;
    tokenRef.current =
      initialToken ?? window.sessionStorage.getItem(TOKEN_KEY);
    if (initialToken) {
      window.sessionStorage.setItem(TOKEN_KEY, initialToken);
      const url = new URL(window.location.href);
      url.searchParams.delete("t");
      window.history.replaceState({}, "", url.toString());
    }
    if (!tokenRef.current) {
      setStep({ kind: "error", message: "Falta el token de la sesión." });
      return;
    }
    setStep({ kind: "dni-front" });
  }, [initialToken]);

  async function upload(
    kind: "dni_front" | "dni_back" | "selfie" | "liveness_frame",
    imageBase64: string,
    frameIndex?: number,
  ) {
    const token = tokenRef.current;
    if (!token) throw new Error("no_token");
    const res = await fetch("/api/kyc/sdk/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind,
        image: imageBase64,
        content_type: "image/jpeg",
        frame_index: frameIndex,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`upload ${kind}: HTTP ${res.status} ${body.slice(0, 120)}`);
    }
    return res.json();
  }

  async function finalize(): Promise<Verdict> {
    const token = tokenRef.current;
    if (!token) throw new Error("no_token");
    const res = await fetch("/api/kyc/sdk/finalize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`finalize: HTTP ${res.status} ${body.slice(0, 120)}`);
    }
    const json = (await res.json()) as { verdict: Verdict };
    return json.verdict;
  }

  async function handleDniCaptured(file: File, side: "front" | "back") {
    try {
      const base64 = await fileToBase64(file);
      await upload(side === "front" ? "dni_front" : "dni_back", base64);
      if (side === "front") {
        setStep({ kind: "dni-back" });
      } else {
        setStep({ kind: "selfie", frameIndex: 0, capturedFrames: [] });
      }
    } catch (e) {
      setStep({
        kind: "error",
        message: e instanceof Error ? e.message : "upload falló",
      });
    }
  }

  async function handleSelfieCaptured(dataUrl: string) {
    if (step.kind !== "selfie") return;
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    try {
      const kind: "selfie" | "liveness_frame" =
        step.frameIndex === 0 ? "selfie" : "liveness_frame";
      await upload(kind, base64, step.frameIndex);
      const nextFrames = [...step.capturedFrames, dataUrl];
      if (step.frameIndex < 2) {
        setStep({
          kind: "selfie",
          frameIndex: (step.frameIndex + 1) as 0 | 1 | 2,
          capturedFrames: nextFrames,
        });
      } else {
        setStep({ kind: "processing" });
        const verdict = await finalize();
        setStep({ kind: "done", verdict });
      }
    } catch (e) {
      setStep({
        kind: "error",
        message: e instanceof Error ? e.message : "upload falló",
      });
    }
  }

  if (step.kind === "loading") {
    return <LoadingScreen b={branding} />;
  }
  if (step.kind === "error") {
    return <ErrorScreen message={step.message} b={branding} />;
  }
  if (step.kind === "processing") {
    return <ProcessingScreen b={branding} />;
  }
  if (step.kind === "done") {
    return <VerdictScreen verdict={step.verdict} b={branding} embedMode={embedMode} />;
  }
  if (step.kind === "dni-front" || step.kind === "dni-back") {
    return (
      <DniCaptureStep
        side={step.kind === "dni-front" ? "front" : "back"}
        b={branding}
        onCaptured={(file) =>
          handleDniCaptured(file, step.kind === "dni-front" ? "front" : "back")
        }
      />
    );
  }
  if (step.kind === "selfie") {
    return (
      <SelfieCaptureStep
        frameIndex={step.frameIndex}
        capturedFrames={step.capturedFrames}
        b={branding}
        onCaptured={handleSelfieCaptured}
      />
    );
  }
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") {
        reject(new Error("not-string"));
        return;
      }
      resolve(r.replace(/^data:image\/\w+;base64,/, ""));
    };
    reader.onerror = () => reject(reader.error ?? new Error("reader-fail"));
    reader.readAsDataURL(file);
  });
}

// === Sub-views === (en archivos separados serían mejor, pero caben acá)

/** Header con logo + brand name del tenant, reutilizado en los steps. */
function BrandHeader({ b }: { b: BrandingTokens }) {
  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      {b.logo_url && (
        <img
          src={b.logo_url}
          alt=""
          className="h-10 w-auto object-contain max-w-[160px]"
        />
      )}
      <div
        className="text-xs tracking-[0.3em] uppercase"
        style={{ color: b.muted_text_color }}
      >
        {b.brand_name}
      </div>
    </div>
  );
}

function LoadingScreen({ b }: { b: BrandingTokens }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: b.background_color }}
    >
      <div className="text-sm" style={{ color: b.muted_text_color }}>
        Cargando…
      </div>
    </div>
  );
}

function ProcessingScreen({ b }: { b: BrandingTokens }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />
      <div
        className="h-10 w-10 rounded-full border-2 animate-spin"
        style={{
          borderColor: `${b.muted_text_color}55`,
          borderTopColor: b.text_color,
        }}
      />
      <h1 className="text-xl font-semibold" style={{ color: b.text_color }}>
        Verificando tu identidad
      </h1>
      <p className="text-sm" style={{ color: b.muted_text_color }}>
        Esto toma unos segundos…
      </p>
    </div>
  );
}

function ErrorScreen({ message, b }: { message: string; b: BrandingTokens }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />
      <h1 className="text-xl font-semibold" style={{ color: b.text_color }}>
        Algo falló
      </h1>
      <p className="text-sm max-w-sm" style={{ color: b.muted_text_color }}>
        {message}
      </p>
    </div>
  );
}

function VerdictScreen({
  verdict,
  b,
  embedMode,
}: {
  verdict: Verdict;
  b: BrandingTokens;
  embedMode: boolean;
}) {
  const isOk = verdict.status === "verified";

  // En embed mode, disparamos postMessage al parent (sitio del tenant) para
  // que cierre el iframe + ejecute su onComplete callback. Se hace una sola
  // vez, con target '*' — el script embebido filtra por origin en el receiver.
  useEffect(() => {
    if (!embedMode || typeof window === "undefined" || window.parent === window) {
      return;
    }
    try {
      window.parent.postMessage(
        {
          type: "flux-kyc:complete",
          verdict: {
            status: verdict.status,
            reason: verdict.reason,
            face_score: verdict.face_score,
            forensics_overall: verdict.forensics_overall,
          },
        },
        "*",
      );
    } catch {
      // parent bloqueado por CSP/sandbox — silently skip, el user puede cerrar
    }
  }, [embedMode, verdict]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center text-3xl text-white"
        style={{ backgroundColor: isOk ? "#10B981" : "#EF4444" }}
      >
        {isOk ? "✓" : "✗"}
      </div>
      <h1 className="text-2xl font-semibold" style={{ color: b.text_color }}>
        {isOk ? "Identidad verificada" : "Verificación rechazada"}
      </h1>
      <p className="text-sm max-w-sm" style={{ color: b.muted_text_color }}>
        {verdict.reason}
      </p>
      <p
        className="text-xs mt-4"
        style={{ color: b.muted_text_color, opacity: 0.6 }}
      >
        {embedMode
          ? "Esta ventana se cierra sola — volvé a la app."
          : "Podés cerrar esta ventana y volver a la app."}
      </p>
    </div>
  );
}

function DniCaptureStep({
  side,
  onCaptured,
  b,
}: {
  side: "front" | "back";
  onCaptured: (file: File) => void;
  b: BrandingTokens;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />
      <h1 className="text-xl font-semibold" style={{ color: b.text_color }}>
        {side === "front" ? "Foto del frente de tu DNI" : "Foto del reverso del DNI"}
      </h1>
      {side === "front" && b.welcome_message ? (
        <p
          className="text-sm max-w-sm"
          style={{ color: b.muted_text_color }}
        >
          {b.welcome_message}
        </p>
      ) : (
        <p className="text-sm max-w-sm" style={{ color: b.muted_text_color }}>
          {side === "front"
            ? "Tomá una foto clara con buena luz. Que se vean tu foto y los 8 dígitos."
            : "Tomá una foto del reverso — la tira de letras y números (MRZ) debe estar legible."}
        </p>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        className="mt-2 px-6 py-3 rounded-full font-semibold"
        style={{
          backgroundColor: b.primary_color,
          color: b.background_color,
        }}
      >
        Abrir cámara
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCaptured(file);
        }}
      />
    </div>
  );
}

function SelfieCaptureStep({
  frameIndex,
  capturedFrames,
  onCaptured,
  b,
}: {
  frameIndex: 0 | 1 | 2;
  capturedFrames: string[];
  onCaptured: (dataUrl: string) => void;
  b: BrandingTokens;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 720, height: 960 },
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
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "camera-fail");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const prompt =
    frameIndex === 0
      ? "Mirá al frente y tocá capturar"
      : frameIndex === 1
        ? "Girá despacio a la izquierda"
        : "Girá despacio a la derecha";

  function snap() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontal (front camera ya viene mirror por CSS en el preview)
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onCaptured(dataUrl);
  }

  if (err) {
    return <ErrorScreen message={`No pudimos abrir la cámara: ${err}`} b={b} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-6 px-4 gap-4 text-center"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded ${
              i < capturedFrames.length
                ? "bg-emerald-500"
                : i === frameIndex
                  ? "bg-white"
                  : "bg-white/30"
            }`}
          />
        ))}
      </div>
      <div className="relative rounded-2xl overflow-hidden w-full max-w-md aspect-[3/4] bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="absolute inset-0 pointer-events-none border-[3px] border-white/70 rounded-2xl m-6" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-col items-center gap-3">
        <p className="text-lg font-medium" style={{ color: b.text_color }}>
          {prompt}
        </p>
        <button
          onClick={snap}
          className="h-16 w-16 rounded-full border-4"
          style={{
            backgroundColor: b.primary_color,
            borderColor: `${b.primary_color}80`,
          }}
          aria-label="Capturar"
        />
      </div>
    </div>
  );
}
