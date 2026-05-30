import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { fireSyncCatalog } from "@/lib/dropchat-catalog";
import { ensureInventoryColumns } from "@/lib/inventory";

export const runtime = "nodejs";
export const maxDuration = 60;

const tag = "[admin/equipment/import]";

// ─── Parsers tolerantes (la hoja trae "S/.991.57", "$32.50", "1,754.87", dd/mm/yyyy) ──
function parseNum(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t || t === "-" || t === "—") return null;
  const negative = /^-|-\s*\$/.test(t);
  const m = t.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
function parseInt0(raw: string | undefined): number | null {
  const n = parseNum(raw);
  return n == null ? null : Math.round(n);
}
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  const m = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (!m) return null;
  const d = m[1], mo = m[2];
  let y = m[3];
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Kind = "text" | "num" | "int" | "date" | "url" | "serie";
// header normalizado → [columna equipment, tipo de valor]
const MAP: Record<string, [string, Kind]> = {
  "codigo interno": ["codigo_interno", "text"],
  "marca": ["marca", "text"],
  "modelo completo": ["modelo_completo", "text"],
  "chip": ["chip", "text"],
  "ram": ["ram", "text"],
  "ssd": ["ssd", "text"],
  "ciclos": ["battery_cycles", "int"],
  "color": ["color", "text"],
  "teclado": ["teclado", "text"],
  "n serie": ["numero_serie", "serie"],
  "numero de serie": ["numero_serie", "serie"],
  "proveedor": ["proveedor", "text"],
  "factura": ["factura_url", "url"],
  "web": ["web_url", "url"],
  "fecha compra": ["fecha_compra", "date"],
  "mantenimiento proximo": ["mantenimiento_proximo", "date"],
  "precio compra usd": ["precio_compra_usd", "num"],
  "tipo cambio s": ["tipo_cambio", "num"],
  "valor en soles s": ["valor_soles", "num"],
  "tipo de financiamiento": ["tipo_financiamiento", "text"],
  "plazo credito m": ["plazo_credito_meses", "int"],
  "cuota credito soles": ["cuota_credito_soles", "num"],
  "estado actual": ["estado_actual", "text"],
  "cliente actual": ["cliente_actual", "text"],
  "tipo de arriendo meses": ["tipo_arriendo_meses", "int"],
  "inicio alquiler": ["inicio_alquiler", "date"],
  "fin alquiler": ["fin_alquiler", "date"],
  "tarifa usd": ["tarifa_usd", "num"],
  "opex usd": ["opex_usd", "num"],
  "ingreso neto mensual usd": ["ingreso_neto_mensual_usd", "num"],
  "valor residual 52 usd": ["valor_residual_usd", "num"],
  "valor residual usd": ["valor_residual_usd", "num"],
  "ingreso total proyectado usd": ["ingreso_total_proyectado_usd", "num"],
  "seguro": ["seguro", "text"],
  "garantia anos": ["garantia_anos", "int"],
  "ubicacion fisica": ["ubicacion_fisica", "text"],
  "responsable": ["responsable", "text"],
  "usuario": ["usuario_dispositivo", "text"],
  "clave": ["clave_dispositivo", "text"],
  "clave vaul": ["clave_vault", "text"],
  "clave vault": ["clave_vault", "text"],
  "observaciones": ["observaciones", "text"],
};

function coerce(kind: Kind, raw: string): string | number | null {
  const t = (raw ?? "").trim();
  switch (kind) {
    case "num": return parseNum(t);
    case "int": return parseInt0(t);
    case "date": return parseDate(t);
    case "url": return /^https?:\/\//i.test(t) ? t : null; // "Pendiente"/"Mercado Libre" no son URLs
    case "serie": return t || null;
    default: return t || null;
  }
}

interface RowResult { codigo: string; action: "creado" | "actualizado"; }
interface Conflict { codigo: string; serie_hoja: string; serie_actual: string; }

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { text, tipo } = (await req.json()) as { text?: string; tipo?: string };
  const tipoNorm = tipo === "venta" ? "venta" : "alquiler";
  if (!text || !text.trim()) return NextResponse.json({ error: "Pega las filas de tu hoja primero" }, { status: 400 });

  // Las celdas pegadas de una hoja vienen separadas por TAB.
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return NextResponse.json({ error: "Necesito la fila de encabezados + al menos una fila de datos" }, { status: 400 });

  const delim = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delim).map(normHeader);
  // Mapeo columna-índice → [columna, kind]. Si hay headers repetidos (ej. 2x Observaciones), gana el primero.
  const cols: ([string, Kind] | null)[] = headers.map((h) => MAP[h] ?? null);
  if (!cols.some((c) => c?.[0] === "codigo_interno")) {
    return NextResponse.json({ error: "No encontré la columna 'Código interno' en los encabezados" }, { status: 400 });
  }

  await ensureInventoryColumns();

  const results: RowResult[] = [];
  const conflictos: Conflict[] = [];
  const skipped: string[] = [];

  for (const line of lines.slice(1)) {
    const cells = line.split(delim);
    const data: Record<string, string | number> = {};
    let serieHoja: string | null = null;

    cols.forEach((c, i) => {
      if (!c) return;
      const [col, kind] = c;
      const v = coerce(kind, cells[i] ?? "");
      if (v == null || v === "") return;
      if (kind === "serie") { serieHoja = String(v); return; } // el serial lo manda MDM: no se escribe
      data[col] = v;
    });

    const codigo = String(data.codigo_interno ?? "").trim();
    if (!codigo) { skipped.push("(fila sin código)"); continue; }
    data.tipo = tipoNorm;

    const found = await query<{ id: string; numero_serie: string | null }>(
      `SELECT id, numero_serie FROM equipment WHERE codigo_interno = $1 LIMIT 1`,
      [codigo],
    );

    // Conflicto de serie hoja-vs-MDM (no se aplica; se reporta)
    if (serieHoja && found.rows[0]?.numero_serie && found.rows[0].numero_serie !== serieHoja) {
      conflictos.push({ codigo, serie_hoja: serieHoja, serie_actual: found.rows[0].numero_serie });
    }

    if (found.rows[0]) {
      const id = found.rows[0].id;
      const keys = Object.keys(data).filter((k) => k !== "codigo_interno");
      if (keys.length === 0) { results.push({ codigo, action: "actualizado" }); continue; }
      const sets = keys.map((k, idx) => `${k} = $${idx + 1}`);
      const vals = keys.map((k) => data[k]);
      sets.push("updated_at = NOW()");
      await query(`UPDATE equipment SET ${sets.join(", ")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      results.push({ codigo, action: "actualizado" });
    } else {
      if (!data.modelo_completo) data.modelo_completo = codigo; // requerido NOT NULL
      if (!data.marca) data.marca = "Apple";
      const keys = Object.keys(data);
      const placeholders = keys.map((_, idx) => `$${idx + 1}`);
      await query(
        `INSERT INTO equipment (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`,
        keys.map((k) => data[k]),
      );
      results.push({ codigo, action: "creado" });
    }
  }

  const creados = results.filter((r) => r.action === "creado").length;
  const actualizados = results.filter((r) => r.action === "actualizado").length;
  if (creados + actualizados > 0) fireSyncCatalog();
  console.log(`${tag} tipo=${tipoNorm} creados=${creados} actualizados=${actualizados} conflictos=${conflictos.length}`);

  return NextResponse.json({ ok: true, tipo: tipoNorm, creados, actualizados, conflictos, skipped });
}
