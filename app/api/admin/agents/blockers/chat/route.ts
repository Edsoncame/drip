import { NextResponse, after } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import {
  addBlockerMessage,
  listBlockerMessages,
  getBlockerById,
  resolveBlocker,
} from "@/lib/agent-blockers";
import { runAgent } from "@/lib/flux-agents";
import type { AgentId } from "@/lib/agents";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chat dentro de un blocker. Cada blocker tiene su propio hilo.
 * El usuario manda un mensaje (opcional imagen), el agente dueño del
 * blocker responde con guía específica basada en el step_to_fix +
 * la imagen si la mandó.
 *
 * Body: FormData con blocker_id, message, image (file opcional), action?
 *   action === "mark-resolved" → marca el blocker resuelto después de
 *   que el user confirma que lo arregló.
 */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const blockerIdStr = form.get("blocker_id") as string | null;
  const message = (form.get("message") as string) || "";
  const file = form.get("image");
  const action = form.get("action") as string | null;

  if (!blockerIdStr) {
    return NextResponse.json({ error: "missing blocker_id" }, { status: 400 });
  }
  const blockerId = parseInt(blockerIdStr, 10);
  const blocker = await getBlockerById(blockerId);
  if (!blocker) {
    return NextResponse.json({ error: "blocker not found" }, { status: 404 });
  }

  // Acción rápida: marcar resuelto + auto-verificación + reanudación
  if (action === "mark-resolved") {
    await addBlockerMessage(blockerId, "user", "✓ Lo resolví, marcando como cerrado.", null);
    await resolveBlocker(blockerId, session.email);

    // El agente verifica el fix y retoma tareas pendientes en background
    after(async () => {
      try {
        await runAgent({
          agentId: blocker.agent_id as AgentId,
          task: `BLOCKER RESUELTO — "${blocker.title}" fue marcado como cerrado por Edson.

1. VERIFICÁ que funciona — probá la funcionalidad que estaba bloqueada
2. Si funciona → confirmá en un archivo y buscá tareas pendientes tuyas con get_strategy_context
3. Si hay tasks pending con tu owner_agent_id → EJECUTÁ la más urgente ahora
4. Si no hay tasks → trabajá en lo más valioso según tu rol (modo autopilot)
5. Si el fix NO funcionó → reportá con report_blocker explicando qué falla`,
          actor: `blocker-resolved:${session.email}`,
          maxSteps: 8,
        });
      } catch (err) {
        console.error("[blocker-chat] auto-verify failed", err);
      }
    });

    return NextResponse.json({ ok: true, resolved: true });
  }

  if (!message && !file) {
    return NextResponse.json({ error: "missing message or image" }, { status: 400 });
  }

  // Si hay imagen, la subimos a Blob para persistirla y pasarla a Claude
  let imageUrl: string | null = null;
  let imageBuffer: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "image too large (max 8MB)" }, { status: 400 });
    }
    imageBuffer = Buffer.from(await file.arrayBuffer());
    const key = `blocker-screenshots/${blockerId}-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const blob = await put(key, imageBuffer, {
      access: "public",
      contentType: file.type || "image/png",
    });
    imageUrl = blob.url;
  }

  // Guardamos el mensaje del user en el hilo
  await addBlockerMessage(blockerId, "user", message || "(imagen adjunta)", imageUrl);

  // Cargamos el contexto: blocker + historial de mensajes
  const history = await listBlockerMessages(blockerId);
  const agent = AGENTS.find((a) => a.id === blocker.agent_id);
  const agentTitle = agent?.title ?? blocker.agent_id;

  const system = `Sos ${agentTitle} del equipo de marketing de FLUX (fluxperu.com, alquiler mensual de MacBooks en Perú).

Hay un BLOCKER abierto que te está impidiendo trabajar. Edson te está pidiendo ayuda para resolverlo. Tu trabajo: guiarlo paso por paso hasta que lo arregle. Cuando lo resuelva, te avisa y vos confirmás que ya podés seguir trabajando.

## Contexto del blocker

**Título:** ${blocker.title}
**Severidad:** ${blocker.severity}
**Descripción:** ${blocker.description}
**Fuente:** ${blocker.source}

## Pasos iniciales que ya sabés

${blocker.steps_to_fix}

## Cómo respondés

- Si Edson te manda un screenshot, leelo con atención y decile EXACTAMENTE dónde está el botón/opción que necesita tocar (ej: "en el sidebar izquierdo, abajo, donde dice Settings, click ahí y después Environment Variables").
- Si dice "no encuentro X", dale pistas visuales: "buscá el icono de engranaje en la esquina inferior izquierda".
- Si dice "ya lo hice" pero vos sospechás que no está bien, pedile otro screenshot para confirmar.
- Si ves en la imagen que ya está configurado correctamente, confirmá: "✓ Perfecto, ya lo veo configurado. Voy a retomar mi trabajo apenas Vercel redeploy termine."
- **Habla en español peruano, directo, sin jerga técnica innecesaria.** 2-4 párrafos máximo por mensaje.
- **Sé específico.** No digas "andá a Settings" — decí "click en 'Project Settings' arriba a la derecha, después 'Environment Variables' en el sidebar izquierdo".
- Si necesitás más info del user (ej: URL completa, qué ve en la pantalla), pedíselo.

Cuando Edson diga cosas como "ya está", "listo", "lo arreglé", verificá antes de confirmar. Si hay duda, pedí screenshot.`;

  // Armamos los messages para Claude incluyendo imagen si es la última
  const messages: {
    role: "user" | "assistant";
    content:
      | string
      | { type: "text"; text: string }[]
      | ({ type: "text"; text: string } | { type: "image"; image: string })[];
  }[] = history.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // El último mensaje del user puede tener imagen
  const lastUser = history[history.length - 1];
  if (lastUser && lastUser.role === "user") {
    if (lastUser.image_url) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: lastUser.content || "Mirá este screenshot:" },
          { type: "image", image: lastUser.image_url },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: lastUser.content,
      });
    }
  }

  // Streaming response — onFinish persiste la respuesta completa en DB
  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    temperature: 0.6,
    onFinish: async ({ text }) => {
      if (text) {
        await addBlockerMessage(blockerId, "assistant", text, null);
      }
    },
  });

  return result.toTextStreamResponse();
}

/** GET — lista los mensajes de un blocker. */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const blockerIdStr = searchParams.get("blocker_id");
  if (!blockerIdStr) {
    return NextResponse.json({ error: "missing blocker_id" }, { status: 400 });
  }
  const blockerId = parseInt(blockerIdStr, 10);
  const messages = await listBlockerMessages(blockerId);
  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      image_url: m.image_url,
      created_at: m.created_at.getTime(),
    })),
  });
}
