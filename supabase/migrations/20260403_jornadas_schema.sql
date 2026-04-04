/*
 * Migración: Implementación de Jornadas (Mañana, Tarde, Noche)
 * - Agrega 'hora_asignada' a plan_semanal_tareas.
 * - Crea la tabla 'configuracion_jornadas' para definir los horarios.
 */

-- Opcional: Agregar hora_asignada a la tabla de tareas del plan
ALTER TABLE public.tarea_planificada 
ADD COLUMN IF NOT EXISTS hora_asignada TIME NULL;

-- Crear tabla configuracion_jornadas (Solo existirá un registro que se actualizará, o vinculada al alumno si se requiere mas adelante. Por ahora usamos una config global).
CREATE TABLE IF NOT EXISTS public.configuracion_jornadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rango_manana VARCHAR(11) DEFAULT '00:00-11:59',
    rango_tarde VARCHAR(11) DEFAULT '12:00-17:59',
    rango_noche VARCHAR(11) DEFAULT '18:00-23:59',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar una configuración por defecto si la tabla está vacía
INSERT INTO public.configuracion_jornadas (rango_manana, rango_tarde, rango_noche)
SELECT '00:00-11:59', '12:00-17:59', '18:00-23:59'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_jornadas);

-- Habilitar RLS en configuracion_jornadas
ALTER TABLE public.configuracion_jornadas ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (ajustar en producción según rol)
CREATE POLICY "Permitir lectura de configuracion_jornadas a autenticados" 
ON public.configuracion_jornadas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir gestión de configuracion_jornadas a administradores" 
ON public.configuracion_jornadas FOR ALL 
TO authenticated 
USING (true);
