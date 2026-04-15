import { NextResponse, after } from "next/server";
import { runAutopilotTick } from "@/lib/agent-autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * External cron endpoint.
 *
 * Vercel Hobby solo permite crons diarios. Para correr el autopilot
 * cada N minutos sin pasarse a Pro, usamos un cron EXTERNO (GitHub
 * Actions, cron-job.org, Upstash QStash, etc.) que pega a este endpoint
 * cada 10 minutos con el secret en el query param `?secret=X`.
 *
 * Así los agentes ejecutan tasks programadas y hacen autopilot proactivo
 * incluso con el browser cerrado — la única condición es que el servicio
 * externo esté pingeando.
 *
 * Secret: EXTERNAL_CRON_SECRET env var en Vercel
 */
export async function GET(req: Request) {
  const expected = process.env.EXTERNAL_CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "EXTERNAL_CRON_SECRET no configurada en Vercel env vars" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Ejecuta el tick en background con after() para que la HTTP response
  // vuelva rápido al cron externo (que tiene timeout corto) mientras el
  // runner sigue corriendo hasta terminar todos los agentes.
  const maxParam = searchParams.get("max");
  const maxAgents = maxParam ? parseInt(maxParam, 10) : 3;

  // Arranca inmediato y devuelve una respuesta rápida
  let immediateResult: Awaited<ReturnType<typeof runAutopilotTick>> | null = null;
  try {
    immediateResult = await runAutopilotTick({ max: maxAgents });
  } catch (err) {
    console.error("[external-tick] error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }

  // Disparar un segundo tick en background si quedaron muchos pending
  after(async () => {
    try {
      // Si hubo muchos resultados, corremos otro tick para drenar más tasks
      if (immediateResult && immediateResult.scheduledTasks.checked >= maxAgents) {
        await runAutopilotTick({ max: maxAgents });
      }
    } catch (err) {
      console.error("[external-tick] background error", err);
    }
  });

  return NextResponse.json({
    ok: true,
    ...immediateResult,
  });
}
