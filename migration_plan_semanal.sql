-- MIGRACIÓN: Sistema de Planificación Semanal (LMS)
-- ¡Advertencia! Elimina las tablas preexistentes si existen, incluyendo los datos de las mismas.

DROP TABLE IF EXISTS tarea_planificada CASCADE;
DROP TABLE IF EXISTS plan_semanal CASCADE;

-- Extensión para IDs seguros
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de Planificación Master
CREATE TABLE plan_semanal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_inicio DATE NOT NULL,          -- Se espera Lunes de la semana
    tutor_id UUID REFERENCES users(id) NOT NULL,
    alumno_id UUID REFERENCES users(id) NOT NULL,             
    meta_puntos_total INTEGER DEFAULT 0, 
    recompensa_nombre TEXT NOT NULL,
    recompensa_detalle TEXT,             -- Usará Tiptap
    esta_lograda BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Restricción fundamental: Un alumno solo tiene UN plan activo por semana
    UNIQUE(alumno_id, fecha_inicio)
);

-- Habilitación de RLS en plan_semanal (asumiendo que los alumnos se autentican de alguna forma mapeada o la UI filtra por servidor)
ALTER TABLE plan_semanal ENABLE ROW LEVEL SECURITY;

-- Política abierta alineada con el MVP (Auth.uid() no aplica por Auth custom)
CREATE POLICY "Permitir todo a planes" ON plan_semanal FOR ALL USING (true);


-- Tabla de Detalles (Tareas polimórficas del Plan)
CREATE TABLE tarea_planificada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_semanal_id UUID REFERENCES plan_semanal(id) ON DELETE CASCADE, 
    
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),  -- 0 D, 1 L, 2 M...
    puntos_valor INTEGER NOT NULL DEFAULT 10,
    completada BOOLEAN DEFAULT FALSE,
    fecha_completado TIMESTAMPTZ,
    
    tipo_modulo TEXT NOT NULL, -- Enum aplicativo: 'HOGAR', 'DICTADO', 'LECTURA', 'EVALUACION'
    modulo_id UUID NOT NULL,   -- Mapea a la tabla: tasks (o assessments, si se separa al final)
    
    alumno_id UUID NOT NULL,
    orden_visual INTEGER DEFAULT 0 
);

-- Habilitación de RLS en tarea_planificada
ALTER TABLE tarea_planificada ENABLE ROW LEVEL SECURITY;

-- Política abierta alineada con el MVP (Auth.uid() no aplica por Auth custom)
CREATE POLICY "Permitir todo a planificadas" ON tarea_planificada FOR ALL USING (true);

-- Indices útiles para desempeño de queries diarios
CREATE INDEX idx_plan_semanal_fecha ON plan_semanal(alumno_id, fecha_inicio);
CREATE INDEX idx_tarea_planificada_modulo ON tarea_planificada(modulo_id);
CREATE INDEX idx_tarea_planificada_dia ON tarea_planificada(plan_semanal_id, dia_semana);

