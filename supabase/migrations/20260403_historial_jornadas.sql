/*
 * Migración: Medallas de Jornada en Historial Diario
 * - Añade columnas booleanas para cada jornada.
 */

ALTER TABLE public.historial_diario 
ADD COLUMN IF NOT EXISTS medal_manana BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS medal_tarde BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS medal_noche BOOLEAN DEFAULT FALSE;

-- Opcional: Agregar un flag para saber si esta tarea cuenta para gamificación (por si el tutor quiere poner notas sin medalla)
-- ALTER TABLE public.tarea_planificada ADD COLUMN IF NOT EXISTS is_gamificado BOOLEAN DEFAULT TRUE;
