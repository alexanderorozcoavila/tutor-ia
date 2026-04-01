-- ============================================================
-- PATCH: Corrección de la función activar_recompensa
-- Evita que una recompensa completada pueda ser reactivada.
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION activar_recompensa(
    p_recompensa_diaria_id UUID,
    p_alumno_id            UUID
) RETURNS JSONB AS $$
DECLARE
    v_rd             recompensa_diaria%ROWTYPE;
    v_recompensa     recompensas%ROWTYPE;
    v_uso_existente  uso_recompensa%ROWTYPE;
    v_uso_id         UUID;
    v_result         JSONB;
BEGIN
    -- 1. Obtener datos de la recompensa diaria
    SELECT * INTO v_rd FROM recompensa_diaria WHERE id = p_recompensa_diaria_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recompensa diaria no encontrada';
    END IF;

    -- 2. Obtener datos de la recompensa base
    SELECT * INTO v_recompensa FROM recompensas WHERE id = v_rd.recompensa_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recompensa no encontrada';
    END IF;

    -- 3. *** NUEVA VALIDACIÓN: Verificar si ya existe un uso para hoy ***
    SELECT * INTO v_uso_existente
    FROM uso_recompensa
    WHERE recompensa_diaria_id = p_recompensa_diaria_id
      AND alumno_id = p_alumno_id;

    IF FOUND THEN
        -- Si ya fue completada → bloquear completamente
        IF v_uso_existente.completado = TRUE THEN
            RAISE EXCEPTION 'Esta recompensa ya fue utilizada hoy. Solo se permite un uso por día.';
        END IF;

        -- Si está en curso (agente activo) → retornar el estado actual sin duplicar
        v_uso_id := v_uso_existente.id;

        SELECT jsonb_build_object(
            'uso_id',            v_uso_id,
            'recompensa_nombre', v_recompensa.nombre,
            'url',               v_recompensa.url,
            'comando',           v_recompensa.comando,
            'tipo',              v_recompensa.tipo,
            'minutos',           v_rd.minutos_disponibles,
            'ya_en_curso',       TRUE
        ) INTO v_result;

        RETURN v_result;
    END IF;

    -- 4. Crear nuevo registro de uso (primera vez)
    INSERT INTO uso_recompensa (recompensa_diaria_id, alumno_id)
    VALUES (p_recompensa_diaria_id, p_alumno_id)
    RETURNING id INTO v_uso_id;

    -- 5. Upsert en control_dispositivo para que el agente lo detecte
    INSERT INTO control_dispositivo (alumno_id, recompensa_id, uso_recompensa_id, minutos_disponibles, estado, updated_at)
    VALUES (p_alumno_id, v_rd.recompensa_id, v_uso_id, v_rd.minutos_disponibles, 'activo', NOW())
    ON CONFLICT (alumno_id) DO UPDATE SET
        recompensa_id       = EXCLUDED.recompensa_id,
        uso_recompensa_id   = EXCLUDED.uso_recompensa_id,
        minutos_disponibles = EXCLUDED.minutos_disponibles,
        estado              = 'activo',
        updated_at          = NOW();

    -- 6. Resultado para el frontend
    SELECT jsonb_build_object(
        'uso_id',            v_uso_id,
        'recompensa_nombre', v_recompensa.nombre,
        'url',               v_recompensa.url,
        'comando',           v_recompensa.comando,
        'tipo',              v_recompensa.tipo,
        'minutos',           v_rd.minutos_disponibles,
        'ya_en_curso',       FALSE
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
