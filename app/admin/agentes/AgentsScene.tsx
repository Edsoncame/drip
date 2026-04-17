"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentId, AgentMeta, AgentState, FileEntry, ActivityEvent, AgentBlocker } from "@/lib/agents";
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

type DelegationStatus = {
  id: string;
  agent: AgentId;
  task: string;
  status: "running" | "done" | "error";
  result?: {
    text: string;
    filesWritten: { relPath: string; size: number }[];
    error?: string;
    durationMs: number;
  };
};

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
  // 1. Trabajando AHORA → motivated (el cuerpo también se anima working por
  //    state.isRunning en el avatar)
  if (state?.isRunning) return "motivated";

  // 2. Recién despierto (timer interno post-delegación) → motivated
  if (Date.now() < awakeUntil) return "motivated";

  // 3. Nunca trabajó O hace >10 min que terminó → DORMIDO (default)
  //    El usuario quiere que los inactivos estén dormidos, no en standby.
  if (!state || state.lastActivity === null) return "sleepy";

  const age = Date.now() - state.lastActivity;
  const MIN = 60 * 1000;

  // 4. Acaba de terminar hace poco (<10 min) → motivated/normal
  if (age < 5 * MIN) return "motivated";
  if (age < 10 * MIN) return "normal";

  // 5. Pasaron 10+ min sin nada → a dormir
  if (state.filesCount > 20) return "stressed"; // salvo que esté sobrecargado
  return "sleepy";

  // Default (fallback si ninguna regla match): dormido
  return "sleepy";
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
  "programador-fullstack": "💻",
};

export default function AgentsScene() {
  const [data, setData] = useState<StatePayload | null>(null);
  const [selected, setSelected] = useState<AgentId | null>(null);
  const [animStates, setAnimStates] = useState<Record<AgentId, AgentAnimState>>({} as Record<AgentId, AgentAnimState>);
  const [awakeUntil, setAwakeUntil] = useState<Record<AgentId, number>>({} as Record<AgentId, number>);
  const [beams, setBeams] = useState<Beam[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Cargar conversación persistida del localStorage (sobrevive refreshes)
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("flux-agents-chat");
        if (stored) {
          const parsed = JSON.parse(stored) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Soy el Head of Growth del equipo de marketing de FLUX. Tengo 10 agentes a mi cargo — estrategia, copy, diseño, SEO, content, SEM, community, data, leads, research y full-stack engineering. Dime qué quieres lanzar.",
        ts: Date.now(),
      },
    ];
  });

  // Persistir el historial del chat cada vez que cambia
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Limite: últimos 100 mensajes para no explotar el localStorage
      const trimmed = messages.slice(-100);
      window.localStorage.setItem("flux-agents-chat", JSON.stringify(trimmed));
    } catch {
      // storage lleno o disabled — ignoramos
    }
  }, [messages]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [moodSeed, setMoodSeed] = useState(0);
  const [activityOpen, setActivityOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<DelegationStatus[]>([]);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotContinuous, setAutopilotContinuous] = useState(false);
  const [autopilotNextTick, setAutopilotNextTick] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<
    { id: number; title: string; filename: string; size: number; contentType: string | null; blobUrl: string | null }[]
  >([]);
  // Múltiples imágenes pendientes de subir en el chat principal
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [globalDragging, setGlobalDragging] = useState(false);
  const globalDragCounterRef = useRef(0);
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

  // Rotate mood seed cada 30s solo para que el tiempo pase (recalcula age)
  useEffect(() => {
    const id = setInterval(() => setMoodSeed((s) => s + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Drag & drop global al chat principal. Cualquier imagen arrastrada a la
  // escena se sube como attachment al chat del Growth.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      globalDragCounterRef.current++;
      setGlobalDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      globalDragCounterRef.current--;
      if (globalDragCounterRef.current <= 0) {
        globalDragCounterRef.current = 0;
        setGlobalDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      globalDragCounterRef.current = 0;
      setGlobalDragging(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      // Subir TODOS los archivos droppeados
      for (let i = 0; i < files.length; i++) {
        uploadFile(files[i], "reference");
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown del próximo tick cuando está en modo continuo
  useEffect(() => {
    if (!autopilotContinuous || !autopilotNextTick) return;
    const id = setInterval(() => {
      setMoodSeed((s) => s + 1); // forzar re-render del contador
    }, 1000);
    return () => clearInterval(id);
  }, [autopilotContinuous, autopilotNextTick]);

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

  /**
   * Dispara un tick de autopilot: el server elige los 3 agentes más idle
   * y los ejecuta con modo proactivo (cada uno decide qué hacer según su
   * CLAUDE.md). No requiere prompt del usuario.
   */
  const triggerAutopilot = useCallback(async () => {
    if (autopilotRunning) return;
    setAutopilotRunning(true);
    setAutopilotNextTick(null);
    try {
      const res = await fetch("/api/admin/agents/autopilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max: 3, ignoreCooldown: true }),
      });
      const json = await res.json();
      if (json.results) {
        for (const r of json.results) {
          if (r.status === "executed" && r.run) {
            setDelegations((prev) => [
              ...prev,
              {
                id: `auto-${Date.now()}-${r.agent}`,
                agent: r.agent,
                task: "Autopilot — decidiendo qué hacer",
                status: r.run.success ? "done" : "error",
                result: {
                  text: r.run.text ?? "",
                  filesWritten: r.run.filesWritten ?? [],
                  error: r.run.error,
                  durationMs: r.run.durationMs ?? 0,
                },
              },
            ]);
          }
        }
      }
      loadState();
    } catch {
      // swallow — ya se ve en el panel si falló
    } finally {
      setAutopilotRunning(false);
    }
  }, [autopilotRunning, loadState]);

  // Loop continuo: cuando está activo, dispara un tick cada 10 min
  useEffect(() => {
    if (!autopilotContinuous) {
      setAutopilotNextTick(null);
      return;
    }
    const TICK_INTERVAL = 10 * 60 * 1000;
    let active = true;
    const scheduleNext = () => {
      const next = Date.now() + TICK_INTERVAL;
      setAutopilotNextTick(next);
      const t = setTimeout(async () => {
        if (!active) return;
        await triggerAutopilot();
        if (active) scheduleNext();
      }, TICK_INTERVAL);
      return t;
    };
    // Primer tick inmediato al activar
    triggerAutopilot().then(() => {
      if (active) scheduleNext();
    });
    return () => {
      active = false;
      setAutopilotNextTick(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotContinuous]);

  /**
   * Dispara la ejecución real del subagente en el server.
   * Llama a /api/admin/agents/delegate con {agent, task}, y cuando termina
   * refresca el estado para que los archivos nuevos aparezcan en la escena.
   */
  const executeDelegation = useCallback(
    async (agentId: AgentId, task: string) => {
      const id = `del-${Date.now()}-${agentId}`;
      setDelegations((prev) => [
        ...prev,
        { id, agent: agentId, task, status: "running" },
      ]);
      // Tener al agente "working" mientras corre
      setAgentAnim(agentId, "working", 120000);

      try {
        const res = await fetch("/api/admin/agents/delegate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agent: agentId, task }),
        });
        const json = await res.json();
        const agentName = agentMap[agentId]?.name ?? agentId;
        if (!res.ok || !json.success) {
          setDelegations((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    status: "error",
                    result: {
                      text: "",
                      filesWritten: [],
                      error: json.error || "fallo desconocido",
                      durationMs: json.durationMs ?? 0,
                    },
                  }
                : d,
            ),
          );
          // Notificar en el chat que falló
          setMessages((prev) => [
            ...prev,
            {
              id: `del-err-${Date.now()}-${agentId}`,
              role: "assistant",
              content: `❌ **${agentName}** falló: \`${json.error || "error desconocido"}\``,
              ts: Date.now(),
            },
          ]);
          setAgentAnim(agentId, "idle");
          return;
        }
        setDelegations((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "done",
                  result: {
                    text: json.text,
                    filesWritten: json.filesWritten,
                    durationMs: json.durationMs,
                  },
                }
              : d,
          ),
        );
        // Notificar en el chat que terminó con resultado
        const filesInfo = json.filesWritten?.length > 0
          ? `\n📝 Archivos: ${json.filesWritten.map((f: { relPath: string; size: number }) => `\`${f.relPath}\` (${(f.size / 1024).toFixed(1)}kb)`).join(", ")}`
          : "";
        const summary = json.text?.slice(0, 300) || "(sin resumen)";
        setMessages((prev) => [
          ...prev,
          {
            id: `del-ok-${Date.now()}-${agentId}`,
            role: "assistant",
            content: `✅ **${agentName}** terminó (${(json.durationMs / 1000).toFixed(1)}s)${filesInfo}\n\n> ${summary}${json.text?.length > 300 ? "…" : ""}`,
            ts: Date.now(),
          },
        ]);
        setAgentAnim(agentId, "idle");
        loadState();
      } catch (err) {
        setDelegations((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "error",
                  result: {
                    text: "",
                    filesWritten: [],
                    error: err instanceof Error ? err.message : "network error",
                    durationMs: 0,
                  },
                }
              : d,
          ),
        );
        setAgentAnim(agentId, "idle");
      }
    },
    [setAgentAnim, loadState],
  );

  const uploadFile = useCallback(async (file: File, kind = "reference") => {
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      form.append("title", file.name);
      const res = await fetch("/api/admin/agents/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("upload failed");
      const json = await res.json();
      if (json.attachment) {
        setAttachedFiles((prev) => [
          ...prev,
          {
            id: json.attachment.id,
            title: json.attachment.title,
            filename: json.attachment.filename,
            size: json.attachment.size_bytes,
            contentType: json.attachment.content_type,
            blobUrl: json.attachment.blob_url,
          },
        ]);
        // Metemos una mini-línea al input con referencia al archivo
        setInput((prev) =>
          (prev ? prev + " " : "") + `[adjunté ${file.name} como referencia]`,
        );
      }
    } catch (err) {
      alert("No pude subir el archivo: " + (err instanceof Error ? err.message : ""));
    } finally {
      setUploadingFile(false);
    }
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

  const sendMessage = async (retryCount = 0) => {
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
          // Solo últimos 6 mensajes para no explotar el context window
          messages: [...messages, userMsg]
            .filter((m) => m.id !== "welcome")
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })),
          // URLs de imágenes adjuntadas para pasarlas como vision input a Claude
          imageUrls: attachedFiles
            .filter((f) => f.contentType?.startsWith("image/") && f.blobUrl)
            .map((f) => f.blobUrl),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
      }
      if (!res.body) throw new Error("response sin stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const mentionedAgents = new Set<AgentId>();
      const firedDelegations = new Set<string>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // update assistant message live (cleaned)
        const { clean, events } = parseOrchestratorText(buffer);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: clean } : m)),
        );

        // trigger animations for new mentions + fire real delegations
        for (const ev of events) {
          // Beam + anim la primera vez que se ve este agente
          if (!mentionedAgents.has(ev.agent)) {
            mentionedAgents.add(ev.agent);
            const delay = mentionedAgents.size * 600;
            setTimeout(() => {
              setAgentAnim(ev.agent, ev.kind === "delegate" ? "working" : "receiving", 8000);
              fireBeam("orquestador", ev.agent, ev.kind === "delegate" ? "delegando" : "mencionando");
            }, delay);
          }

          // Si es una delegación con tarea concreta, la disparamos UNA sola vez
          if (ev.kind === "delegate" && ev.message) {
            const key = `${ev.agent}::${ev.message.slice(0, 80)}`;
            if (!firedDelegations.has(key)) {
              firedDelegations.add(key);
              // Fire and forget — el runner corre en paralelo con el resto del stream
              executeDelegation(ev.agent, ev.message);
            }
          }
        }
      }

      setAgentAnim("orquestador", "idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Auto-retry una vez si es network error
      if (retryCount < 1 && (msg.includes("network") || msg.includes("fetch") || msg.includes("Failed"))) {
        console.log("[chat] auto-retry #" + (retryCount + 1));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "🔄 Reintentando conexión…" }
              : m,
          ),
        );
        setAgentAnim("orquestador", "thinking", 30000);
        setTimeout(() => {
          setStreaming(false);
          sendMessage(retryCount + 1);
        }, 2000);
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: `⚠️ **Error del servidor**\n\n\`\`\`\n${msg}\n\`\`\``,
                // Marcamos que tiene retry disponible
                id: `error-${Date.now()}`,
              }
            : m,
        ),
      );
      // Agregar botón de retry como mensaje separado
      setMessages((prev) => [
        ...prev,
        {
          id: `retry-btn-${Date.now()}`,
          role: "assistant" as const,
          content: "__RETRY_BUTTON__",
          ts: Date.now(),
        },
      ]);
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
          <div className="absolute top-4 right-4 flex items-center gap-3 text-[10px] text-white/60">
            {/* Campana global de blockers */}
            {(() => {
              const totalBlockers = (data?.states ?? []).reduce(
                (acc, s) => acc + (s.openBlockers?.length ?? 0),
                0,
              );
              const hasCritical = (data?.states ?? []).some((s) =>
                s.openBlockers?.some((b) => b.severity === "critical"),
              );
              if (totalBlockers === 0) return null;
              const color = hasCritical ? "#EF4444" : "#F59E0B";
              return (
                <motion.button
                  onClick={() => {
                    // Abrir el primer agente con blockers
                    const first = (data?.states ?? []).find(
                      (s) => (s.openBlockers?.length ?? 0) > 0,
                    );
                    if (first) setSelected(first.id);
                  }}
                  animate={{
                    boxShadow: [
                      `0 0 0 0 ${color}00`,
                      `0 0 0 6px ${color}44`,
                      `0 0 0 0 ${color}00`,
                    ],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full font-bold text-[10px]"
                  style={{
                    background: `${color}25`,
                    color,
                    border: `1px solid ${color}66`,
                  }}
                  title="Hay bloqueos abiertos — click para ver"
                >
                  🚨 {totalBlockers} bloqueo{totalBlockers > 1 ? "s" : ""}
                </motion.button>
              );
            })()}
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
            // Si el server reporta que tiene un run "running", forzamos working
            // incluso si el cliente no lo disparó (ej: cron o handoff en background)
            const baseAnim = animStates[agent.id] ?? "idle";
            const anim: AgentAnimState = state?.isRunning ? "working" : baseAnim;
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

          {/* Floating gallery + finance + download buttons */}
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            <button
              onClick={() => setFinanceOpen(true)}
              className="px-3 py-2 rounded-lg bg-black/70 border border-white/15 text-[11px] text-emerald-300 hover:bg-black/90 hover:border-emerald-400/40 backdrop-blur font-semibold"
            >
              💰 Finanzas
            </button>
            <button
              onClick={() => setGalleryOpen(true)}
              className="px-3 py-2 rounded-lg bg-black/70 border border-white/15 text-[11px] text-amber-300 hover:bg-black/90 hover:border-amber-400/40 backdrop-blur font-semibold"
            >
              🖼 Galería
            </button>
            <a
              href="/api/admin/agents/download?all=1"
              className="px-3 py-2 rounded-lg bg-black/70 border border-white/15 text-[11px] text-emerald-300 hover:bg-black/90 hover:border-emerald-400/40 backdrop-blur"
            >
              ↓ workspace
            </a>
          </div>

          {/* Autopilot controls — top-center, imposible perderlo */}
          <div
            className="absolute z-30 flex items-center gap-2"
            style={{ top: 12, left: "50%", transform: "translateX(-50%)" }}
          >
            {/* Tick único */}
            <motion.button
              onClick={triggerAutopilot}
              disabled={autopilotRunning}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="font-bold disabled:opacity-60 disabled:cursor-wait"
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)",
                color: "#0A0A14",
                fontSize: 12,
                border: "2px solid rgba(255,255,255,0.25)",
                boxShadow:
                  "0 10px 30px rgba(249, 115, 22, 0.35), 0 2px 8px rgba(0,0,0,0.4)",
              }}
              title="Ejecuta 1 tick — 3 agentes corren en paralelo una vez y para"
            >
              {autopilotRunning ? "⚡ CORRIENDO…" : "🚀 1 TICK"}
            </motion.button>

            {/* Toggle continuous */}
            <motion.button
              onClick={() => setAutopilotContinuous((c) => !c)}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.96 }}
              animate={
                autopilotContinuous
                  ? { boxShadow: ["0 0 15px #10b981", "0 0 30px #10b981", "0 0 15px #10b981"] }
                  : undefined
              }
              transition={autopilotContinuous ? { duration: 1.5, repeat: Infinity } : undefined}
              className="font-bold"
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                background: autopilotContinuous
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "rgba(255,255,255,0.08)",
                color: autopilotContinuous ? "#0A0A14" : "#fff",
                fontSize: 12,
                border: autopilotContinuous
                  ? "2px solid rgba(255,255,255,0.3)"
                  : "2px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(12px)",
              }}
              title="Modo continuo: dispara un tick cada 10 min mientras la pestaña esté abierta"
            >
              {autopilotContinuous ? "🟢 24/7 ACTIVO" : "⚪ MODO 24/7"}
            </motion.button>

            {/* Countdown si está en continuous */}
            {autopilotContinuous && autopilotNextTick && !autopilotRunning && (
              <div
                className="text-[10px] font-mono text-emerald-300 bg-black/70 backdrop-blur rounded-full px-3 py-1 border border-emerald-400/30"
                style={{ whiteSpace: "nowrap" }}
              >
                próximo tick en {(() => {
                  const ms = autopilotNextTick - Date.now();
                  const s = Math.max(0, Math.floor(ms / 1000));
                  const m = Math.floor(s / 60);
                  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
                })()}
              </div>
            )}
          </div>

          {/* Delegaciones en vivo — panel flotante top-right */}
          {delegations.length > 0 && (
            <div className="absolute top-12 right-4 z-20 w-[280px] max-h-[60vh] overflow-y-auto space-y-2 pointer-events-none">
              <AnimatePresence>
                {delegations
                  .slice(-6)
                  .reverse()
                  .map((d) => {
                    const a = agentMap[d.agent];
                    const running = d.status === "running";
                    const errored = d.status === "error";
                    return (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        className="pointer-events-auto rounded-lg bg-black/85 backdrop-blur border px-3 py-2 text-[11px]"
                        style={{
                          borderColor: errored
                            ? "#ef4444"
                            : running
                              ? a?.color ?? "#888"
                              : "#34D39988",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {running && (
                            <motion.div
                              className="w-2 h-2 rounded-full"
                              style={{ background: a?.color ?? "#888" }}
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          )}
                          {!running && !errored && (
                            <span className="text-emerald-400">✓</span>
                          )}
                          {errored && <span className="text-red-400">✕</span>}
                          <span className="font-semibold text-white/90">
                            {a?.name ?? d.agent}
                          </span>
                          <span className="text-white/40 text-[9px] ml-auto">
                            {running
                              ? "corriendo…"
                              : d.result
                                ? `${(d.result.durationMs / 1000).toFixed(1)}s`
                                : ""}
                          </span>
                        </div>
                        <div className="text-white/50 line-clamp-2 mb-1">{d.task}</div>
                        {d.result?.filesWritten && d.result.filesWritten.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-white/10 space-y-0.5">
                            {d.result.filesWritten.map((f) => (
                              <div
                                key={f.relPath}
                                className="flex items-center gap-1 text-emerald-300 text-[10px]"
                              >
                                <span>📝</span>
                                <span className="truncate flex-1">{f.relPath}</span>
                                <span className="text-white/30">{(f.size / 1024).toFixed(1)}kb</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {d.result?.error && (
                          <div className="mt-1 pt-1 border-t border-red-500/30 text-red-300 text-[10px]">
                            {d.result.error}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          )}

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
          {messages.map((m) =>
            m.content === "__RETRY_BUTTON__" ? (
              <div key={m.id} className="flex justify-start">
                <button
                  onClick={() => {
                    // Quitar el error + retry button y re-enviar
                    setMessages((prev) =>
                      prev.filter(
                        (p) =>
                          p.id !== m.id &&
                          !String(p.id).startsWith("error-"),
                      ),
                    );
                    // Re-inyectar el último texto del user al input y mandar
                    const lastUser = messages.filter((p) => p.role === "user").pop();
                    if (lastUser) {
                      setInput(lastUser.content);
                      setTimeout(() => sendMessage(0), 100);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-200 text-sm font-semibold hover:bg-amber-400/30 transition-colors flex items-center gap-2"
                >
                  🔄 Reintentar
                </button>
              </div>
            ) : (
              <ChatBubble key={m.id} msg={m} onImageClick={setLightbox} />
            ),
          )}
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
                className="p-3 flex flex-col gap-2"
              >
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {attachedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] text-emerald-200"
                      >
                        <span>📎</span>
                        <span className="truncate max-w-[140px]">{f.filename}</span>
                        <span className="text-white/40">{(f.size / 1024).toFixed(0)}kb</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachedFiles((prev) => prev.filter((x) => x.id !== f.id))
                          }
                          className="text-white/40 hover:text-white ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={streaming}
                    placeholder="Ej: arma la estrategia anual completa"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-400/60"
                  />
                  <label
                    className={`w-10 h-10 rounded-full bg-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/15 hover:border-emerald-400/50 disabled:opacity-30 flex items-center justify-center text-lg transition-colors cursor-pointer ${
                      uploadingFile ? "animate-pulse" : ""
                    }`}
                    title="Adjuntar archivos (múltiples, PDF/XLSX/CSV/imagen)"
                  >
                    📎
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) {
                          for (let i = 0; i < files.length; i++) {
                            uploadFile(files[i]);
                          }
                          e.target.value = "";
                        }
                      }}
                      disabled={uploadingFile || streaming}
                    />
                  </label>
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
                </div>
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

      {/* Finance modal */}
      <AnimatePresence>
        {financeOpen && (
          <FinanceModal agentMap={agentMap} onClose={() => setFinanceOpen(false)} />
        )}
      </AnimatePresence>

      {/* Gallery modal — feed de todo lo que produjo el equipo */}
      <AnimatePresence>
        {galleryOpen && (
          <GalleryModal
            agentMap={agentMap}
            onClose={() => setGalleryOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Global drag overlay */}
      <AnimatePresence>
        {globalDragging && !selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] pointer-events-none flex items-center justify-center"
            style={{
              background: "rgba(255, 181, 71, 0.12)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              className="text-center px-10 py-8 rounded-3xl"
              style={{
                background: "rgba(10, 10, 20, 0.92)",
                border: "3px dashed #FFB547",
                boxShadow: "0 0 60px rgba(255, 181, 71, 0.4)",
              }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-6xl mb-3"
              >
                📥
              </motion.div>
              <div className="text-2xl font-bold text-white mb-1">
                Soltá el archivo acá
              </div>
              <div className="text-sm text-white/60">
                Se adjunta al chat del Orquestador
              </div>
            </div>
          </motion.div>
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

function CurrentTaskPanel({
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

      {/* Error */}
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

// ═══════════════════════════════════════════════════════════════════════════
// Steps panel — colapsable para no robar espacio al chat
// ═══════════════════════════════════════════════════════════════════════════

function StepsPanel({ steps }: { steps: string }) {
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

// ═══════════════════════════════════════════════════════════════════════════
// Blocker Chat Card — mini chat por blocker con imagenes y streaming
// ═══════════════════════════════════════════════════════════════════════════

interface BlockerMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  created_at: number;
}

function BlockerChatCard({
  blocker,
  agentColor,
  expanded,
  onToggle,
  onResolved,
}: {
  blocker: AgentBlocker;
  agentColor: string;
  expanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [messages, setMessages] = useState<BlockerMessage[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImages((prev) => [...prev, file]);
    }
  };

  const severityColor =
    blocker.severity === "critical"
      ? "#EF4444"
      : blocker.severity === "warning"
        ? "#F59E0B"
        : "#3B82F6";

  // Cargar historial cuando se expande la primera vez
  useEffect(() => {
    if (!expanded || loaded) return;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/admin/agents/blockers/chat?blocker_id=${blocker.id}`,
          { cache: "no-store" },
        );
        const json = await r.json();
        if (json.messages) setMessages(json.messages);
      } catch {}
      setLoaded(true);
    };
    load();
  }, [expanded, loaded, blocker.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = async () => {
    if (sending) return;
    const text = input.trim();
    if (!text && images.length === 0) return;

    setSending(true);
    const userMsg: BlockerMessage = {
      id: Date.now(),
      role: "user",
      content: text || `(${images.length} imagen${images.length > 1 ? "es" : ""} adjunta${images.length > 1 ? "s" : ""})`,
      image_url: images.length > 0 ? URL.createObjectURL(images[0]) : null,
      created_at: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const filesToSend = [...images];
    setImages([]);
    setStreamingText("");

    try {
      const form = new FormData();
      form.append("blocker_id", String(blocker.id));
      form.append("message", text);
      // Solo manda la primera imagen al endpoint (limitación del endpoint actual)
      if (filesToSend.length > 0) form.append("image", filesToSend[0]);

      const res = await fetch("/api/admin/agents/blockers/chat", {
        method: "POST",
        body: form,
      });

      if (!res.ok || !res.body) {
        throw new Error("chat failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setStreamingText(buffer);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: buffer,
          image_url: null,
          created_at: Date.now(),
        },
      ]);
      setStreamingText("");
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content: "⚠️ Error al enviar el mensaje. Reintentá.",
          image_url: null,
          created_at: Date.now(),
        },
      ]);
      setStreamingText("");
    } finally {
      setSending(false);
    }
  };

  const markResolved = async () => {
    try {
      const form = new FormData();
      form.append("blocker_id", String(blocker.id));
      form.append("action", "mark-resolved");
      await fetch("/api/admin/agents/blockers/chat", {
        method: "POST",
        body: form,
      });
      onResolved();
    } catch {}
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: `${severityColor}60`,
        background: `linear-gradient(135deg, ${severityColor}12 0%, transparent 60%)`,
      }}
    >
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <span
            className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold shrink-0"
            style={{ background: `${severityColor}30`, color: severityColor }}
          >
            {blocker.severity}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm">{blocker.title}</div>
            <div className="text-[11px] text-white/60 mt-1 leading-snug">
              {blocker.description}
            </div>
            <div className="text-[9px] text-white/30 mt-2 flex items-center gap-2">
              <span>{timeAgo(blocker.createdAt)}</span>
              <span>·</span>
              <span>fuente: {blocker.source}</span>
              {messages.length > 0 && (
                <>
                  <span>·</span>
                  <span>💬 {messages.length} msgs</span>
                </>
              )}
            </div>
          </div>
          <span className="text-white/30 text-xs">{expanded ? "▼" : "▶"}</span>
        </div>
      </button>

      {expanded && (
        <div
          className="border-t border-white/10 relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drop overlay */}
          {dragging && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none rounded-b-xl"
              style={{
                background: `${agentColor}33`,
                border: `2px dashed ${agentColor}`,
                backdropFilter: "blur(2px)",
              }}
            >
              <div
                className="text-center px-6 py-4 rounded-2xl bg-black/80 border-2 border-dashed"
                style={{ borderColor: agentColor }}
              >
                <div className="text-3xl mb-1">📥</div>
                <div className="text-[11px] font-bold text-white">
                  Soltá la imagen acá
                </div>
                <div className="text-[9px] text-white/50">
                  Se adjunta al chat del blocker
                </div>
              </div>
            </div>
          )}

          {/* Steps iniciales — collapsable para no comer espacio */}
          <StepsPanel steps={blocker.stepsToFix} />


          {/* Chat messages — grande y scrolleable */}
          <div
            ref={scrollRef}
            className="overflow-y-auto px-5 py-4 space-y-3 border-t border-white/10 bg-black/40"
            style={{ minHeight: 420, maxHeight: "55vh" }}
          >
            {!loaded && (
              <div className="text-center text-white/40 text-[10px] py-4">
                cargando chat…
              </div>
            )}
            {loaded && messages.length === 0 && !streamingText && (
              <div className="text-center text-white/40 text-[11px] py-4">
                Si te trabás en algún paso, escribime acá o mandame un screenshot. Te
                ayudo a resolverlo.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-amber-400 text-black"
                      : "bg-white/10 border border-white/15 text-white/90"
                  }`}
                >
                  {m.image_url && (
                    <a
                      href={m.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block mb-2 rounded-lg overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.image_url}
                        alt=""
                        className="max-w-full max-h-40 object-contain bg-black/20"
                      />
                    </a>
                  )}
                  <div className="whitespace-pre-wrap">
                    {m.role === "assistant" ? (
                      <MarkdownLite text={m.content} onImageClick={() => {}} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              </div>
            ))}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-3 py-2 text-[12px] bg-white/10 border border-white/15 text-white/90">
                  <MarkdownLite text={streamingText} onImageClick={() => {}} />
                </div>
              </div>
            )}
            {sending && !streamingText && (
              <div className="flex items-center gap-1 text-white/40 text-xs">
                <span className="w-1 h-1 bg-white/60 rounded-full animate-bounce" />
                <span className="w-1 h-1 bg-white/60 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 bg-white/60 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Input area — mas grande y prominente */}
          <div className="p-4 border-t border-white/10 bg-black/50">
            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {images.map((img, i) => (
                  <div
                    key={`${img.name}-${i}`}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-[10px]"
                  >
                    <span>🖼</span>
                    <span className="text-emerald-200 truncate max-w-[100px]">{img.name}</span>
                    <span className="text-white/40">{(img.size / 1024).toFixed(0)}kb</span>
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="text-white/40 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sending}
                placeholder="Describí dónde te trabaste o arrastrá un screenshot…"
                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/60 focus:bg-white/10"
              />
              <label
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-emerald-500/25 border border-white/15 hover:border-emerald-400/60 flex items-center justify-center cursor-pointer text-base transition-colors shrink-0"
                title="Adjuntar screenshot"
              >
                📎
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      setImages((prev) => [...prev, ...Array.from(files)]);
                    }
                    e.target.value = "";
                  }}
                  disabled={sending}
                />
              </label>
              <button
                onClick={sendMessage}
                disabled={sending || (!input.trim() && images.length === 0)}
                className="w-11 h-11 rounded-full bg-amber-400 text-black text-lg font-bold disabled:opacity-30 hover:bg-amber-300 flex items-center justify-center shrink-0"
              >
                ↑
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={markResolved}
                className="px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-bold"
              >
                ✓ Ya lo resolví
              </button>
              <button
                onClick={async () => {
                  await fetch("/api/admin/agents/blockers", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      action: "ignore",
                      blocker_id: blocker.id,
                    }),
                  });
                  onResolved();
                }}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-[11px]"
              >
                Ignorar
              </button>
              <span
                className="ml-auto text-[10px]"
                style={{ color: agentColor + "bb" }}
              >
                enter → enviar · arrastrá imagen para adjuntar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Finance Modal — gasto en tokens AI + presupuesto real
// ═══════════════════════════════════════════════════════════════════════════

function FinanceModal({
  agentMap,
  onClose,
}: {
  agentMap: Record<string, AgentMeta>;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    period: string;
    ai: {
      byAgent: { agent_id: string; total_runs: number; total_input_tokens: number; total_output_tokens: number; total_cost_usd: number }[];
      totals: { runs: number; inputTokens: number; outputTokens: number; costUsd: number };
    };
    budget: { allocated_usd: number; strategy_name: string | null };
  } | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/agents/finance?period=${period}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (alive) setData(json);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [period]);

  const fmt = (n: number) => n.toLocaleString("en-US");
  const fmtUsd = (n: number) => `$${n.toFixed(4)}`;
  const fmtUsdBig = (n: number) => `$${n.toFixed(2)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[#0A0A14] border border-white/20 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">💰 Finanzas del equipo</h2>
            <p className="text-[11px] text-white/50">
              Gasto en tokens AI (Claude Sonnet 4.6: $3/M input · $15/M output)
              {data?.budget.strategy_name && ` + budget de "${data.budget.strategy_name}"`}
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">×</button>
        </div>

        {/* Period filter */}
        <div className="flex gap-1 px-5 py-2 border-b border-white/10">
          {(["today", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-[10px] rounded-full ${
                period === p
                  ? "bg-emerald-400 text-black font-bold"
                  : "bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              {p === "today" ? "Hoy" : p === "week" ? "7 días" : p === "month" ? "30 días" : "Todo"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="text-center text-white/40 py-12">Cargando finanzas…</div>
          )}

          {!loading && data && (
            <div className="space-y-6">
              {/* Totals cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-400/30">
                  <div className="text-[9px] uppercase tracking-widest text-emerald-300">Gasto AI total</div>
                  <div className="text-2xl font-bold text-white mt-1">{fmtUsdBig(data.ai.totals.costUsd)}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Runs</div>
                  <div className="text-2xl font-bold text-white mt-1">{fmt(data.ai.totals.runs)}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Tokens input</div>
                  <div className="text-lg font-bold text-white mt-1">{fmt(data.ai.totals.inputTokens)}</div>
                  <div className="text-[9px] text-white/30">{fmtUsdBig(data.ai.totals.inputTokens * 3 / 1e6)}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Tokens output</div>
                  <div className="text-lg font-bold text-white mt-1">{fmt(data.ai.totals.outputTokens)}</div>
                  <div className="text-[9px] text-white/30">{fmtUsdBig(data.ai.totals.outputTokens * 15 / 1e6)}</div>
                </div>
              </div>

              {/* Budget allocated (from strategy) */}
              {data.budget.allocated_usd > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-400/15 to-transparent border border-amber-400/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-amber-300">Presupuesto marketing asignado</div>
                      <div className="text-2xl font-bold text-white mt-1">{fmtUsdBig(data.budget.allocated_usd)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-white/40">Estrategia</div>
                      <div className="text-sm text-amber-200">{data.budget.strategy_name}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cost by agent */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">
                  Gasto AI por agente
                </div>
                {data.ai.byAgent.length === 0 ? (
                  <div className="text-center text-white/30 py-8 text-sm">
                    Sin ejecuciones en este período
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.ai.byAgent.map((row) => {
                      const a = agentMap[row.agent_id];
                      const maxCost = Math.max(...data.ai.byAgent.map((r) => r.total_cost_usd), 0.001);
                      const pct = (row.total_cost_usd / maxCost) * 100;
                      return (
                        <div key={row.agent_id} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-28 shrink-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: a?.color ?? "#888" }}
                            />
                            <span className="text-[11px] text-white/80 truncate">
                              {a?.name ?? row.agent_id}
                            </span>
                          </div>
                          <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(pct, 2)}%`,
                                background: a?.color ?? "#888",
                                opacity: 0.7,
                              }}
                            />
                          </div>
                          <div className="w-16 text-right text-[11px] font-mono text-white/80">
                            {fmtUsd(row.total_cost_usd)}
                          </div>
                          <div className="w-12 text-right text-[10px] text-white/40">
                            {row.total_runs} runs
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="text-[9px] text-white/30 pt-4 border-t border-white/10">
                Precios: Claude Sonnet 4.6 — $3.00 por millón de tokens de entrada · $15.00 por millón de tokens de salida.
                Los costos se registran por cada ejecución de agente (delegaciones, autopilot, chat del Growth, blocker chat).
                El presupuesto de marketing es lo que el Growth asigna con allocate_budget en la estrategia activa.
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

interface GalleryFile {
  id: number;
  agentId: AgentId;
  relPath: string;
  content: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

/**
 * Galería: feed visual de TODO lo que los agentes produjeron.
 * Cada tarjeta renderiza el markdown real + imágenes inline + thumbnail
 * si hay una imagen en el contenido.
 */
function GalleryModal({
  agentMap,
  onClose,
}: {
  agentMap: Record<string, AgentMeta>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AgentId | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/agents/gallery")
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        setFiles(json.files ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = filter === "all" ? files : files.filter((f) => f.agentId === filter);
  const uniqueAgents = Array.from(new Set(files.map((f) => f.agentId)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[#0A0A14] border border-white/20 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">🖼 Galería del equipo</h2>
            <p className="text-[11px] text-white/50">
              Todo lo que los agentes produjeron, renderizado · {filtered.length} de {files.length} archivos
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-4 py-2 border-b border-white/10 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 text-[10px] rounded-full whitespace-nowrap ${
              filter === "all"
                ? "bg-white text-black font-bold"
                : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            Todos ({files.length})
          </button>
          {uniqueAgents.map((aid) => {
            const a = agentMap[aid];
            const count = files.filter((f) => f.agentId === aid).length;
            return (
              <button
                key={aid}
                onClick={() => setFilter(aid)}
                className={`px-2.5 py-1 text-[10px] rounded-full whitespace-nowrap flex items-center gap-1 ${
                  filter === aid ? "text-black font-bold" : "text-white/70 hover:text-white"
                }`}
                style={{
                  background:
                    filter === aid
                      ? a?.color ?? "#fff"
                      : `${a?.color ?? "#fff"}15`,
                  border: `1px solid ${a?.color ?? "#fff"}40`,
                }}
              >
                {AGENT_EMOJI[aid]} {a?.name ?? aid} ({count})
              </button>
            );
          })}
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
          {loading && (
            <div className="col-span-full text-center text-white/40 py-12">cargando galería…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full text-center text-white/40 py-12">
              <div className="text-4xl mb-3">🪹</div>
              <div className="text-sm">El equipo todavía no produjo nada visible.</div>
              <div className="text-[11px] mt-1">Activá el autopilot o pedile algo al Orquestador.</div>
            </div>
          )}
          {!loading &&
            filtered.map((file) => {
              const a = agentMap[file.agentId];
              const isExpanded = expanded === file.id;
              // Extraer primera imagen del markdown si hay
              const imgMatch = file.content.match(/!\[[^\]]*\]\(([^)]+)\)/);
              const firstImage = imgMatch?.[1];
              // Primera H1/H2/línea como título
              const titleMatch = file.content.match(/^#{1,3}\s+(.+)$/m);
              const title = titleMatch?.[1] ?? file.relPath.split("/").pop()?.replace(".md", "");
              // Preview = primeras ~200 chars del texto sin markdown
              const preview = file.content
                .replace(/^#{1,3}\s+.+$/gm, "")
                .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                .replace(/[*_`]/g, "")
                .trim()
                .slice(0, 240);

              return (
                <motion.div
                  key={file.id}
                  layout
                  className="rounded-xl border bg-gradient-to-br overflow-hidden cursor-pointer hover:border-amber-400/40 transition-colors"
                  style={{
                    borderColor: `${a?.color ?? "#fff"}30`,
                    background: `linear-gradient(145deg, ${a?.color ?? "#fff"}08 0%, transparent 70%)`,
                    gridColumn: isExpanded ? "span 2" : undefined,
                  }}
                  onClick={() => setExpanded(isExpanded ? null : file.id)}
                >
                  {/* Header */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b"
                    style={{ borderColor: `${a?.color ?? "#fff"}20` }}
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-sm shrink-0"
                      style={{ background: `${a?.color ?? "#fff"}25` }}
                    >
                      {AGENT_EMOJI[file.agentId]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        {a?.name ?? file.agentId}
                      </div>
                      <div className="text-[9px] text-white/40 font-mono truncate">
                        {file.relPath}
                      </div>
                    </div>
                    <div className="text-[9px] text-white/40 shrink-0">
                      {timeAgo(file.updatedAt)}
                    </div>
                  </div>

                  {/* Imagen preview si hay */}
                  {firstImage && !isExpanded && (
                    <div
                      className="aspect-video bg-black/40 overflow-hidden"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox(firstImage);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={firstImage}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Contenido */}
                  <div className="p-3">
                    {title && !isExpanded && (
                      <div className="font-bold text-white text-sm mb-1 line-clamp-2">{title}</div>
                    )}
                    {!isExpanded ? (
                      <div className="text-[11px] text-white/60 line-clamp-4 leading-relaxed">
                        {preview}
                      </div>
                    ) : (
                      <div className="text-[12px] text-white/90 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                        <MarkdownLite text={file.content} onImageClick={setLightbox} />
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-3 py-1.5 border-t flex items-center justify-between text-[9px] text-white/40"
                    style={{ borderColor: `${a?.color ?? "#fff"}15` }}
                  >
                    <span>{(file.size / 1024).toFixed(1)}kb</span>
                    <span>{isExpanded ? "click para cerrar" : "click para ver completo"}</span>
                    {file.createdBy && <span className="font-mono">{file.createdBy}</span>}
                  </div>
                </motion.div>
              );
            })}
        </div>
      </motion.div>

      {/* Lightbox para imágenes de la galería */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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

      {/* Linterna roja pulsante cuando hay blockers abiertos */}
      {state && state.openBlockers && state.openBlockers.length > 0 && (() => {
        const hasCritical = state.openBlockers.some((b) => b.severity === "critical");
        const color = hasCritical ? "#EF4444" : "#F59E0B";
        return (
          <motion.div
            className="absolute -top-1 -right-1 z-30"
            animate={{
              scale: [1, 1.2, 1],
              boxShadow: [
                `0 0 0 0 ${color}88`,
                `0 0 0 8px ${color}00`,
                `0 0 0 0 ${color}00`,
              ],
            }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: color,
              border: "2px solid #0A0A14",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: "bold",
              color: "white",
            }}
          >
            {state.openBlockers.length}
          </motion.div>
        );
      })()}
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
/** Inline code clickeable — click copia al clipboard con feedback visual */
function CopyableCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`px-1.5 py-0.5 rounded font-mono text-[11px] cursor-copy transition-all duration-200 inline-flex items-center gap-1 ${
        copied
          ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/50"
          : "bg-black/50 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100 border border-transparent hover:border-emerald-400/40"
      }`}
      title="Click para copiar"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "✓ copiado" : text}
    </button>
  );
}

/** Botón copiar para code blocks (top-right, aparece en hover) */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`absolute top-2 right-2 z-10 px-2 py-1 rounded text-[9px] font-bold transition-all duration-200 ${
        copied
          ? "bg-emerald-500 text-white"
          : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white opacity-0 group-hover:opacity-100"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "✓ copiado" : "📋 copiar"}
    </button>
  );
}

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
        <div key={`c-${key++}`} className="relative my-2 group">
          <CopyButton text={part.content} />
          <pre className="p-3 rounded-lg bg-black/60 border border-white/10 text-[10px] text-emerald-200 overflow-x-auto font-mono pr-12">
            {part.lang && <div className="text-[8px] uppercase text-white/40 mb-1">{part.lang}</div>}
            {part.content}
          </pre>
        </div>,
      );
      continue;
    }
    if (part.type === "flow") {
      blocks.push(
        <div key={`f-${key++}`} className="relative my-2 group">
          <CopyButton text={part.content} />
          <pre className="p-3 rounded-lg bg-gradient-to-br from-amber-400/10 to-transparent border border-amber-400/30 text-[10px] text-amber-100 font-mono whitespace-pre overflow-x-auto pr-12">
            <div className="text-[8px] uppercase text-amber-400 mb-1">Flujo</div>
            {part.content}
          </pre>
        </div>,
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
        <CopyableCode key={`c-${k++}`} text={m[1]} />
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
  const [tab, setTab] = useState<"overview" | "memory" | "files" | "blockers">(
    state.openBlockers && state.openBlockers.length > 0 ? "blockers" : "overview",
  );
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);
  const [expandedBlocker, setExpandedBlocker] = useState<number | null>(null);

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
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[#0E0E1A] border border-white/10 rounded-2xl w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: `0 0 80px ${agent.color}40`,
          maxWidth: tab === "blockers" && expandedBlocker !== null ? "1100px" : "900px",
          maxHeight: "94vh",
          height: tab === "blockers" && expandedBlocker !== null ? "94vh" : "auto",
        }}
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
              state={state.isRunning ? "working" : "idle"}
              mood={state.isRunning ? "motivated" : "normal"}
              accessory={agent.accessory}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/40">{agent.role}</div>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {AGENT_EMOJI[agent.id]} {agent.title}
            </h2>
            <p className="text-sm text-white/60 mt-1">{agent.tagline}</p>
            <div className="flex gap-3 mt-3 text-[11px] flex-wrap">
              <span className="text-white/50">
                📁 <strong className="text-white">{state.filesCount}</strong> archivos escritos
              </span>
              <span className="text-white/50">
                🕐{" "}
                <strong className="text-white">
                  {state.lastActivity ? timeAgo(state.lastActivity) : "sin actividad todavía"}
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

        {/* Qué está haciendo / pensando */}
        {state.latestRun && <CurrentTaskPanel latestRun={state.latestRun} agentColor={agent.color} />}

        {/* Tabs */}
        <div className="flex gap-1 px-5 border-b border-white/10">
          {(["overview", "memory", "files", "blockers"] as const).map((t) => {
            const blockerCount = state.openBlockers?.length ?? 0;
            if (t === "blockers" && blockerCount === 0) return null;
            const hasCritical = state.openBlockers?.some((b) => b.severity === "critical");
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-xs uppercase tracking-wider border-b-2 flex items-center gap-1 ${
                  tab === t
                    ? "border-amber-400 text-white"
                    : "border-transparent text-white/40 hover:text-white/70"
                }`}
              >
                {t === "overview"
                  ? "Vista"
                  : t === "memory"
                    ? "Memoria"
                    : t === "files"
                      ? "Archivos"
                      : "Bloqueos"}
                {t === "blockers" && (
                  <span
                    className="text-[9px] px-1.5 rounded-full font-bold"
                    style={{
                      background: hasCritical ? "#EF4444" : "#F59E0B",
                      color: "white",
                    }}
                  >
                    {blockerCount}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/api/admin/agents/download?agent=${agent.id}`}
              className="text-[11px] text-emerald-300 hover:text-emerald-200 underline py-2"
            >
              ↓ descargar bundle
            </a>
          </div>
        </div>

        {/* Content — menos padding cuando estamos en blockers con chat abierto */}
        <div
          className={`flex-1 overflow-y-auto text-sm ${
            tab === "blockers" && expandedBlocker !== null ? "p-3" : "p-5"
          }`}
        >
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
                  Archivos escritos por el agente
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
                  {state.latestFiles.length === 0 && (
                    <div className="text-[11px] text-white/30 italic py-2 px-2">
                      Todavía no escribió ningún archivo. Cuando el agente ejecute una
                      tarea y use <code className="text-white/50">write_file</code>, aparecerán acá.
                    </div>
                  )}
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

          {tab === "blockers" && state.openBlockers && state.openBlockers.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-red-300 mb-2">
                {state.openBlockers.length} bloqueo
                {state.openBlockers.length > 1 ? "s" : ""} abierto
                {state.openBlockers.length > 1 ? "s" : ""} — chat con el agente para resolverlo
              </div>
              {state.openBlockers.map((b) => (
                <BlockerChatCard
                  key={b.id}
                  blocker={b}
                  agentColor={agent.color}
                  expanded={expandedBlocker === b.id}
                  onToggle={() => setExpandedBlocker(expandedBlocker === b.id ? null : b.id)}
                  onResolved={() => {
                    setExpandedBlocker(null);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* File viewer modal — ahora con markdown renderizado bonito */}
      <AnimatePresence>
        {fileContent && (
          <FileViewerModal
            file={fileContent}
            onClose={() => setFileContent(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Visor de archivos con toggle entre vista renderizada (markdown → HTML)
 * y vista raw. Las imágenes markdown se ven como imágenes de verdad,
 * clickeables para lightbox.
 */
function FileViewerModal({
  file,
  onClose,
}: {
  file: { path: string; content: string };
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"rendered" | "raw">("rendered");
  const [innerLightbox, setInnerLightbox] = useState<string | null>(null);
  const isMarkdown = file.path.endsWith(".md") || file.content.startsWith("#");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-[#0A0A14] border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="text-xs text-white/70 font-mono truncate flex-1">{file.path}</div>
          {isMarkdown && (
            <div className="flex gap-1 mr-3 shrink-0">
              <button
                onClick={() => setMode("rendered")}
                className={`px-2 py-1 text-[10px] rounded ${
                  mode === "rendered"
                    ? "bg-amber-400 text-black font-bold"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                📄 vista
              </button>
              <button
                onClick={() => setMode("raw")}
                className={`px-2 py-1 text-[10px] rounded ${
                  mode === "raw"
                    ? "bg-amber-400 text-black font-bold"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                {"</>"} raw
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-xl shrink-0"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {isMarkdown && mode === "rendered" ? (
            <div className="p-6 text-sm text-white/90 leading-relaxed">
              <MarkdownLite text={file.content} onImageClick={setInnerLightbox} />
            </div>
          ) : (
            <pre className="p-4 text-[11px] text-white/80 font-mono whitespace-pre-wrap">
              {file.content}
            </pre>
          )}
        </div>
      </motion.div>

      {/* Lightbox interno para imágenes dentro del file */}
      <AnimatePresence>
        {innerLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setInnerLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={innerLightbox} alt="" className="max-w-full max-h-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
