"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentId, AgentMeta, AgentState, FileEntry, ActivityEvent } from "@/lib/agents";
import PixelAvatar, { type AgentMood } from "./PixelAvatar";

type StatePayload = {
  agents: AgentMeta[];
  states: AgentState[];
  activity: ActivityEvent[];
  now: number;
  rootExists?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

type AgentAnimState = "idle" | "thinking" | "working" | "talking" | "receiving";

// Tipo mínimo para Web Speech API (no viene en lib.dom en algunos targets)
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

type Beam = {
  id: string;
  from: AgentId;
  to: AgentId;
  label: string;
  createdAt: number;
};

/**
 * Parses orchestrator stream for [[agente:slug]], [[plan]]…[[/plan]],
 * and [[delegate:slug]]…[[/delegate]] tokens. Returns the plain-text
 * response for rendering + an event list to drive scene animations.
 */
function parseOrchestratorText(text: string) {
  const events: { agent: AgentId; kind: "mention" | "delegate"; message?: string }[] = [];
  let plan: string | null = null;

  const planMatch = text.match(/\[\[plan\]\]([\s\S]*?)\[\[\/plan\]\]/);
  if (planMatch) plan = planMatch[1].trim();

  const delegateRe = /\[\[delegate:([a-z-]+)\]\]([\s\S]*?)\[\[\/delegate\]\]/g;
  let dm: RegExpExecArray | null;
  while ((dm = delegateRe.exec(text)) !== null) {
    events.push({ agent: dm[1] as AgentId, kind: "delegate", message: dm[2].trim() });
  }

  const mentionRe = /\[\[agente:([a-z-]+)\]\]/g;
  let mm: RegExpExecArray | null;
  while ((mm = mentionRe.exec(text)) !== null) {
    events.push({ agent: mm[1] as AgentId, kind: "mention" });
  }

  // strip tokens for display
  const clean = text
    .replace(/\[\[plan\]\]([\s\S]*?)\[\[\/plan\]\]/g, "")
    .replace(/\[\[delegate:[a-z-]+\]\]([\s\S]*?)\[\[\/delegate\]\]/g, "$1")
    .replace(/\[\[agente:([a-z-]+)\]\]/g, "@$1")
    .trim();

  return { clean, events, plan };
}

/**
 * Deriva un mood desde el estado real del agente + un toque de aleatoriedad
 * que rota cada N minutos para que el equipo se sienta vivo.
 *
 * Heurísticas:
 *   - sin actividad > 6h     → sleepy
 *   - sin actividad > 2h     → tired
 *   - actividad < 5 min      → motivated
 *   - muchos archivos nuevos → stressed
 *   - diseñador/content/copy → creative (si nada más aplica)
 *   - fallback               → normal
 */
function computeMood(
  agent: AgentMeta,
  state: AgentState | undefined,
  seed: number,
  awakeUntil = 0,
): AgentMood {
  if (!state || !state.exists) {
    // Si está recién despierto por una tarea, no lo dejamos dormir aunque no exista FS
    return Date.now() < awakeUntil ? "normal" : "sleepy";
  }
  const last = state.lastActivity ?? 0;
  const age = Date.now() - last;
  const h = 3600 * 1000;
  const justWokeUp = Date.now() < awakeUntil;

  // Reglas de cansancio/sueño NO aplican si está recién despierto
  if (!justWokeUp && age > 6 * h) return "sleepy";
  if (!justWokeUp && age > 2 * h) return "tired";
  if (age < 5 * 60 * 1000) return "motivated";
  if (state.filesCount > 20) return "stressed";
  if (justWokeUp) return "motivated";

  // Creative bias for creative roles with rotating randomness
  const creativeRoles: AgentId[] = ["disenador-creativo", "content-creator", "copy-lanzamiento"];
  if (creativeRoles.includes(agent.id)) {
    return (seed + agent.id.length) % 3 === 0 ? "creative" : "normal";
  }

  // Rotate through moods randomly for liveliness
  const moods: AgentMood[] = ["normal", "normal", "normal", "motivated", "creative", "tired"];
  return moods[(seed + agent.id.length) % moods.length];
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

const AGENT_EMOJI: Record<AgentId, string> = {
  orquestador: "👑",
  "estratega-oferta": "🎯",
  "copy-lanzamiento": "✍️",
  "disenador-creativo": "🎨",
  "seo-specialist": "🔍",
  "content-creator": "📝",
  "sem-manager": "📊",
  "community-manager": "💬",
  "data-analyst": "📈",
  "lead-qualifier": "🎯",
  "market-researcher": "🔬",
};

export default function AgentsScene() {
  const [data, setData] = useState<StatePayload | null>(null);
  const [selected, setSelected] = useState<AgentId | null>(null);
  const [animStates, setAnimStates] = useState<Record<AgentId, AgentAnimState>>({} as Record<AgentId, AgentAnimState>);
  const [awakeUntil, setAwakeUntil] = useState<Record<AgentId, number>>({} as Record<AgentId, number>);
  const [beams, setBeams] = useState<Beam[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Soy el Orquestador del equipo de marketing de FLUX. Tengo 9 agentes listos — estrategia, copy, diseño, SEO, content, SEM, community, data y leads. Dime qué quieres lanzar y pongo al equipo a trabajar.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [moodSeed, setMoodSeed] = useState(0);
  const [activityOpen, setActivityOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recordStart, setRecordStart] = useState<number | null>(null);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const cancelledRef = useRef(false);
  const inputSnapshotRef = useRef("");

  // Timer de duración de grabación
  useEffect(() => {
    if (!recording || !recordStart) return;
    const id = setInterval(() => {
      setRecordElapsed(Math.floor((Date.now() - recordStart) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [recording, recordStart]);

  // Atajos de teclado para la grabación
  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (recognitionRef.current) {
          cancelledRef.current = true;
          recognitionRef.current.abort();
        }
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (recognitionRef.current) {
          cancelledRef.current = false;
          recognitionRef.current.stop();
          // Damos tiempo a que onresult cierre antes de enviar
          setTimeout(() => sendMessage(), 250);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Rotate moods every 20s for liveliness
  useEffect(() => {
    const id = setInterval(() => setMoodSeed((s) => s + 1), 20000);
    return () => clearInterval(id);
  }, []);

  // Poll state every 5s
  const loadState = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/agents/state", { cache: "no-store" });
      if (!r.ok) return;
      const json = (await r.json()) as StatePayload;
      setData(json);
    } catch {}
  }, []);

  useEffect(() => {
    loadState();
    const id = setInterval(loadState, 5000);
    return () => clearInterval(id);
  }, [loadState]);

  // Auto-scroll chat
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [messages, streaming]);

  // Fade out beams after 6s
  useEffect(() => {
    if (beams.length === 0) return;
    const id = setInterval(() => {
      setBeams((prev) => prev.filter((b) => Date.now() - b.createdAt < 6000));
    }, 1000);
    return () => clearInterval(id);
  }, [beams.length]);

  const setAgentAnim = useCallback((id: AgentId, s: AgentAnimState, durationMs = 2500) => {
    setAnimStates((prev) => ({ ...prev, [id]: s }));
    if (s !== "idle") {
      // Se despierta: 3 min de garantía sin dormir después de la tarea
      const wakeUntil = Date.now() + durationMs + 3 * 60 * 1000;
      setAwakeUntil((prev) => ({ ...prev, [id]: Math.max(prev[id] ?? 0, wakeUntil) }));
      setTimeout(() => {
        setAnimStates((prev) => ({ ...prev, [id]: "idle" }));
      }, durationMs);
    }
  }, []);

  const fireBeam = useCallback((from: AgentId, to: AgentId, label: string) => {
    setBeams((prev) => [...prev, { id: `${from}-${to}-${Date.now()}`, from, to, label, createdAt: Date.now() }]);
  }, []);

  const startRecording = useCallback(() => {
    const w = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Tu navegador no soporta reconocimiento de voz nativo. Usá Chrome, Edge o Safari.");
      return;
    }

    cancelledRef.current = false;
    inputSnapshotRef.current = input;
    const rec = new Ctor();
    rec.lang = "es-PE";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean };
        const transcript = result[0].transcript;
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText) {
        setInput((prev) => (prev ? prev + " " : "") + finalText.trim());
        setInterimTranscript("");
      } else {
        setInterimTranscript(interim);
      }
    };

    rec.onend = () => {
      setRecording(false);
      setInterimTranscript("");
      setRecordStart(null);
      setRecordElapsed(0);
      recognitionRef.current = null;
      if (cancelledRef.current) {
        // Restauramos lo que había antes de grabar (cualquier texto final
        // que hubiera llegado en onresult se descarta)
        setInput(inputSnapshotRef.current);
      }
    };

    rec.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        console.warn("speech error", e.error);
      }
      setRecording(false);
      setInterimTranscript("");
      setRecordStart(null);
      setRecordElapsed(0);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setRecording(true);
    setRecordStart(Date.now());
    setRecordElapsed(0);
    rec.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      cancelledRef.current = false;
      recognitionRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (recognitionRef.current) {
      cancelledRef.current = true;
      recognitionRef.current.abort();
    }
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, ts: Date.now() };
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    setAgentAnim("orquestador", "thinking", 60000);

    try {
      const res = await fetch("/api/admin/agents/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error("chat failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const mentionedAgents = new Set<AgentId>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // update assistant message live (cleaned)
        const { clean, events } = parseOrchestratorText(buffer);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: clean } : m)),
        );

        // trigger animations for new mentions
        for (const ev of events) {
          if (mentionedAgents.has(ev.agent)) continue;
          mentionedAgents.add(ev.agent);
          // staggered animation
          const delay = mentionedAgents.size * 600;
          setTimeout(() => {
            setAgentAnim(ev.agent, ev.kind === "delegate" ? "working" : "receiving", 8000);
            fireBeam("orquestador", ev.agent, ev.kind === "delegate" ? "delegando" : "mencionando");
          }, delay);
        }
      }

      setAgentAnim("orquestador", "idle");
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "⚠️ No pude conectar con el orquestador. Revisa la API key de Anthropic." }
            : m,
        ),
      );
      setAgentAnim("orquestador", "idle");
    } finally {
      setStreaming(false);
    }
  };

  const agentMap = useMemo(() => {
    const m: Record<string, AgentMeta> = {};
    (data?.agents ?? []).forEach((a) => (m[a.id] = a));
    return m;
  }, [data]);

  const stateMap = useMemo(() => {
    const m: Record<string, AgentState> = {};
    (data?.states ?? []).forEach((s) => (m[s.id] = s));
    return m;
  }, [data]);

  const selectedAgent = selected ? agentMap[selected] : null;
  const selectedState = selected ? stateMap[selected] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-0 h-[calc(100vh-52px)] text-white font-mono">
      {/* LEFT: scene + activity feed */}
      <div className="flex flex-col overflow-hidden border-r border-white/10">
        {/* Scene */}
        <div
          ref={sceneRef}
          className="relative flex-1 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at center, #1a1a2e 0%, #0A0A14 70%), repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 40px)",
          }}
        >
          {/* Stars layer */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-[2px] h-[2px] bg-white rounded-full animate-pulse"
                style={{
                  top: `${(i * 37) % 100}%`,
                  left: `${(i * 71) % 100}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>

          {/* Cluster labels */}
          <div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-white/40">
            FLUX Marketing · Live
          </div>

          {/* Banner cuando corre en un entorno sin filesystem local */}
          {data?.rootExists === false && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 max-w-xl w-full mx-4">
              <div className="bg-amber-400/10 border border-amber-400/40 rounded-lg px-3 py-2 text-[11px] text-amber-200 backdrop-blur">
                <strong className="text-amber-300">Modo demo</strong> — los agentes viven en <code className="text-amber-100">/Users/securex07/flux-marketing/</code> que solo existe en la máquina local de Edson. En Vercel se ve la escena sin data de archivos. El chat con el Orquestador sí funciona.
              </div>
            </div>
          )}
          <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] text-white/60">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            {data ? `${data.agents.length} agentes · ${data.activity.length} eventos` : "cargando…"}
          </div>

          {/* Cluster rings */}
          <ClusterRing label="Pipeline creativo" x={50} y={26} w={76} h={28} color="#A78BFA" />
          <ClusterRing label="Crecimiento" x={50} y={60} w={88} h={14} color="#34D399" />
          <ClusterRing label="Leads & Research" x={50} y={82} w={36} h={12} color="#06B6D4" />

          {/* Beams */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {beams.map((beam) => {
              const from = agentMap[beam.from];
              const to = agentMap[beam.to];
              if (!from || !to) return null;
              const age = (Date.now() - beam.createdAt) / 6000;
              const opacity = Math.max(0, 1 - age);
              return (
                <g key={beam.id}>
                  <line
                    x1={`${from.x}%`}
                    y1={`${from.y}%`}
                    x2={`${to.x}%`}
                    y2={`${to.y}%`}
                    stroke="#FFB547"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    opacity={opacity * 0.8}
                    filter="url(#glow)"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-20"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </line>
                </g>
              );
            })}
          </svg>

          {/* Agents */}
          {data?.agents.map((agent) => {
            const state = stateMap[agent.id];
            const anim = animStates[agent.id] ?? "idle";
            // Si el agente está en un estado activo, lo "despierta": mood motivated
            // sobrescribe cualquier sleepy/tired. Esto hace la animación dinámica.
            const baseMood = computeMood(agent, state, moodSeed, awakeUntil[agent.id] ?? 0);
            const mood: AgentMood =
              anim === "working" || anim === "receiving"
                ? "motivated"
                : anim === "thinking"
                  ? "creative"
                  : baseMood;
            const isSelected = selected === agent.id;
            return (
              <AgentAvatar
                key={agent.id}
                agent={agent}
                state={state}
                anim={anim}
                mood={mood}
                selected={isSelected}
                onClick={() => setSelected(agent.id)}
              />
            );
          })}

          {/* Floating activity button */}
          <button
            onClick={() => setActivityOpen((o) => !o)}
            className="absolute bottom-4 left-4 z-20 px-3 py-2 rounded-lg bg-black/70 border border-white/15 text-[11px] text-white/80 hover:bg-black/90 hover:border-white/30 flex items-center gap-2 backdrop-blur"
          >
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Actividad
            {data && data.activity.length > 0 && (
              <span className="text-white/50">· {data.activity.length}</span>
            )}
          </button>

          {/* Floating download button */}
          <a
            href="/api/admin/agents/download?all=1"
            className="absolute bottom-4 right-4 z-20 px-3 py-2 rounded-lg bg-black/70 border border-white/15 text-[11px] text-emerald-300 hover:bg-black/90 hover:border-emerald-400/40 backdrop-blur"
          >
            ↓ descargar workspace
          </a>

          {/* Slide-up activity panel */}
          <AnimatePresence>
            {activityOpen && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="absolute left-4 right-4 bottom-16 z-20 max-h-[50vh] rounded-xl bg-black/85 backdrop-blur border border-white/15 overflow-hidden flex flex-col"
              >
                <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-white/50">
                    Actividad reciente
                  </span>
                  <button
                    onClick={() => setActivityOpen(false)}
                    className="text-white/40 hover:text-white text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="overflow-y-auto px-4 py-2">
                  {data?.activity.slice(0, 40).map((ev) => {
                    const a = agentMap[ev.agent];
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-2 py-0.5 text-[11px] text-white/70 hover:text-white cursor-pointer"
                        onClick={() => {
                          setSelected(ev.agent);
                          setActivityOpen(false);
                        }}
                      >
                        <span className="text-white/40 w-14 shrink-0">{timeAgo(ev.ts)}</span>
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ background: a?.color ?? "#888" }}
                        />
                        <span className="shrink-0 text-white/80 w-20 truncate">
                          {a?.name ?? ev.agent}
                        </span>
                        <span className="text-white/40 truncate">{ev.relPath}</span>
                      </div>
                    );
                  })}
                  {data && data.activity.length === 0 && (
                    <div className="text-[11px] text-white/40 py-4 text-center">
                      sin actividad todavía — cuando los agentes escriban archivos aparecerán aquí
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT: chat with orchestrator */}
      <div className="flex flex-col bg-black/60 backdrop-blur overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-xl">
            👑
          </div>
          <div>
            <div className="text-sm font-semibold">Orquestador</div>
            <div className="text-[10px] text-white/50">
              {streaming ? "pensando…" : "listo · dime qué quieres lanzar"}
            </div>
          </div>
        </div>
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <ChatBubble key={m.id} msg={m} onImageClick={setLightbox} />
          ))}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex items-center gap-1 text-white/40 text-xs">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
        </div>
        {/* El form cambia completamente de forma en recording */}
        <div className="border-t border-white/10 relative">
          <AnimatePresence mode="wait">
            {recording ? (
              <motion.div
                key="rec"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3"
              >
                <RecordingPanel
                  elapsed={recordElapsed}
                  interim={interimTranscript}
                  finalText={input.slice(inputSnapshotRef.current.length).trim()}
                  onCancel={cancelRecording}
                  onStopAndSend={async () => {
                    stopRecording();
                    // pequeño delay para que onresult cierre
                    setTimeout(() => {
                      sendMessage();
                    }, 200);
                  }}
                  onStop={stopRecording}
                />
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="p-3 flex gap-2 items-center"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={streaming}
                  placeholder="Ej: lanza campaña para agencias creativas de Lima"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-400/60"
                />
                <motion.button
                  type="button"
                  onClick={startRecording}
                  disabled={streaming}
                  title="Grabar nota de voz (es-PE)"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-red-500/20 hover:text-red-300 border border-white/15 hover:border-red-400/50 disabled:opacity-30 flex items-center justify-center text-lg transition-colors"
                >
                  🎙
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-full bg-amber-400 text-black text-lg font-bold disabled:opacity-30 hover:bg-amber-300 flex items-center justify-center"
                >
                  ↑
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail panel (modal-ish overlay from bottom) */}
      <AnimatePresence>
        {selectedAgent && selectedState && (
          <AgentDetailPanel
            agent={selectedAgent}
            state={selectedState}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* Lightbox for chat images */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RecordingPanel({
  elapsed,
  interim,
  finalText,
  onCancel,
  onStop,
  onStopAndSend,
}: {
  elapsed: number;
  interim: string;
  finalText: string;
  onCancel: () => void;
  onStop: () => void;
  onStopAndSend: () => void;
}) {
  const hasText = finalText.length > 0 || interim.length > 0;
  // 18 barritas de waveform animadas con delays distintos
  const bars = Array.from({ length: 18 });
  return (
    <div className="rounded-xl bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent border border-red-500/40 p-3">
      <div className="flex items-center gap-3 mb-2">
        {/* Pulse dot */}
        <div className="relative flex items-center justify-center shrink-0">
          <motion.div
            className="absolute w-8 h-8 border border-red-400 rounded-full"
            animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
            transition={{ duration: 1.3, repeat: Infinity }}
          />
          <div className="w-3 h-3 bg-red-500 rounded-full" />
        </div>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-[3px] h-8">
          {bars.map((_, i) => (
            <motion.div
              key={i}
              className="w-[3px] bg-red-400 rounded-full"
              animate={{
                height: [
                  `${20 + ((i * 7) % 30)}%`,
                  `${60 + ((i * 13) % 40)}%`,
                  `${25 + ((i * 11) % 30)}%`,
                ],
              }}
              transition={{
                duration: 0.6 + (i % 4) * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (i * 0.04) % 0.5,
              }}
              style={{ minHeight: 4 }}
            />
          ))}
        </div>

        {/* Timer */}
        <div className="text-red-300 font-mono text-sm font-bold tabular-nums shrink-0">
          {formatDuration(elapsed)}
        </div>
      </div>

      {/* Transcript preview */}
      <div className="min-h-[34px] max-h-[80px] overflow-y-auto bg-black/30 rounded-lg px-3 py-2 text-[12px] text-white/85 leading-snug mb-3">
        {finalText && <span>{finalText}</span>}
        {interim && <span className="italic text-white/50">{finalText ? " " : ""}{interim}</span>}
        {!hasText && <span className="text-white/30 italic">empezá a hablar…</span>}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <motion.button
          onClick={onCancel}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 border border-white/15 flex items-center justify-center text-sm"
          title="Cancelar y descartar"
        >
          ✕
        </motion.button>

        <motion.button
          onClick={onStop}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-1 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 text-[11px] font-semibold"
          title="Parar y revisar antes de enviar"
        >
          ■ Parar y revisar
        </motion.button>

        <motion.button
          onClick={onStopAndSend}
          disabled={!hasText}
          whileHover={{ scale: hasText ? 1.05 : 1 }}
          whileTap={{ scale: hasText ? 0.95 : 1 }}
          className="w-9 h-9 rounded-full bg-amber-400 text-black flex items-center justify-center text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          title="Parar y enviar al Orquestador"
        >
          ↑
        </motion.button>
      </div>

      {/* Hint */}
      <div className="text-[9px] text-white/40 text-center mt-2">
        esc cancela · enter manda
      </div>
    </div>
  );
}

function ClusterRing({ label, x, y, w, h, color }: { label: string; x: number; y: number; w: number; h: number; color: string }) {
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

function AgentAvatar({
  agent,
  state,
  anim,
  mood,
  selected,
  onClick,
}: {
  agent: AgentMeta;
  state?: AgentState;
  anim: AgentAnimState;
  mood: AgentMood;
  selected: boolean;
  onClick: () => void;
}) {
  const isOrchestrator = agent.id === "orquestador";
  const size = isOrchestrator ? 88 : 72;
  const [hovered, setHovered] = useState(false);
  const [phrase, setPhrase] = useState<string>("");

  const onHoverStart = () => {
    setHovered(true);
    const pool = agent.catchphrases;
    setPhrase(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={onHoverStart}
      onHoverEnd={() => setHovered(false)}
      className="absolute group"
      style={{
        left: `${agent.x}%`,
        top: `${agent.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: hovered ? 20 : isOrchestrator ? 10 : 6,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: anim === "thinking" ? [0, -4, 0] : anim === "working" ? [0, -2, 0] : [0, -1, 0],
      }}
      transition={{
        scale: { duration: 0.5, delay: agent.x * 0.003 },
        opacity: { duration: 0.5, delay: agent.x * 0.003 },
        y: {
          duration: anim === "thinking" ? 0.6 : anim === "working" ? 0.4 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
      whileHover={{ scale: 1.18, rotate: [-3, 3, -3, 0] }}
      whileTap={{ scale: 0.92 }}
    >
      {/* Speech bubble on hover */}
      <AnimatePresence>
        {hovered && phrase && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute left-1/2 pointer-events-none"
            style={{
              bottom: "calc(100% + 16px)",
              transform: "translateX(-50%)",
              zIndex: 30,
            }}
          >
            <div
              className="relative px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: "#ffffff",
                color: "#18181B",
                boxShadow: `0 4px 20px ${agent.color}66, 0 0 0 2px ${agent.color}`,
                maxWidth: 220,
                whiteSpace: "normal",
                textAlign: "center",
              }}
            >
              {phrase}
              {/* pointer */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  bottom: -6,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: `6px solid ${agent.color}`,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ground shadow */}
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 w-12 h-2 bg-black/40 rounded-full blur-sm"
        style={{ marginBottom: -6 }}
      />

      {/* glow for active states */}
      {(anim !== "idle" || selected) && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${agent.color}66 0%, transparent 70%)`,
            width: size * 1.8,
            height: size * 1.8,
            left: -size * 0.4,
            top: -size * 0.4,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* pixel avatar */}
      <PixelAvatar
        color={agent.color}
        colorDark={agent.colorDark}
        size={size}
        state={anim}
        mood={mood}
        accessory={agent.accessory}
      />

      {/* thinking bubble */}
      {anim === "thinking" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg"
        >
          💭
        </motion.div>
      )}
      {anim === "working" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg"
        >
          ⚡
        </motion.div>
      )}
      {anim === "receiving" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm"
        >
          📨
        </motion.div>
      )}

      {/* name tag — arriba si está en la zona baja para no salir del viewport */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap px-2 py-0.5 rounded ${
          agent.y > 75 ? "bottom-full mb-2" : "top-full mt-2"
        }`}
        style={{
          background: selected ? agent.color : "rgba(0,0,0,0.75)",
          color: selected ? "#000" : "#fff",
          border: `1px solid ${agent.color}40`,
        }}
      >
        {AGENT_EMOJI[agent.id]} {agent.name}
      </div>

      {/* files count indicator — abajo-derecha para no chocar con accesorios de la cabeza */}
      {state && state.filesCount > 0 && (
        <div
          className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1 rounded-full border"
          style={{ background: "#0A0A14", color: agent.color, borderColor: agent.color }}
        >
          {state.filesCount}
        </div>
      )}
    </motion.button>
  );
}

/**
 * Mini markdown renderer — sin dependencias.
 * Soporta:
 *   - ![alt](url)            → imagen (con lightbox al click)
 *   - [text](url)            → link
 *   - **bold**               → negrita
 *   - `code`                 → inline code
 *   - ```lang\n…```          → code block
 *   - # ## ###               → headings
 *   - - item / 1. item       → listas
 *   - --- / ***              → hr
 *   - [[file:path|label]]    → tarjeta de archivo descargable
 *   - [[flow]]…[[/flow]]     → diagrama ASCII en caja
 */
function MarkdownLite({ text, onImageClick }: { text: string; onImageClick: (url: string) => void }) {
  const blocks: React.ReactNode[] = [];
  let key = 0;

  // First extract fenced code blocks to protect them from other parsing
  const codeBlockRe = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: { type: "text" | "code" | "flow"; lang?: string; content: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeBlockRe.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1], content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });

  // Also extract [[flow]]…[[/flow]] from text parts
  const expanded: typeof parts = [];
  for (const p of parts) {
    if (p.type !== "text") {
      expanded.push(p);
      continue;
    }
    const flowRe = /\[\[flow\]\]([\s\S]*?)\[\[\/flow\]\]/g;
    let flast = 0;
    let fm: RegExpExecArray | null;
    while ((fm = flowRe.exec(p.content)) !== null) {
      if (fm.index > flast) expanded.push({ type: "text", content: p.content.slice(flast, fm.index) });
      expanded.push({ type: "flow", content: fm[1].trim() });
      flast = fm.index + fm[0].length;
    }
    if (flast < p.content.length) expanded.push({ type: "text", content: p.content.slice(flast) });
  }

  for (const part of expanded) {
    if (part.type === "code") {
      blocks.push(
        <pre
          key={`c-${key++}`}
          className="my-2 p-2 rounded-lg bg-black/60 border border-white/10 text-[10px] text-emerald-200 overflow-x-auto font-mono"
        >
          {part.lang && <div className="text-[8px] uppercase text-white/40 mb-1">{part.lang}</div>}
          {part.content}
        </pre>,
      );
      continue;
    }
    if (part.type === "flow") {
      blocks.push(
        <pre
          key={`f-${key++}`}
          className="my-2 p-3 rounded-lg bg-gradient-to-br from-amber-400/10 to-transparent border border-amber-400/30 text-[10px] text-amber-100 font-mono whitespace-pre overflow-x-auto"
        >
          <div className="text-[8px] uppercase text-amber-400 mb-1">Flujo</div>
          {part.content}
        </pre>,
      );
      continue;
    }

    // Text part — split by lines, handle block-level first
    const lines = part.content.split("\n");
    let buf: string[] = [];
    const flushPara = () => {
      if (buf.length === 0) return;
      const joined = buf.join("\n").trim();
      if (joined) blocks.push(<p key={`p-${key++}`} className="my-1.5">{renderInline(joined, key++, onImageClick)}</p>);
      buf = [];
    };
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (/^#{1,3}\s/.test(line)) {
        flushPara();
        const level = line.match(/^(#{1,3})\s/)![1].length;
        const txt = line.replace(/^#{1,3}\s/, "");
        const Tag = (`h${level + 2}` as unknown) as keyof React.JSX.IntrinsicElements;
        blocks.push(
          // eslint-disable-next-line react/no-children-prop
          <Tag key={`h-${key++}`} className="font-bold text-white mt-2 mb-1" children={renderInline(txt, key++, onImageClick)} />,
        );
      } else if (/^\s*[-*]\s/.test(line)) {
        flushPara();
        blocks.push(
          <div key={`li-${key++}`} className="flex gap-1.5 my-0.5">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{renderInline(line.replace(/^\s*[-*]\s/, ""), key++, onImageClick)}</span>
          </div>,
        );
      } else if (/^\s*\d+\.\s/.test(line)) {
        flushPara();
        const num = line.match(/^\s*(\d+)\./)![1];
        blocks.push(
          <div key={`ol-${key++}`} className="flex gap-1.5 my-0.5">
            <span className="text-amber-400 shrink-0">{num}.</span>
            <span>{renderInline(line.replace(/^\s*\d+\.\s/, ""), key++, onImageClick)}</span>
          </div>,
        );
      } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flushPara();
        blocks.push(<hr key={`hr-${key++}`} className="my-2 border-white/10" />);
      } else if (line === "") {
        flushPara();
      } else {
        buf.push(line);
      }
    }
    flushPara();
  }

  return <>{blocks}</>;
}

function renderInline(text: string, baseKey: number, onImageClick: (url: string) => void): React.ReactNode {
  const out: React.ReactNode[] = [];
  let k = baseKey * 1000;
  let remaining = text;

  // Pattern order: image, file card, link, bold, code
  const patterns: { re: RegExp; handle: (m: RegExpExecArray) => React.ReactNode }[] = [
    {
      re: /!\[([^\]]*)\]\(([^)]+)\)/,
      handle: (m) => (
        <button
          key={`img-${k++}`}
          onClick={() => onImageClick(m[2])}
          className="block my-2 rounded-lg overflow-hidden border border-white/10 hover:border-amber-400/60 transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m[2]} alt={m[1]} className="max-w-full max-h-64 object-contain bg-black/40" />
          {m[1] && <div className="text-[9px] text-white/50 px-2 py-1 bg-black/60">{m[1]}</div>}
        </button>
      ),
    },
    {
      re: /\[\[file:([^|\]]+)(?:\|([^\]]+))?\]\]/,
      handle: (m) => {
        const path = m[1];
        const label = m[2] || path.split("/").pop() || path;
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const icon = ext === "pdf" ? "📄" : ext === "md" ? "📝" : ext === "csv" || ext === "xlsx" ? "📊" : "📎";
        return (
          <a
            key={`f-${k++}`}
            href={`/api/admin/agents/file?path=${encodeURIComponent(path)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 my-1 px-3 py-2 rounded-lg bg-white/5 border border-white/15 hover:border-amber-400/60 text-[11px] no-underline"
          >
            <span className="text-lg">{icon}</span>
            <span className="text-white/90">{label}</span>
            <span className="text-white/40">↓</span>
          </a>
        );
      },
    },
    {
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      handle: (m) => (
        <a key={`a-${k++}`} href={m[2]} target="_blank" rel="noreferrer" className="text-amber-300 underline">
          {m[1]}
        </a>
      ),
    },
    { re: /\*\*([^*]+)\*\*/, handle: (m) => <strong key={`b-${k++}`} className="font-bold">{m[1]}</strong> },
    {
      re: /`([^`]+)`/,
      handle: (m) => (
        <code key={`c-${k++}`} className="px-1 py-0.5 rounded bg-black/40 text-emerald-200 text-[11px]">
          {m[1]}
        </code>
      ),
    },
  ];

  while (remaining.length > 0) {
    let earliest: { idx: number; len: number; node: React.ReactNode } | null = null;
    for (const pat of patterns) {
      const match = pat.re.exec(remaining);
      if (!match) continue;
      if (earliest === null || match.index < earliest.idx) {
        earliest = { idx: match.index, len: match[0].length, node: pat.handle(match) };
      }
    }
    if (!earliest) {
      out.push(remaining);
      break;
    }
    if (earliest.idx > 0) out.push(remaining.slice(0, earliest.idx));
    out.push(earliest.node);
    remaining = remaining.slice(earliest.idx + earliest.len);
  }

  return <>{out}</>;
}

function ChatBubble({ msg, onImageClick }: { msg: ChatMessage; onImageClick: (url: string) => void }) {
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

function AgentDetailPanel({
  agent,
  state,
  onClose,
}: {
  agent: AgentMeta;
  state: AgentState;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "memory" | "files">("overview");
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);

  const openFile = async (f: FileEntry) => {
    const r = await fetch(`/api/admin/agents/file?path=${encodeURIComponent(f.path)}`);
    if (r.ok) {
      const json = await r.json();
      setFileContent({ path: f.name, content: json.content });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[#0E0E1A] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: `0 0 60px ${agent.color}33` }}
      >
        {/* Header */}
        <div
          className="p-5 border-b border-white/10 flex items-start gap-4"
          style={{ background: `linear-gradient(135deg, ${agent.color}22 0%, transparent 60%)` }}
        >
          <div style={{ flex: "0 0 auto" }}>
            <PixelAvatar
              color={agent.color}
              colorDark={agent.colorDark}
              size={72}
              state="idle"
              mood="motivated"
              accessory={agent.accessory}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/40">{agent.role}</div>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {AGENT_EMOJI[agent.id]} {agent.title}
            </h2>
            <p className="text-sm text-white/60 mt-1">{agent.tagline}</p>
            <div className="flex gap-3 mt-3 text-[11px]">
              <span className="text-white/50">
                📁 <strong className="text-white">{state.filesCount}</strong> archivos
              </span>
              <span className="text-white/50">
                🕐 última actividad{" "}
                <strong className="text-white">
                  {state.lastActivity ? timeAgo(state.lastActivity) : "nunca"}
                </strong>
              </span>
              <span className="text-white/50">
                📂 <strong className="text-white">{state.outputFolders.length}</strong> carpetas
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 border-b border-white/10">
          {(["overview", "memory", "files"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs uppercase tracking-wider border-b-2 ${
                tab === t
                  ? "border-amber-400 text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t === "overview" ? "Vista" : t === "memory" ? "Memoria" : "Archivos"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/api/admin/agents/download?agent=${agent.id}`}
              className="text-[11px] text-emerald-300 hover:text-emerald-200 underline py-2"
            >
              ↓ descargar bundle
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {tab === "overview" && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                  Carpetas del workspace
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {state.outputFolders.length === 0 && (
                    <span className="text-white/30 text-xs">aún no creadas</span>
                  )}
                  {state.outputFolders.map((f) => (
                    <span
                      key={f}
                      className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/70"
                    >
                      {f}/
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                  Archivos más recientes
                </div>
                <div className="space-y-1">
                  {state.latestFiles.slice(0, 8).map((f) => (
                    <button
                      key={f.path}
                      onClick={() => openFile(f)}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-[11px] text-white/70"
                    >
                      <span className="text-white/40 shrink-0 w-20">{timeAgo(f.mtime)}</span>
                      <span className="truncate text-white/80">{f.name}</span>
                      <span className="text-white/30 shrink-0 ml-auto">
                        {(f.size / 1024).toFixed(1)}kb
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "memory" && (
            <div>
              {state.memory ? (
                <pre className="whitespace-pre-wrap text-[12px] text-white/80 font-mono leading-relaxed">
                  {state.memory}
                </pre>
              ) : (
                <div className="text-white/40 text-center py-8">
                  Este agente todavía no tiene memoria escrita. Aparecerá aquí cuando escriba su{" "}
                  <code>memory.md</code>.
                </div>
              )}
            </div>
          )}

          {tab === "files" && (
            <div className="space-y-1">
              {state.latestFiles.map((f) => (
                <button
                  key={f.path}
                  onClick={() => openFile(f)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-[11px] text-white/70"
                >
                  <span className="text-white/40 shrink-0 w-20">{timeAgo(f.mtime)}</span>
                  <span className="truncate text-white/80 flex-1">
                    {f.path.replace("/Users/securex07/flux-marketing/" + agent.id + "/", "")}
                  </span>
                  <span className="text-white/30 shrink-0">{(f.size / 1024).toFixed(1)}kb</span>
                </button>
              ))}
              {state.latestFiles.length === 0 && (
                <div className="text-white/40 text-center py-8">sin archivos todavía</div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* File viewer modal */}
      <AnimatePresence>
        {fileContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setFileContent(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-[#0A0A14] border border-white/20 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="text-xs text-white/70 font-mono">{fileContent.path}</div>
                <button
                  onClick={() => setFileContent(null)}
                  className="text-white/50 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-[11px] text-white/80 font-mono whitespace-pre-wrap">
                {fileContent.content}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
