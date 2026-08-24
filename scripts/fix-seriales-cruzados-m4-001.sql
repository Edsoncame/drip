-- Corrección: los números de serie de TKA-MACPRO-M4-001 y TKA-MACAIR-M4-001
-- están cruzados en la tabla `equipment`.
--
-- Detectado el 2026-08-21 al auditar la flota contra la API de SimpleMDM.
--
-- Evidencia (el identificador de modelo lo reporta el propio equipo vía MDM,
-- no lo escribe una persona):
--
--   LCQFN9K4JL  → Mac16,1   → MacBook Pro (14-inch, Nov 2024)  → SimpleMDM 2104251
--   FQJ6YYPL2H  → Mac16,12  → MacBook Air (13-inch, M4, 2025)  → SimpleMDM 2105705
--
-- En la base, sin embargo:
--   TKA-MACPRO-M4-001 (MacBook Pro 14" M4) tenía FQJ6YYPL2H  ← serie del Air
--   TKA-MACAIR-M4-001 (MacBook Air 13" M4) tenía LCQFN9K4JL  ← serie del Pro
--
-- Las fechas de compra corroboran que las filas están bien y solo la columna
-- `numero_serie` quedó cruzada al cargar los datos:
--   TKA-MACPRO-M4-001 comprada 2025-10-21 → LCQFN9K4JL inscrita 2025-10-22
--   TKA-MACAIR-M4-001 comprada 2025-10-23 → FQJ6YYPL2H inscrita 2025-10-23
--
-- POR QUÉ EL INTERCAMBIO VA EN TRES PASOS
-- `equipment_numero_serie_key` es una restricción UNIQUE y NO es diferible
-- (condeferrable = false), así que Postgres la valida fila por fila. Un swap
-- directo de dos valores falla en el primer UPDATE, porque el valor destino
-- todavía lo ocupa la otra fila:
--   ERROR: duplicate key value violates unique constraint
-- Se libera primero uno de los dos valores dejando la columna en NULL. La
-- restricción UNIQUE admite varios NULL — de hecho ya hay dos filas así
-- (TKA-MACAIR-M4-008 y TKA-MACPRO-M5-004, sin equipo físico cargado).
--
-- Se pone `mdm_device_id` en NULL para que la próxima sincronización vuelva a
-- enlazar cada fila con su equipo real por número de serie.
--
-- ANTES DE EJECUTAR: verificar físicamente el serial de ambos equipos
-- (menú Apple > Acerca de esta Mac). Son los que usan Securex01 y Securex02.
--
-- Respaldo previo recomendado:
--   \copy (select * from equipment) to 'equipment_backup.csv' with csv header
--
-- Uso:
--   DB=$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
--   psql "$DB" -f scripts/fix-seriales-cruzados-m4-001.sql

BEGIN;

-- Paso 1: liberar LCQFN9K4JL, que hoy lo ocupa la fila del Air.
UPDATE equipment
   SET numero_serie  = NULL,
       mdm_device_id = NULL,
       updated_at    = now()
 WHERE codigo_interno = 'TKA-MACAIR-M4-001';

-- Paso 2: el Pro toma su serie real. Esto libera FQJ6YYPL2H.
UPDATE equipment
   SET numero_serie  = 'LCQFN9K4JL',
       mdm_device_id = NULL,
       updated_at    = now()
 WHERE codigo_interno = 'TKA-MACPRO-M4-001';

-- Paso 3: el Air toma la suya.
UPDATE equipment
   SET numero_serie  = 'FQJ6YYPL2H',
       updated_at    = now()
 WHERE codigo_interno = 'TKA-MACAIR-M4-001';

-- Verificación: deben salir Pro→LCQFN9K4JL y Air→FQJ6YYPL2H, ambos sin mdm_device_id.
SELECT codigo_interno, modelo_completo, numero_serie, mdm_device_id
  FROM equipment
 WHERE codigo_interno IN ('TKA-MACPRO-M4-001', 'TKA-MACAIR-M4-001')
 ORDER BY codigo_interno;

COMMIT;

-- Después de ejecutar: pulsar "Sincronizar MDM" en el panel de inventario
-- para volver a poblar las columnas mdm_* con el equipo correcto.
