-- Fix RLS policy for configuracion_jornadas
DROP POLICY IF EXISTS "Permitir gestión de configuracion_jornadas a administradores" ON public.configuracion_jornadas;

CREATE POLICY "Permitir gestión de configuracion_jornadas a administradores" 
ON public.configuracion_jornadas FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
