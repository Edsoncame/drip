"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandingTokens } from "@/lib/kyc/sdk/branding";
import { DEFAULT_BRANDING } from "@/lib/kyc/sdk/branding";

type Step =
  | { kind: "loading" }
  | { kind: "intro" }
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
    setStep({ kind: "intro" });
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
  if (step.kind === "intro") {
    return (
      <IntroScreen
        b={branding}
        onStart={() => setStep({ kind: "dni-front" })}
      />
    );
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

function IntroScreen({
  b,
  onStart,
}: {
  b: BrandingTokens;
  onStart: () => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 py-10 overflow-y-auto"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />

      <div className="max-w-md w-full mt-2">
        <h1
          className="text-2xl font-semibold text-center mb-2"
          style={{ color: b.text_color }}
        >
          Verificá tu identidad
        </h1>
        <p
          className="text-sm text-center mb-8"
          style={{ color: b.muted_text_color }}
        >
          {b.welcome_message ??
            "Toma 2 minutos. Necesitás tu DNI físico y estar en un lugar bien iluminado."}
        </p>

        <div className="space-y-3 mb-8">
          <StepCard
            b={b}
            n={1}
            title="Foto del frente del DNI"
            detail="Apoyalo sobre una superficie plana. Todo el documento debe verse sin reflejos."
            icon={<DniFrontSvg color={b.text_color} />}
          />
          <StepCard
            b={b}
            n={2}
            title="Foto del reverso del DNI"
            detail="Asegurate que la línea de letras y números al pie (MRZ) se lea clara."
            icon={<DniBackSvg color={b.text_color} />}
          />
          <StepCard
            b={b}
            n={3}
            title="Selfie con movimiento (liveness)"
            detail="Te vamos a pedir 3 fotos: mirando al frente, a la izquierda, y a la derecha."
            icon={<SelfieSvg color={b.text_color} />}
          />
        </div>

        <div
          className="rounded-lg p-4 mb-8 border"
          style={{
            borderColor: `${b.muted_text_color}33`,
            backgroundColor: `${b.muted_text_color}08`,
          }}
        >
          <div
            className="text-xs uppercase tracking-wider mb-2 font-semibold"
            style={{ color: b.muted_text_color }}
          >
            Antes de empezar
          </div>
          <ul
            className="space-y-1.5 text-sm"
            style={{ color: b.text_color }}
          >
            <Requirement text="Tené tu DNI físico a mano (no foto del DNI)" />
            <Requirement text="Buena luz — evitá contraluz o reflejos" />
            <Requirement text="Sin lentes, gorra ni barbijo en la selfie" />
            <Requirement text="Autorizá el acceso a la cámara cuando aparezca" />
          </ul>
        </div>

        <button
          onClick={onStart}
          className="w-full py-3.5 rounded-full font-semibold text-base"
          style={{
            backgroundColor: b.primary_color,
            color: b.background_color,
          }}
        >
          Comenzar verificación
        </button>
        <p
          className="text-xs text-center mt-4"
          style={{ color: b.muted_text_color, opacity: 0.7 }}
        >
          Tus datos están encriptados y solo se usan para verificar tu identidad.
        </p>
      </div>
    </div>
  );
}

function StepCard({
  b,
  n,
  title,
  detail,
  icon,
}: {
  b: BrandingTokens;
  n: number;
  title: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3 border"
      style={{
        borderColor: `${b.muted_text_color}22`,
        backgroundColor: `${b.muted_text_color}05`,
      }}
    >
      <div
        className="shrink-0 flex items-center justify-center w-14 h-14 rounded-lg"
        style={{ backgroundColor: `${b.primary_color}18` }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div
          className="text-xs mb-0.5"
          style={{ color: b.muted_text_color }}
        >
          Paso {n}
        </div>
        <div
          className="font-semibold text-sm mb-1"
          style={{ color: b.text_color }}
        >
          {title}
        </div>
        <div className="text-xs" style={{ color: b.muted_text_color }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function Requirement({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5">✓</span>
      <span>{text}</span>
    </li>
  );
}

// --- SVG illustrations (inline, zero dependencies) ---

function DniFrontSvg({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 36" className="w-9 h-7" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="2" width="44" height="32" rx="3" />
      <circle cx="13" cy="15" r="5" />
      <path d="M22 10h20M22 14h20M22 20h14M22 24h18M8 28h32" strokeLinecap="round" />
    </svg>
  );
}

function DniBackSvg({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 36" className="w-9 h-7" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="2" width="44" height="32" rx="3" />
      <path d="M6 22h36M6 26h36M6 30h28" strokeLinecap="round" strokeDasharray="2 2" />
      <path d="M6 10h10M6 14h14" strokeLinecap="round" />
    </svg>
  );
}

function SelfieSvg({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 44" className="w-8 h-9" fill="none" stroke={color} strokeWidth="1.5">
      <ellipse cx="20" cy="22" rx="14" ry="18" />
      <circle cx="15" cy="19" r="1.2" fill={color} />
      <circle cx="25" cy="19" r="1.2" fill={color} />
      <path d="M15 28c1.5 1.5 3 2 5 2s3.5-0.5 5-2" strokeLinecap="round" />
    </svg>
  );
}

/** Progress pills arriba de los steps (1/2/3). */
function ProgressPills({
  current,
  total,
  b,
}: {
  current: number;
  total: number;
  b: BrandingTokens;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 rounded-full transition-all"
          style={{
            width: i + 1 === current ? 28 : 16,
            backgroundColor:
              i + 1 <= current
                ? b.primary_color
                : `${b.muted_text_color}33`,
          }}
        />
      ))}
    </div>
  );
}

/** Tip con check verde (ok) o cruz roja (bad) — sirve como "hacer vs evitar". */
function Tip({ ok, bad, text }: { ok?: boolean; bad?: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="shrink-0 mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
        style={{
          backgroundColor: ok ? "#10B981" : bad ? "#EF4444" : "#94A3B8",
          color: "#FFFFFF",
        }}
      >
        {ok ? "✓" : bad ? "✗" : "•"}
      </span>
      <span>{text}</span>
    </li>
  );
}

/** Ilustración grande para pantalla de captura DNI: rectángulo con brackets. */
function DniFrameGuide({
  side,
  color,
  accent,
}: {
  side: "front" | "back";
  color: string;
  accent: string;
}) {
  return (
    <svg viewBox="0 0 180 130" className="w-48 h-36" fill="none">
      {/* Brackets esquinas (primary color) */}
      <path
        d="M8 24v-14c0-2 2-4 4-4h14"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M172 24v-14c0-2-2-4-4-4h-14"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M8 106v14c0 2 2 4 4 4h14"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M172 106v14c0 2-2 4-4 4h-14"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Contenido del DNI */}
      {side === "front" ? (
        <g stroke={color} strokeWidth="1.5" fill="none">
          <rect x="24" y="30" width="30" height="40" rx="2" />
          <circle cx="39" cy="46" r="6" />
          <path d="M34 58h10" strokeLinecap="round" />
          <path d="M62 34h80M62 42h80M62 54h60M62 62h70" strokeLinecap="round" opacity="0.5" />
          <path d="M24 88h132M24 96h132M24 104h100" strokeLinecap="round" opacity="0.3" />
        </g>
      ) : (
        <g stroke={color} strokeWidth="1.5" fill="none">
          <path d="M24 40h130M24 50h130" strokeLinecap="round" opacity="0.4" />
          {/* MRZ lines */}
          <path
            d="M24 78h130M24 90h130M24 102h110"
            strokeLinecap="round"
            strokeDasharray="3 3"
            stroke={accent}
          />
        </g>
      )}
    </svg>
  );
}

/** Ilustración grande selfie — oval con flechas indicando el giro. */
function SelfieLivenessGuide({
  frameIndex,
  color,
  accent,
}: {
  frameIndex: number;
  color: string;
  accent: string;
}) {
  // frame 0 = center, 1 = mirar izq, 2 = mirar der
  return (
    <svg viewBox="0 0 180 180" className="w-40 h-40" fill="none">
      {/* Face oval */}
      <ellipse
        cx="90"
        cy="90"
        rx="44"
        ry="58"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.4"
      />
      {/* Ring outside */}
      <ellipse
        cx="90"
        cy="90"
        rx="62"
        ry="78"
        stroke={accent}
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      {/* Eyes */}
      <circle cx={frameIndex === 1 ? 78 : frameIndex === 2 ? 82 : 80} cy="78" r="2" fill={color} />
      <circle cx={frameIndex === 1 ? 98 : frameIndex === 2 ? 102 : 100} cy="78" r="2" fill={color} />
      {/* Mouth */}
      <path
        d="M76 112c4 4 8 6 14 6s10-2 14-6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Direction arrow */}
      {frameIndex === 1 && (
        <path
          d="M30 90h16M30 90l6-6M30 90l6 6"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {frameIndex === 2 && (
        <path
          d="M150 90h-16M150 90l-6-6M150 90l-6 6"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
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
  const stepNum = side === "front" ? 1 : 2;
  const title =
    side === "front"
      ? "Foto del frente de tu DNI"
      : "Foto del reverso del DNI";
  const subtitle =
    side === "front"
      ? "Todo el DNI debe verse, incluyendo tu foto y los 8 dígitos."
      : "La tira de letras y números al pie (MRZ) debe leerse clara.";

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 py-10 overflow-y-auto"
      style={{ backgroundColor: b.background_color }}
    >
      <BrandHeader b={b} />

      <div className="max-w-md w-full mt-2">
        <ProgressPills current={stepNum} total={3} b={b} />

        <h1
          className="text-xl font-semibold text-center mt-6 mb-2"
          style={{ color: b.text_color }}
        >
          {title}
        </h1>
        <p
          className="text-sm text-center mb-6"
          style={{ color: b.muted_text_color }}
        >
          {subtitle}
        </p>

        {/* Illustration: rectangle with brackets showing proper framing */}
        <div
          className="rounded-xl p-6 mb-6 flex items-center justify-center"
          style={{ backgroundColor: `${b.muted_text_color}08` }}
        >
          <DniFrameGuide side={side} color={b.text_color} accent={b.primary_color} />
        </div>

        {/* Tips list */}
        <ul
          className="space-y-2 text-sm mb-6"
          style={{ color: b.text_color }}
        >
          <Tip ok text="Superficie plana, buena luz natural" />
          <Tip ok text="El DNI entero dentro del marco" />
          <Tip bad text="Sin reflejos ni sombras sobre el DNI" />
          <Tip bad text="No fotos del DNI — el DNI físico real" />
        </ul>

        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-3.5 rounded-full font-semibold text-base"
          style={{
            backgroundColor: b.primary_color,
            color: b.background_color,
          }}
        >
          Abrir cámara
        </button>
        <p
          className="text-xs text-center mt-3"
          style={{ color: b.muted_text_color, opacity: 0.6 }}
        >
          En mobile abre la cámara directo. En desktop podés subir una foto
          del DNI ya tomada.
        </p>
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
  // Pantalla de preparación solo en el primer frame. Frames siguientes ya
  // tienen la cámara abierta del frame anterior — no preguntamos de nuevo.
  const [showIntro, setShowIntro] = useState<boolean>(
    frameIndex === 0 && capturedFrames.length === 0,
  );

  useEffect(() => {
    if (showIntro) return; // no abrir cámara hasta que user clickee
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
  }, [showIntro]);

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

  // Pantalla de preparación antes de abrir cámara (solo primera vez)
  if (showIntro) {
    return (
      <div
        className="min-h-screen flex flex-col items-center px-6 py-10 overflow-y-auto"
        style={{ backgroundColor: b.background_color }}
      >
        <BrandHeader b={b} />
        <div className="max-w-md w-full mt-2">
          <ProgressPills current={3} total={3} b={b} />
          <h1
            className="text-xl font-semibold text-center mt-6 mb-2"
            style={{ color: b.text_color }}
          >
            Selfie con movimiento
          </h1>
          <p
            className="text-sm text-center mb-6"
            style={{ color: b.muted_text_color }}
          >
            Vamos a tomar 3 fotos: al frente, girando a la izquierda, y a la
            derecha. Esto prueba que sos vos (liveness check).
          </p>

          <div
            className="rounded-xl p-6 mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${b.muted_text_color}08` }}
          >
            <SelfieLivenessGuide frameIndex={0} color={b.text_color} accent={b.primary_color} />
          </div>

          <ul
            className="space-y-2 text-sm mb-6"
            style={{ color: b.text_color }}
          >
            <Tip ok text="Bien iluminado, de frente a la cámara" />
            <Tip ok text="Cara entera dentro del óvalo" />
            <Tip bad text="Sin lentes, gorra o barbijo" />
            <Tip bad text="No uses foto de foto ni selfie vieja" />
          </ul>

          <button
            onClick={() => setShowIntro(false)}
            className="w-full py-3.5 rounded-full font-semibold text-base"
            style={{
              backgroundColor: b.primary_color,
              color: b.background_color,
            }}
          >
            Activar cámara
          </button>
          <p
            className="text-xs text-center mt-3"
            style={{ color: b.muted_text_color, opacity: 0.6 }}
          >
            Te vamos a pedir permiso de cámara. Se usa solo para esta
            verificación y no queda grabación.
          </p>
        </div>
      </div>
    );
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
        {/* Flecha direccional arriba-centro indicando hacia dónde girar */}
        {frameIndex > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-white text-2xl leading-none">
              {frameIndex === 1 ? "←" : "→"}
            </span>
            <span className="text-white text-sm font-medium">
              Girá la cabeza {frameIndex === 1 ? "a la izquierda" : "a la derecha"}
            </span>
          </div>
        )}
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
