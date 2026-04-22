"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { AgentState } from "@/lib/agents";
import { timeAgo } from "./orchestrator-utils";
import { MarkdownLite } from "./MarkdownLite";

/** Panel del estado actual del agente: running / error / completada + resumen + archivos */
export function CurrentTaskPanel({
  latestRun,
  agentColor,
}: {
  latestRun: NonNullable<AgentState["latestRun"]>;
  agentColor: string;
}) {
  const isRunning = latestRun.status === "running";
  const isError = latestRun.status === "error";

  return (
    <div
      className="px-5 py-3 border-b border-white/10"
      style={{
        background: isRunning
          ? `linear-gradient(90deg, ${agentColor}15 0%, transparent 100%)`
          : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {isRunning ? (
          <>
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: agentColor }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: agentColor }}>
              Pensando ahora
            </span>
            <div className="ml-auto flex gap-1">
              <motion.span
                className="w-1 h-1 rounded-full bg-white/60"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
              <motion.span
                className="w-1 h-1 rounded-full bg-white/60"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
              />
              <motion.span
                className="w-1 h-1 rounded-full bg-white/60"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
              />
            </div>
          </>
        ) : isError ? (
          <>
            <span className="text-red-400">✕</span>
            <span className="text-[9px] uppercase tracking-widest font-bold text-red-400">
              Último intento falló
            </span>
            <span className="ml-auto text-[10px] text-white/40">
              {timeAgo(latestRun.finishedAt ?? latestRun.startedAt)}
            </span>
          </>
        ) : (
          <>
            <span className="text-emerald-400">✓</span>
            <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-400">
              Última tarea completada
            </span>
            <span className="ml-auto text-[10px] text-white/40">
              {latestRun.durationMs ? `${(latestRun.durationMs / 1000).toFixed(1)}s · ` : ""}
              {timeAgo(latestRun.finishedAt ?? latestRun.startedAt)}
            </span>
          </>
        )}
      </div>

      {/* Task bubble — lo que le pidieron */}
      <div
        className="text-[12px] text-white/80 italic leading-snug mb-2 px-3 py-2 rounded-lg border"
        style={{
          background: "rgba(0,0,0,0.3)",
          borderColor: `${agentColor}30`,
        }}
      >
        <span className="text-white/40 text-[9px] uppercase tracking-wider mr-1">tarea:</span>
        {latestRun.task.length > 220 ? latestRun.task.slice(0, 220) + "…" : latestRun.task}
      </div>

      {/* Respuesta resumen (si ya terminó) */}
      {!isRunning && latestRun.textSummary && (
        <div className="text-[11px] text-white/60 leading-snug line-clamp-3">
          <span className="text-white/40 text-[9px] uppercase tracking-wider mr-1">dijo:</span>
          {latestRun.textSummary}
        </div>
      )}

      {isError && latestRun.error && (
        <div className="text-[11px] text-red-300 mt-1">{latestRun.error}</div>
      )}

      {/* Archivos escritos */}
      {latestRun.filesWritten.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
          <div className="text-[9px] uppercase text-white/40 tracking-wider mb-1">
            {isRunning ? "escribiendo…" : "archivos generados"}
          </div>
          {latestRun.filesWritten.map((f) => (
            <div key={f.relPath} className="flex items-center gap-1.5 text-[10px] text-emerald-300">
              <span>📝</span>
              <span className="truncate flex-1">{f.relPath}</span>
              <span className="text-white/30">{(f.size / 1024).toFixed(1)}kb</span>
            </div>
          ))}
        </div>
      )}

      {latestRun.actor && (
        <div className="mt-2 text-[9px] text-white/30">
          disparado por <code className="text-white/50">{latestRun.actor}</code>
        </div>
      )}
    </div>
  );
}

/** Panel colapsable con los pasos sugeridos para resolver un blocker */
export function StepsPanel({ steps }: { steps: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-2.5 bg-black/20 hover:bg-black/30 text-[10px] uppercase text-white/60 tracking-wider"
      >
        <span className="flex items-center gap-2">
          <span>📋</span>
          <span>Pasos iniciales sugeridos</span>
        </span>
        <span className="text-white/40">{open ? "▼ ocultar" : "▶ ver"}</span>
      </button>
      {open && (
        <div className="px-5 py-3 bg-black/15 text-[11px] text-white/80 leading-relaxed max-h-[180px] overflow-y-auto">
          <MarkdownLite text={steps} onImageClick={() => {}} />
        </div>
      )}
    </div>
  );
}
