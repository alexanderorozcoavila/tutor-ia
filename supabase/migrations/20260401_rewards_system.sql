-- ============================================================
-- MIGRACIÓN: Sistema de Recompensas Diarias v1.0
-- Fecha: 2026-04-01
-- Incluye: recompensas, recompensa_diaria, uso_recompensa,
--          control_dispositivo
-- ============================================================

-- ENUM para tipo de ejecución de la recompensa
DO $$ BEGIN
    CREATE TYPE tipo_recompensa AS ENUM ('url', 'comando');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── 1. CATÁLOGO GLOBAL DE RECOMPENSAS (Gestionado por Admin) ───
CREATE TABLE IF NOT EXISTS recompensas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    imagen_url      TEXT,                        -- URL externa de imagen/logo
    imagen_data     BYTEA,                       -- Imagen binaria (upload)
    imagen_mime     VARCHAR(50) DEFAULT 'image/webp',
    icono_emoji     TEXT DEFAULT '🎁',           -- Fallback visual rápido
    url             TEXT,                        -- URL a abrir en kiosco
    comando         TEXT,                        -- Comando de sistema alternativo
    tipo            tipo_recompensa DEFAULT 'url', -- 'url' | 'comando'
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recompensas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en recompensas" ON recompensas FOR ALL USING (true);


-- ─── 2. ASIGNACIÓN DE RECOMPENSAS POR NIVEL/DÍA EN UN PLAN ───
-- Un plan puede tener hasta 3 recompensas por día (una por nivel)
-- nivel_requerido: 1 = 80%, 2 = 90%, 3 = 100%
CREATE TABLE IF NOT EXISTS recompensa_diaria (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_semanal_id     UUID NOT NULL REFERENCES plan_semanal(id) ON DELETE CASCADE,
    recompensa_id       UUID REFERENCES recompensas(id) ON DELETE SET NULL, -- NULL = sin recompensa
    dia_semana          INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 1=Lun...6=Sab
    nivel_requerido     INTEGER NOT NULL CHECK (nivel_requerido BETWEEN 1 AND 3) DEFAULT 1,
    minutos_disponibles INTEGER NOT NULL DEFAULT 15 CHECK (minutos_disponibles > 0),
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Un plan puede tener exactamente una recompensa por día POR NIVEL
    UNIQUE(plan_semanal_id, dia_semana, nivel_requerido)
);

ALTER TABLE recompensa_diaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en recompensa_diaria" ON recompensa_diaria FOR ALL USING (true);

-- Índice para búsquedas frecuentes (plan + día)
CREATE INDEX IF NOT EXISTS idx_recompensa_diaria_plan_dia 
    ON recompensa_diaria(plan_semanal_id, dia_semana);


-- ─── 3. HISTORIAL DE USO DE RECOMPENSAS ───
-- Registra cada activación de recompensa por parte del alumno
CREATE TABLE IF NOT EXISTS uso_recompensa (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recompensa_diaria_id UUID NOT NULL REFERENCES recompensa_diaria(id) ON DELETE CASCADE,
    alumno_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    iniciado_at         TIMESTAMPTZ DEFAULT NOW(),
    finalizado_at       TIMESTAMPTZ,             -- NULL hasta que el agente cierra la app
    minutos_usados      INTEGER DEFAULT 0,
    completado          BOOLEAN DEFAULT FALSE,    -- TRUE cuando el agente terminó correctamente

    -- Un alumno solo puede activar UNA VEZ por día cada recompensa (identificada por recompensa_diaria_id)
    UNIQUE(recompensa_diaria_id, alumno_id)
);

ALTER TABLE uso_recompensa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en uso_recompensa" ON uso_recompensa FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_uso_recompensa_alumno 
    ON uso_recompensa(alumno_id, iniciado_at DESC);


-- ─── 4. CONTROL DEL DISPOSITIVO EN TIEMPO REAL (Para el agente Python) ───
-- Esta tabla es el canal de comunicación entre la plataforma web y el agente
-- El agente la consulta cada N segundos para saber qué hacer
CREATE TABLE IF NOT EXISTS control_dispositivo (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recompensa_id       UUID REFERENCES recompensas(id) ON DELETE SET NULL, -- La recompensa a ejecutar
    uso_recompensa_id   UUID REFERENCES uso_recompensa(id) ON DELETE SET NULL, -- Referencia al uso activo
    minutos_disponibles INTEGER DEFAULT 0,
    estado              TEXT DEFAULT 'bloqueado' CHECK (estado IN ('bloqueado', 'activo')),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE control_dispositivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo en control_dispositivo" ON control_dispositivo FOR ALL USING (true);

-- Índice para polling del agente (siempre busca por alumno_id)
CREATE INDEX IF NOT EXISTS idx_control_dispositivo_alumno 
    ON control_dispositivo(alumno_id);

-- ─── 5. FUNCIÓN: Activar una recompensa (llamada desde la plataforma web) ───
-- Crea el registro de uso y actualiza el control del dispositivo atomicamente
CREATE OR REPLACE FUNCTION activar_recompensa(
    p_recompensa_diaria_id UUID,
    p_alumno_id            UUID
) RETURNS JSONB AS $$
DECLARE
    v_rd             recompensa_diaria%ROWTYPE;
    v_recompensa     recompensas%ROWTYPE;
    v_uso_id         UUID;
    v_result         JSONB;
BEGIN
    -- Obtener datos de la recompensa diaria
    SELECT * INTO v_rd FROM recompensa_diaria WHERE id = p_recompensa_diaria_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recompensa diaria no encontrada';
    END IF;

    -- Obtener datos de la recompensa
    SELECT * INTO v_recompensa FROM recompensas WHERE id = v_rd.recompensa_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recompensa no encontrada';
    END IF;

    -- Crear o recuperar registro de uso (UNICO por recompensa_diaria + alumno)
    INSERT INTO uso_recompensa (recompensa_diaria_id, alumno_id)
    VALUES (p_recompensa_diaria_id, p_alumno_id)
    ON CONFLICT (recompensa_diaria_id, alumno_id) DO NOTHING
    RETURNING id INTO v_uso_id;

    -- Si no se insertó (ya existe), recuperar el id
    IF v_uso_id IS NULL THEN
        SELECT id INTO v_uso_id FROM uso_recompensa 
        WHERE recompensa_diaria_id = p_recompensa_diaria_id AND alumno_id = p_alumno_id;
    END IF;

    -- Upsert en control_dispositivo para que el agente lo detecte
    INSERT INTO control_dispositivo (alumno_id, recompensa_id, uso_recompensa_id, minutos_disponibles, estado, updated_at)
    VALUES (p_alumno_id, v_rd.recompensa_id, v_uso_id, v_rd.minutos_disponibles, 'activo', NOW())
    ON CONFLICT (alumno_id) DO UPDATE SET
        recompensa_id       = EXCLUDED.recompensa_id,
        uso_recompensa_id   = EXCLUDED.uso_recompensa_id,
        minutos_disponibles = EXCLUDED.minutos_disponibles,
        estado              = 'activo',
        updated_at          = NOW();

    -- Resultado para el frontend
    SELECT jsonb_build_object(
        'uso_id',           v_uso_id,
        'recompensa_nombre', v_recompensa.nombre,
        'url',              v_recompensa.url,
        'comando',          v_recompensa.comando,
        'tipo',             v_recompensa.tipo,
        'minutos',          v_rd.minutos_disponibles
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
