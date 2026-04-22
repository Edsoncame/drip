"use client";

import React, { useState } from "react";

/**
 * Mini-parser markdown for chat bubbles and agent outputs.
 * Supports:
 *   - Fenced code blocks with copy button
 *   - [[flow]]…[[/flow]] → ASCII flow diagram box
 *   - Headers, lists, horizontal rules
 *   - Inline: **bold**, `code`, [link](url), ![img](url), [[file:path|label]]
 */

/** Inline code clickeable — click copia al clipboard con feedback visual */
export function CopyableCode({ text }: { text: string }) {
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
export function CopyButton({ text }: { text: string }) {
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

export function MarkdownLite({
  text,
  onImageClick,
}: {
  text: string;
  onImageClick: (url: string) => void;
}) {
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

function renderInline(
  text: string,
  baseKey: number,
  onImageClick: (url: string) => void,
): React.ReactNode {
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
        const icon =
          ext === "pdf" ? "📄" : ext === "md" ? "📝" : ext === "csv" || ext === "xlsx" ? "📊" : "📎";
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
      handle: (m) => <CopyableCode key={`c-${k++}`} text={m[1]} />,
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
