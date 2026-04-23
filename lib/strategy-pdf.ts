/**
 * Strategy PDF Export — genera un PDF de la estrategia completa usando pdf-lib.
 *
 * No hace rendering fancy (pdf-lib es low-level). Lo que hacemos:
 * - Usar la fuente Helvetica built-in
 * - Renderizar headings + párrafos del document_md en páginas A4
 * - Incluir sección por objetivo, KPIs, tasks upcoming, budget, competidores
 * - Generar un header con nombre y logo, footer con página N / M
 *
 * El agente Head of Growth ya va a generar el `document_md` como markdown
 * rico con todo el contenido. Acá solo lo convertimos a PDF legible.
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import type {
  DbStrategy,
  DbObjective,
  DbKpi,
  DbTask,
  DbExperiment,
  DbSemPlan,
  DbBudget,
  DbCompetitor,
  DbReport,
} from "./strategy-db";

interface StrategyPdfData {
  strategy: DbStrategy;
  objectives: DbObjective[];
  kpis: DbKpi[];
  tasks: DbTask[];
  experiments: DbExperiment[];
  semPlans: DbSemPlan[];
  budget: DbBudget[];
  competitors: DbCompetitor[];
  latestReport: DbReport | null;
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 puntos
const MARGIN = { top: 50, bottom: 50, left: 50, right: 50 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

const COLORS = {
  primary: rgb(0.106, 0.31, 1), // #1B4FFF (FLUX azul)
  dark: rgb(0.09, 0.09, 0.12), // #18181F
  muted: rgb(0.45, 0.45, 0.5),
  light: rgb(0.95, 0.95, 0.97),
  accent: rgb(1, 0.71, 0.28), // #FFB547 amber
};

interface Cursor {
  y: number;
  page: PDFPage;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  // Clean characters that Helvetica can't encode (emojis, etc.)
  const clean = text.replace(/[^\x00-\x7F\u00A0-\u024F]/g, "");
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(trial, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function newPage(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE.width, PAGE.height]);
}

function ensureSpace(
  cursor: Cursor,
  doc: PDFDocument,
  needed: number,
): Cursor {
  if (cursor.y - needed < MARGIN.bottom) {
    const page = newPage(doc);
    return { page, y: PAGE.height - MARGIN.top };
  }
  return cursor;
}

function drawH1(cursor: Cursor, doc: PDFDocument, text: string, font: PDFFont): Cursor {
  const c = ensureSpace(cursor, doc, 40);
  c.page.drawText(text.replace(/[^\x00-\x7F]/g, ""), {
    x: MARGIN.left,
    y: c.y - 20,
    size: 22,
    font,
    color: COLORS.primary,
  });
  c.page.drawRectangle({
    x: MARGIN.left,
    y: c.y - 26,
    width: 60,
    height: 3,
    color: COLORS.accent,
  });
  return { page: c.page, y: c.y - 40 };
}

function drawH2(cursor: Cursor, doc: PDFDocument, text: string, font: PDFFont): Cursor {
  const c = ensureSpace(cursor, doc, 30);
  c.page.drawText(text.replace(/[^\x00-\x7F]/g, ""), {
    x: MARGIN.left,
    y: c.y - 16,
    size: 16,
    font,
    color: COLORS.dark,
  });
  return { page: c.page, y: c.y - 28 };
}

function drawH3(cursor: Cursor, doc: PDFDocument, text: string, font: PDFFont): Cursor {
  const c = ensureSpace(cursor, doc, 24);
  c.page.drawText(text.replace(/[^\x00-\x7F]/g, ""), {
    x: MARGIN.left,
    y: c.y - 14,
    size: 13,
    font,
    color: COLORS.primary,
  });
  return { page: c.page, y: c.y - 22 };
}

function drawParagraph(
  cursor: Cursor,
  doc: PDFDocument,
  text: string,
  font: PDFFont,
  size = 10,
): Cursor {
  const lines = wrapText(text, font, size, CONTENT_WIDTH);
  let c = cursor;
  for (const line of lines) {
    c = ensureSpace(c, doc, size + 4);
    c.page.drawText(line, {
      x: MARGIN.left,
      y: c.y - size,
      size,
      font,
      color: COLORS.dark,
    });
    c = { page: c.page, y: c.y - (size + 4) };
  }
  return { page: c.page, y: c.y - 6 };
}

function drawBullet(
  cursor: Cursor,
  doc: PDFDocument,
  text: string,
  font: PDFFont,
  size = 10,
): Cursor {
  const lines = wrapText(text, font, size, CONTENT_WIDTH - 15);
  let c = cursor;
  c = ensureSpace(c, doc, size + 4);
  // Bullet dot
  c.page.drawCircle({
    x: MARGIN.left + 4,
    y: c.y - size / 2 - 1,
    size: 1.5,
    color: COLORS.accent,
  });
  c.page.drawText(lines[0], {
    x: MARGIN.left + 15,
    y: c.y - size,
    size,
    font,
    color: COLORS.dark,
  });
  c = { page: c.page, y: c.y - (size + 4) };
  for (let i = 1; i < lines.length; i++) {
    c = ensureSpace(c, doc, size + 4);
    c.page.drawText(lines[i], {
      x: MARGIN.left + 15,
      y: c.y - size,
      size,
      font,
      color: COLORS.dark,
    });
    c = { page: c.page, y: c.y - (size + 4) };
  }
  return c;
}

function drawKeyValue(
  cursor: Cursor,
  doc: PDFDocument,
  key: string,
  value: string,
  fontBold: PDFFont,
  fontRegular: PDFFont,
): Cursor {
  let c = ensureSpace(cursor, doc, 16);
  c.page.drawText(key + ":", {
    x: MARGIN.left,
    y: c.y - 10,
    size: 10,
    font: fontBold,
    color: COLORS.muted,
  });
  const keyWidth = fontBold.widthOfTextAtSize(key + ": ", 10);
  const valueLines = wrapText(value, fontRegular, 10, CONTENT_WIDTH - keyWidth - 10);
  c.page.drawText(valueLines[0], {
    x: MARGIN.left + keyWidth + 4,
    y: c.y - 10,
    size: 10,
    font: fontRegular,
    color: COLORS.dark,
  });
  c = { page: c.page, y: c.y - 14 };
  for (let i = 1; i < valueLines.length; i++) {
    c = ensureSpace(c, doc, 14);
    c.page.drawText(valueLines[i], {
      x: MARGIN.left + keyWidth + 4,
      y: c.y - 10,
      size: 10,
      font: fontRegular,
      color: COLORS.dark,
    });
    c = { page: c.page, y: c.y - 14 };
  }
  return c;
}

function drawDivider(cursor: Cursor, doc: PDFDocument): Cursor {
  const c = ensureSpace(cursor, doc, 12);
  c.page.drawLine({
    start: { x: MARGIN.left, y: c.y - 4 },
    end: { x: PAGE.width - MARGIN.right, y: c.y - 4 },
    thickness: 0.5,
    color: COLORS.light,
  });
  return { page: c.page, y: c.y - 14 };
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

/**
 * Parser mínimo de markdown que aplica headings, bullets, bold y párrafos.
 * Soporta # ## ###, - item, 1. item, párrafos vacíos.
 */
function renderMarkdownBlock(
  cursor: Cursor,
  doc: PDFDocument,
  markdown: string,
  font: PDFFont,
  fontBold: PDFFont,
): Cursor {
  let c = cursor;
  const lines = markdown.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      c = { page: c.page, y: c.y - 6 };
      continue;
    }
    if (/^###\s/.test(line)) {
      c = drawH3(c, doc, line.replace(/^###\s*/, ""), fontBold);
    } else if (/^##\s/.test(line)) {
      c = drawH2(c, doc, line.replace(/^##\s*/, ""), fontBold);
    } else if (/^#\s/.test(line)) {
      c = drawH1(c, doc, line.replace(/^#\s*/, ""), fontBold);
    } else if (/^[-*]\s/.test(line)) {
      c = drawBullet(c, doc, line.replace(/^[-*]\s*/, ""), font);
    } else if (/^\d+\.\s/.test(line)) {
      c = drawBullet(c, doc, line.replace(/^\d+\.\s*/, ""), font);
    } else {
      // Remove markdown bold/italic markers for display
      const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/_(.+?)_/g, "$1");
      c = drawParagraph(c, doc, clean, font);
    }
  }
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main exporter
// ═══════════════════════════════════════════════════════════════════════════

export async function generateStrategyPdf(data: StrategyPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let cursor: Cursor = {
    page: newPage(doc),
    y: PAGE.height - MARGIN.top,
  };

  // ─── Portada ───
  cursor.page.drawRectangle({
    x: 0,
    y: PAGE.height - 180,
    width: PAGE.width,
    height: 180,
    color: COLORS.primary,
  });
  cursor.page.drawText("ESTRATEGIA DE MARKETING", {
    x: MARGIN.left,
    y: PAGE.height - 80,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  cursor.page.drawText(data.strategy.name.replace(/[^\x00-\x7F]/g, ""), {
    x: MARGIN.left,
    y: PAGE.height - 115,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  cursor.page.drawText(
    `${formatDate(data.strategy.start_date)} - ${formatDate(data.strategy.end_date)}`,
    {
      x: MARGIN.left,
      y: PAGE.height - 140,
      size: 12,
      font,
      color: rgb(1, 1, 1),
    },
  );
  cursor.page.drawText(
    `Duracion: ${data.strategy.duration_months ?? "—"} meses | Status: ${data.strategy.status.toUpperCase()}`,
    {
      x: MARGIN.left,
      y: PAGE.height - 160,
      size: 10,
      font,
      color: rgb(1, 1, 1, ),
    },
  );

  cursor.y = PAGE.height - 210;

  // ─── Resumen ejecutivo ───
  cursor = drawH2(cursor, doc, "Resumen ejecutivo", fontBold);
  if (data.strategy.plan_crecimiento) {
    cursor = drawParagraph(cursor, doc, data.strategy.plan_crecimiento, font);
  }
  cursor = drawKeyValue(
    cursor,
    doc,
    "North Star Metric",
    data.strategy.north_star_metric ?? "—",
    fontBold,
    font,
  );
  cursor = drawKeyValue(
    cursor,
    doc,
    "Meta global",
    data.strategy.meta_global_descripcion ?? "—",
    fontBold,
    font,
  );
  cursor = drawKeyValue(
    cursor,
    doc,
    "Valor objetivo",
    data.strategy.meta_global_valor ?? "—",
    fontBold,
    font,
  );

  cursor = drawDivider(cursor, doc);

  // ─── Contexto de negocio ───
  cursor = drawH2(cursor, doc, "Contexto de negocio", fontBold);
  if (data.strategy.mision) {
    cursor = drawKeyValue(cursor, doc, "Mision", data.strategy.mision, fontBold, font);
  }
  if (data.strategy.vision) {
    cursor = drawKeyValue(cursor, doc, "Vision", data.strategy.vision, fontBold, font);
  }
  if (data.strategy.territorio_marca) {
    cursor = drawKeyValue(
      cursor,
      doc,
      "Territorio marca",
      data.strategy.territorio_marca,
      fontBold,
      font,
    );
  }
  if (data.strategy.valores_marca && data.strategy.valores_marca.length > 0) {
    cursor = drawKeyValue(
      cursor,
      doc,
      "Valores",
      data.strategy.valores_marca.join(" · "),
      fontBold,
      font,
    );
  }
  if (data.strategy.rubro) {
    cursor = drawKeyValue(cursor, doc, "Rubro", data.strategy.rubro, fontBold, font);
  }
  if (data.strategy.publico_descripcion) {
    cursor = drawKeyValue(
      cursor,
      doc,
      "Publico",
      data.strategy.publico_descripcion,
      fontBold,
      font,
    );
  }
  if (data.strategy.arquetipos && data.strategy.arquetipos.length > 0) {
    cursor = drawH3(cursor, doc, "Arquetipos", fontBold);
    for (const a of data.strategy.arquetipos) {
      cursor = drawBullet(
        cursor,
        doc,
        `${a.nombre} (${a.tipo})${a.verbatim ? ' — "' + a.verbatim + '"' : ""}`,
        font,
      );
    }
  }

  cursor = drawDivider(cursor, doc);

  // ─── Objetivos por funnel ───
  cursor = drawH2(cursor, doc, "Objetivos por funnel", fontBold);
  for (const obj of data.objectives) {
    cursor = drawH3(cursor, doc, obj.funnel_stage.toUpperCase(), fontBold);
    if (obj.objetivo_general) {
      cursor = drawParagraph(cursor, doc, obj.objetivo_general, fontBold, 11);
    }
    if (obj.objetivo_especifico) {
      cursor = drawParagraph(cursor, doc, obj.objetivo_especifico, font);
    }
    if (obj.tacticas && obj.tacticas.length > 0) {
      cursor = drawKeyValue(
        cursor,
        doc,
        "Tacticas",
        obj.tacticas.join(" | "),
        fontBold,
        font,
      );
    }
    if (obj.canales && obj.canales.length > 0) {
      cursor = drawKeyValue(
        cursor,
        doc,
        "Canales",
        obj.canales.join(" · "),
        fontBold,
        font,
      );
    }
    if (obj.responsable_agent) {
      cursor = drawKeyValue(cursor, doc, "Responsable", obj.responsable_agent, fontBold, font);
    }
    cursor = { page: cursor.page, y: cursor.y - 6 };
  }

  cursor = drawDivider(cursor, doc);

  // ─── KPIs ───
  cursor = drawH2(cursor, doc, "KPIs principales", fontBold);
  if (data.kpis.length === 0) {
    cursor = drawParagraph(cursor, doc, "(todavia no hay KPIs registrados)", font);
  } else {
    for (const kpi of data.kpis) {
      const targetStr = kpi.target_value !== null ? `target ${kpi.target_value}` : "";
      const currentStr = `current ${kpi.current_value}`;
      const unitStr = kpi.unit ? ` ${kpi.unit}` : "";
      cursor = drawBullet(
        cursor,
        doc,
        `${kpi.name}: ${currentStr}${unitStr} / ${targetStr}${unitStr} (${kpi.period ?? "—"}, ${kpi.status})`,
        font,
      );
    }
  }

  cursor = drawDivider(cursor, doc);

  // ─── Experimentos priorizados ───
  if (data.experiments.length > 0) {
    cursor = drawH2(cursor, doc, "Experimentos priorizados", fontBold);
    const top = data.experiments.slice(0, 10);
    for (const e of top) {
      const pie = e.puntaje_total ? `PIE ${e.puntaje_total}` : "";
      cursor = drawH3(cursor, doc, `${e.codigo ?? "#" + e.id} · ${e.nombre}`, fontBold);
      cursor = drawKeyValue(
        cursor,
        doc,
        "Funnel",
        `${e.funnel_stage ?? "—"} · ${pie} · ${e.status}`,
        fontBold,
        font,
      );
      if (e.hipotesis) {
        cursor = drawKeyValue(cursor, doc, "Hipotesis", e.hipotesis, fontBold, font);
      }
      if (e.criterio_exito) {
        cursor = drawKeyValue(cursor, doc, "Exito si", e.criterio_exito, fontBold, font);
      }
      cursor = { page: cursor.page, y: cursor.y - 4 };
    }
    cursor = drawDivider(cursor, doc);
  }

  // ─── Tasks upcoming ───
  if (data.tasks.length > 0) {
    cursor = drawH2(cursor, doc, "Tareas programadas (proximas)", fontBold);
    const top = data.tasks.slice(0, 20);
    for (const t of top) {
      const date = t.scheduled_for ? formatDate(t.scheduled_for) : "sin fecha";
      cursor = drawBullet(
        cursor,
        doc,
        `[${date}] ${t.owner_agent_id ?? "sin owner"} · ${t.title} (${t.priority})`,
        font,
      );
    }
    cursor = drawDivider(cursor, doc);
  }

  // ─── Budget ───
  if (data.budget.length > 0) {
    cursor = drawH2(cursor, doc, "Presupuesto asignado", fontBold);
    const total = data.budget.reduce((s, b) => s + Number(b.amount_usd), 0);
    cursor = drawKeyValue(cursor, doc, "Total USD", `$${total.toFixed(2)}`, fontBold, font);
    const byCanal = new Map<string, number>();
    for (const b of data.budget) {
      byCanal.set(b.canal, (byCanal.get(b.canal) ?? 0) + Number(b.amount_usd));
    }
    for (const [canal, amount] of byCanal) {
      cursor = drawBullet(cursor, doc, `${canal}: $${amount.toFixed(2)}`, font);
    }
    cursor = drawDivider(cursor, doc);
  }

  // ─── SEM Plans ───
  if (data.semPlans.length > 0) {
    cursor = drawH2(cursor, doc, "Plan de medios (SEM)", fontBold);
    for (const p of data.semPlans) {
      cursor = drawH3(cursor, doc, `${p.periodo} · ${p.campana} · ${p.medio}`, fontBold);
      cursor = drawKeyValue(
        cursor,
        doc,
        "Objetivo",
        `${p.objetivo ?? "—"} · ${p.tipo_compra ?? "—"}`,
        fontBold,
        font,
      );
      cursor = drawKeyValue(
        cursor,
        doc,
        "Inversion",
        `$${p.inversion_usd ?? 0} USD` +
          (p.inversion_pen ? ` / S/ ${p.inversion_pen}` : ""),
        fontBold,
        font,
      );
      if (p.registros_mensuales_por_pauta) {
        cursor = drawKeyValue(
          cursor,
          doc,
          "Forecast",
          `${p.registros_mensuales_por_pauta} registros/mes · ${p.transacciones_mensuales_por_pauta ?? "—"} transacciones/mes`,
          fontBold,
          font,
        );
      }
    }
    cursor = drawDivider(cursor, doc);
  }

  // ─── Competidores ───
  if (data.competitors.length > 0) {
    cursor = drawH2(cursor, doc, "Benchmark competitivo", fontBold);
    for (const c of data.competitors) {
      cursor = drawH3(cursor, doc, c.competitor_name, fontBold);
      if (c.ubicacion) cursor = drawKeyValue(cursor, doc, "Ubicacion", c.ubicacion, fontBold, font);
      if (c.trayectoria) cursor = drawKeyValue(cursor, doc, "Trayectoria", c.trayectoria, fontBold, font);
      if (c.promociones && c.promociones.length > 0) {
        cursor = drawKeyValue(cursor, doc, "Promociones", c.promociones.join(" · "), fontBold, font);
      }
    }
    cursor = drawDivider(cursor, doc);
  }

  // ─── Documento markdown completo ───
  if (data.strategy.document_md) {
    cursor = drawH1(cursor, doc, "Plan detallado", fontBold);
    cursor = renderMarkdownBlock(cursor, doc, data.strategy.document_md, font, fontBold);
  }

  // ─── Último reporte si existe ───
  if (data.latestReport) {
    cursor = drawDivider(cursor, doc);
    cursor = drawH2(
      cursor,
      doc,
      `Ultimo reporte (${data.latestReport.report_type})`,
      fontBold,
    );
    if (data.latestReport.executive_summary) {
      cursor = drawParagraph(cursor, doc, data.latestReport.executive_summary, font);
    }
  }

  // ─── Footer paginación ───
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((p, i) => {
    p.drawText(`FLUX Marketing Strategy · ${data.strategy.name.replace(/[^\x00-\x7F]/g, "")}`, {
      x: MARGIN.left,
      y: 20,
      size: 8,
      font,
      color: COLORS.muted,
    });
    p.drawText(`${i + 1} / ${total}`, {
      x: PAGE.width - MARGIN.right - 30,
      y: 20,
      size: 8,
      font,
      color: COLORS.muted,
    });
  });

  return doc.save();
}
