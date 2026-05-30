/**
 * Integración con SimpleMDM (https://a.simplemdm.com).
 *
 * SimpleMDM es la fuente de verdad del HARDWARE (serie, modelo, capacidad,
 * estado de inscripción). Flux es la fuente de verdad del NEGOCIO (compra,
 * financiamiento, alquiler, cliente). Esta capa trae lo primero a la tabla
 * `equipment` sin pisar lo segundo.
 *
 * Estrategia de match (en orden): mdm_device_id → numero_serie → codigo_interno.
 * En equipos ya existentes solo rellena campos de hardware VACÍOS (COALESCE) y
 * siempre refresca el estado en vivo (mdm_*). Nunca toca datos financieros.
 */
import { query } from "@/lib/db";

const API_BASE = "https://a.simplemdm.com/api/v1";

function apiKey(): string {
  const key = process.env.SIMPLEMDM_API_KEY;
  if (!key) throw new Error("SIMPLEMDM_API_KEY no configurada");
  return key;
}

function authHeader(): string {
  // SimpleMDM usa Basic auth con la API key como usuario y contraseña vacía.
  return "Basic " + Buffer.from(`${apiKey()}:`).toString("base64");
}

// ─── Tipos (subset de los atributos que nos importan) ───────────────────────
export interface SimpleMdmDevice {
  id: number;
  attributes: {
    name: string | null;
    device_name: string | null;
    model_name: string | null;
    model: string | null;
    serial_number: string | null;
    device_capacity: number | null;
    status: string | null;
    last_seen_at: string | null;
    os_version: string | null;
    battery_level: string | null;
    filevault_enabled: boolean | null;
    is_supervised: boolean | null;
    processor_architecture: string | null;
  };
}

// ─── Llamadas a la API ──────────────────────────────────────────────────────
export async function fetchAllDevices(): Promise<SimpleMdmDevice[]> {
  const all: SimpleMdmDevice[] = [];
  let startingAfter: number | null = null;
  // Paginación cursor de SimpleMDM: limit + starting_after (id del último).
  for (let guard = 0; guard < 100; guard++) {
    const url = `${API_BASE}/devices?limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: authHeader() } });
    if (!res.ok) throw new Error(`SimpleMDM ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: SimpleMdmDevice[]; has_more: boolean };
    all.push(...json.data);
    if (!json.has_more || json.data.length === 0) break;
    startingAfter = json.data[json.data.length - 1].id;
  }
  return all;
}

export async function fetchDevice(id: number | string): Promise<SimpleMdmDevice | null> {
  const res = await fetch(`${API_BASE}/devices/${id}`, { headers: { Authorization: authHeader() } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SimpleMDM ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: SimpleMdmDevice };
  return json.data;
}

// ─── Mapeo MDM → campos de hardware Flux ────────────────────────────────────
/** Deriva el chip (M4, M5, M4 Pro…) del nombre del modelo o del model id. */
export function chipFromModel(modelName: string | null, modelId: string | null): string | null {
  const m = modelName?.match(/\bM\d+(\s?(Pro|Max|Ultra))?\b/i);
  if (m) return m[0].replace(/\s+/g, " ").trim();
  // Fallback para modelos cuyo nombre no incluye el chip (ej. "MacBook Pro (14-inch, Nov 2024)").
  const byId: Record<string, string> = { "Mac16,1": "M4", "Mac16,6": "M4 Pro", "Mac16,8": "M4 Max" };
  return (modelId && byId[modelId]) || null;
}

/** Redondea la capacidad reportada (GB formateados) al tamaño comercial de SSD. */
export function ssdFromCapacity(gb: number | null): string | null {
  if (!gb || gb <= 0) return null;
  if (gb >= 3800) return "4 TB";
  if (gb >= 1900) return "2 TB";
  if (gb >= 950) return "1 TB";
  if (gb >= 460) return "512 GB";
  if (gb >= 230) return "256 GB";
  if (gb >= 115) return "128 GB";
  return `${Math.round(gb)} GB`;
}

interface MappedDevice {
  mdm_device_id: string;
  codigo_interno: string;
  numero_serie: string | null;
  modelo_completo: string;
  chip: string | null;
  ssd: string | null;
  mdm_status: string | null;
  mdm_last_seen: string | null;
  mdm_os_version: string | null;
  mdm_battery: string | null;
  mdm_filevault: boolean | null;
  mdm_supervised: boolean | null;
}

export function mapDevice(d: SimpleMdmDevice): MappedDevice {
  const a = d.attributes;
  const serial = a.serial_number || null;
  const codigo = a.device_name || a.name || (serial ? `MDM-${serial}` : `MDM-${d.id}`);
  return {
    mdm_device_id: String(d.id),
    codigo_interno: codigo,
    numero_serie: serial,
    modelo_completo: a.model_name || a.model || "Apple device",
    chip: chipFromModel(a.model_name, a.model),
    ssd: ssdFromCapacity(a.device_capacity),
    mdm_status: a.status || null,
    mdm_last_seen: a.last_seen_at || null,
    mdm_os_version: a.os_version || null,
    mdm_battery: a.battery_level || null,
    mdm_filevault: a.filevault_enabled,
    mdm_supervised: a.is_supervised,
  };
}

// ─── Migración idempotente de columnas MDM ──────────────────────────────────
let columnsEnsured = false;
export async function ensureMdmColumns(): Promise<void> {
  if (columnsEnsured) return;
  await query(`
    ALTER TABLE equipment
      ADD COLUMN IF NOT EXISTS mdm_device_id  TEXT,
      ADD COLUMN IF NOT EXISTS mdm_status     TEXT,
      ADD COLUMN IF NOT EXISTS mdm_last_seen  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS mdm_os_version TEXT,
      ADD COLUMN IF NOT EXISTS mdm_battery    TEXT,
      ADD COLUMN IF NOT EXISTS mdm_filevault  BOOLEAN,
      ADD COLUMN IF NOT EXISTS mdm_supervised BOOLEAN,
      ADD COLUMN IF NOT EXISTS mdm_synced_at  TIMESTAMPTZ
  `);
  // Índice único parcial para linkear por device id sin chocar con filas sin MDM.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS equipment_mdm_device_id_uniq
               ON equipment (mdm_device_id) WHERE mdm_device_id IS NOT NULL`);
  columnsEnsured = true;
}

// ─── Upsert ─────────────────────────────────────────────────────────────────
export type UpsertAction = "created" | "updated";
export interface UpsertResult { action: UpsertAction; codigo: string; }

/**
 * Inserta o actualiza un equipo a partir de un device de SimpleMDM.
 * - Match: mdm_device_id → numero_serie → codigo_interno.
 * - Existente: rellena hardware vacío (COALESCE) + refresca estado MDM. No toca finanzas.
 * - Inexistente: lo crea con datos de hardware y estado "Disponible" (si create=true).
 */
export async function upsertDeviceToEquipment(
  d: SimpleMdmDevice,
  opts: { create: boolean } = { create: true },
): Promise<UpsertResult | null> {
  const m = mapDevice(d);

  const found = await query<{ id: string; codigo_interno: string }>(
    `SELECT id, codigo_interno FROM equipment
     WHERE mdm_device_id = $1
        OR (numero_serie IS NOT NULL AND numero_serie = $2)
        OR codigo_interno = $3
     ORDER BY (mdm_device_id = $1) DESC
     LIMIT 1`,
    [m.mdm_device_id, m.numero_serie, m.codigo_interno],
  );

  if (found.rows[0]) {
    const id = found.rows[0].id;
    await query(
      `UPDATE equipment SET
         numero_serie    = COALESCE(NULLIF(numero_serie, ''), $2),
         chip            = COALESCE(NULLIF(chip, ''), $3),
         ssd             = COALESCE(NULLIF(ssd, ''), $4),
         marca           = COALESCE(NULLIF(marca, ''), 'Apple'),
         mdm_device_id   = $1,
         mdm_status      = $5,
         mdm_last_seen   = $6,
         mdm_os_version  = $7,
         mdm_battery     = $8,
         mdm_filevault   = $9,
         mdm_supervised  = $10,
         mdm_synced_at   = NOW(),
         updated_at      = NOW()
       WHERE id = $11`,
      [m.mdm_device_id, m.numero_serie, m.chip, m.ssd, m.mdm_status, m.mdm_last_seen,
       m.mdm_os_version, m.mdm_battery, m.mdm_filevault, m.mdm_supervised, id],
    );
    return { action: "updated", codigo: found.rows[0].codigo_interno };
  }

  if (!opts.create) return null;

  await query(
    `INSERT INTO equipment (
       codigo_interno, marca, modelo_completo, chip, ssd, numero_serie,
       estado_actual, observaciones,
       mdm_device_id, mdm_status, mdm_last_seen, mdm_os_version, mdm_battery,
       mdm_filevault, mdm_supervised, mdm_synced_at
     ) VALUES ($1,'Apple',$2,$3,$4,$5,'Disponible',$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
    [m.codigo_interno, m.modelo_completo, m.chip, m.ssd, m.numero_serie,
     "Importado de SimpleMDM — completar RAM, color y datos financieros.",
     m.mdm_device_id, m.mdm_status, m.mdm_last_seen, m.mdm_os_version, m.mdm_battery,
     m.mdm_filevault, m.mdm_supervised],
  );
  return { action: "created", codigo: m.codigo_interno };
}

/** Marca un equipo como fuera del MDM (device.unenrolled) sin borrarlo. */
export async function markUnenrolled(deviceId: number | string): Promise<void> {
  await query(
    `UPDATE equipment SET mdm_status = 'unenrolled', mdm_synced_at = NOW(), updated_at = NOW()
     WHERE mdm_device_id = $1`,
    [String(deviceId)],
  );
}
