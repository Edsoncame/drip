import { query } from "@/lib/db";

/**
 * Guarda la última dirección de entrega del usuario para prellenar el próximo
 * checkout. Una sola columna JSONB en `users` (el teléfono ya existe aparte).
 * Forma: { method, street, streetNumber, distrito, reference, placeType, apartment, floor }
 */
export interface SavedDelivery {
  method?: string; street?: string; streetNumber?: string; distrito?: string;
  reference?: string; placeType?: string; apartment?: string; floor?: string;
}

let ensured = false;
export async function ensureUserDeliveryColumn(): Promise<void> {
  if (ensured) return;
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_delivery JSONB`);
  ensured = true;
}
