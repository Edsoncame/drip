import type { AgentId, AgentMeta, AgentState, ActivityEvent } from "@/lib/agents";

export type StatePayload = {
  agents: AgentMeta[];
  states: AgentState[];
  activity: ActivityEvent[];
  now: number;
  rootExists?: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type AgentAnimState = "idle" | "thinking" | "working" | "talking" | "receiving";

export type DelegationStatus = {
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
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((e: {
        results: ArrayLike<
          ArrayLike<{ transcript: string; isFinal?: boolean }> & { isFinal: boolean }
        >;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

export interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export type Beam = {
  id: string;
  from: AgentId;
  to: AgentId;
  label: string;
  createdAt: number;
};
