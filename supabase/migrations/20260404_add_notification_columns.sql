-- Migration: Añadir columnas notification_sound y attention_max_minutes a system_settings
-- Ejecutar en Supabase SQL editor o como parte de migraciones

BEGIN;

ALTER TABLE IF EXISTS public.system_settings
  ADD COLUMN IF NOT EXISTS notification_sound text DEFAULT '/sounds/beep.mp3';

ALTER TABLE IF EXISTS public.system_settings
  ADD COLUMN IF NOT EXISTS attention_max_minutes integer DEFAULT 0;

COMMIT;

-- Nota: Después de aplicar esta migración, verifica que la fila de configuración exista
-- y tenga valores por defecto. Si usas una tabla con una única fila, puedes ejecutar:
-- INSERT INTO public.system_settings (id, notification_sound, attention_max_minutes)
--   VALUES (1, '/sounds/beep.mp3', 0)
-- ON CONFLICT (id) DO NOTHING;
