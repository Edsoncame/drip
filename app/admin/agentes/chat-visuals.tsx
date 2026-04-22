"use client";

import type { ChatMessage } from "./types";
import { parseOrchestratorText } from "./orchestrator-utils";
import { MarkdownLite } from "./MarkdownLite";

/** Burbuja de chat con soporte markdown + plan header para respuestas del orquestador */
export function ChatBubble({
  msg,
  onImageClick,
}: {
  msg: ChatMessage;
  onImageClick: (url: string) => void;
}) {
  const isUser = msg.role === "user";
  const { clean, plan } = parseOrchestratorText(msg.content);
  const display = isUser ? msg.content : clean;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-amber-400 text-black whitespace-pre-wrap"
            : "bg-white/5 border border-white/10 text-white/90"
        }`}
      >
        {plan && !isUser && (
          <div className="mb-2 p-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-[11px] text-amber-200">
            <div className="text-[9px] uppercase tracking-wider text-amber-400 mb-1">Plan</div>
            {plan}
          </div>
        )}
        {isUser ? (
          display
        ) : display ? (
          <MarkdownLite text={display} onImageClick={onImageClick} />
        ) : (
          "…"
        )}
      </div>
    </div>
  );
}

/** Anillo visual (círculo con label) para agrupar agentes en la escena 3D */
export function ClusterRing({
  label,
  x,
  y,
  w,
  h,
  color,
}: {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x - w / 2}%`,
        top: `${y - h / 2}%`,
        width: `${w}%`,
        height: `${h}%`,
      }}
    >
      <div
        className="w-full h-full rounded-[32px] border border-dashed opacity-20"
        style={{ borderColor: color }}
      />
      <div
        className="absolute -top-2 left-4 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded"
        style={{ background: "#0A0A14", color, opacity: 0.6 }}
      >
        {label}
      </div>
    </div>
  );
}
