-- MIGRACIÓN: Sistema de Planificación Semanal (LMS)
-- Evolución con Gamificación Escalonada y Flujos de Revisión

DROP TABLE IF EXISTS historial_diario CASCADE;
DROP TABLE IF EXISTS tarea_planificada CASCADE;
DROP TABLE IF EXISTS plan_semanal CASCADE;

-- 1. Nueva Máquina de Estados para Soporte de Revisiones
DO $$ BEGIN
    CREATE TYPE estado_tarea AS ENUM ('pendiente', 'en_revision', 'completada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extensión para IDs seguros
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabla de Planificación Master
CREATE TABLE plan_semanal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_inicio DATE NOT NULL,          
    tutor_id UUID REFERENCES users(id) NOT NULL,
    alumno_id UUID REFERENCES users(id) NOT NULL,             
    meta_puntos_total INTEGER DEFAULT 0, 
    recompensa_nombre TEXT NOT NULL,
    recompensa_detalle TEXT,             
    esta_lograda BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción fundamental: Un alumno solo tiene UN plan activo por semana
    UNIQUE(alumno_id, fecha_inicio),
    
    -- Restricción de Caducidad: Obliga a que siempre inicie el día Lunes
    -- El sistema backend asumirá el cierre el Domingo 23:59.
    CONSTRAINT chk_fecha_lunes CHECK (EXTRACT(ISODOW FROM fecha_inicio) = 1)
);

-- Habilitación de RLS en plan_semanal (Opción A / MVP Abierto para Lecturas Frontend)
ALTER TABLE plan_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a planes" ON plan_semanal FOR ALL USING (true);


-- 3. Tabla de Detalles (Tareas polimórficas del Plan)
CREATE TABLE tarea_planificada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_semanal_id UUID REFERENCES plan_semanal(id) ON DELETE CASCADE, 
    
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6), 
    puntos_valor INTEGER NOT NULL DEFAULT 10,
    
    -- Nueva columna de estado (reemplaza 'completada')
    estado estado_tarea DEFAULT 'pendiente',
    fecha_completado TIMESTAMPTZ,
    
    tipo_modulo TEXT NOT NULL, 
    modulo_id UUID NOT NULL,   
    
    alumno_id UUID NOT NULL,
    orden_visual INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}' 
);

-- Habilitación de RLS en tarea_planificada
ALTER TABLE tarea_planificada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a planificadas" ON tarea_planificada FOR ALL USING (true);


-- 4. NUEVO: Historial Diario de Gamificación (OPCIÓN B - RLS CERRADO!)
CREATE TABLE historial_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_semanal_id UUID REFERENCES plan_semanal(id) ON DELETE CASCADE,
    alumno_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
    
    porcentaje_logrado DECIMAL(5,2) DEFAULT 0.00,
    nivel_alcanzado INTEGER DEFAULT 0, -- 1 (80%), 2 (90%), 3 (100%)
    fecha_corte DATE NOT NULL DEFAULT CURRENT_DATE,
    
    UNIQUE(plan_semanal_id, dia_semana)
);

-- HABILITAMOS SEGURIDAD, PERO NO DAMOS PERMISO A NADIE.
-- (Bypassed solo por Server Actions / RPC usando el rol postgres o service_role)
ALTER TABLE historial_diario ENABLE ROW LEVEL SECURITY;

-- 5. Índices de rendimiento
CREATE INDEX idx_plan_semanal_fecha ON plan_semanal(alumno_id, fecha_inicio);
CREATE INDEX idx_tarea_planificada_modulo ON tarea_planificada(modulo_id);
CREATE INDEX idx_tarea_planificada_dia ON tarea_planificada(plan_semanal_id, dia_semana);
CREATE INDEX idx_historial_diario_lookup ON historial_diario(plan_semanal_id, dia_semana);
