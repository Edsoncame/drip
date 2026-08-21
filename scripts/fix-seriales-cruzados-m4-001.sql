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
-- Se pone `mdm_device_id` en NULL para que la próxima sincronización vuelva a
-- enlazar cada fila con su equipo real por número de serie.
--
-- ANTES DE EJECUTAR: verificar físicamente el serial de ambos equipos
-- (menú Apple > Acerca de esta Mac). Son los que usan Securex01 y Securex02.
--
-- Respaldo previo recomendado:
--   \copy (select * from equipment) to 'equipment_backup.csv' with csv header

BEGIN;

UPDATE equipment
   SET numero_serie  = 'LCQFN9K4JL',
       mdm_device_id = NULL,
       updated_at    = now()
 WHERE codigo_interno = 'TKA-MACPRO-M4-001';

UPDATE equipment
   SET numero_serie  = 'FQJ6YYPL2H',
       mdm_device_id = NULL,
       updated_at    = now()
 WHERE codigo_interno = 'TKA-MACAIR-M4-001';

-- Verificación: deben salir Pro→LCQFN9K4JL y Air→FQJ6YYPL2H.
SELECT codigo_interno, modelo_completo, numero_serie, mdm_device_id
  FROM equipment
 WHERE codigo_interno IN ('TKA-MACPRO-M4-001', 'TKA-MACAIR-M4-001');

COMMIT;

-- Después de ejecutar: pulsar "Sincronizar MDM" en el panel de inventario
-- para volver a poblar las columnas mdm_* con el equipo correcto.
