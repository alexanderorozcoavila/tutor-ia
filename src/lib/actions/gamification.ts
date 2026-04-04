"use server";

import { supabaseAdmin } from "@/lib/supabaseServer";

export async function calcularNivelDiario(planId: string, diaSemana: number, alumnoId: string) {
  if (!planId || diaSemana < 0 || diaSemana > 6) return null;

  try {
    // 0. Obtener configuración de jornadas
    const { data: config } = await supabaseAdmin
      .from('configuracion_jornadas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const ranges = config || {
      rango_manana: '00:00-11:59',
      rango_tarde: '12:00-17:59',
      rango_noche: '18:00-23:59'
    };

    // 1. Obtener tareas del día con hora_asignada
    const { data: tareas, error: fetchError } = await supabaseAdmin
      .from('tarea_planificada')
      .select('puntos_valor, estado, hora_asignada')
      .eq('plan_semanal_id', planId)
      .eq('dia_semana', diaSemana);

    if (fetchError) throw fetchError;
    if (!tareas || tareas.length === 0) return { porcentaje: 0, nivel: 0, medals: { manana: false, tarde: false, noche: false } };

    // 2. Agrupar tareas por jornada
    const isTaskInRage = (hora: string | null, range: string) => {
      if (!hora) return true; // Flexible
      const [start, end] = range.split('-');
      const h = hora.substring(0, 5);
      return h >= start && h <= end;
    };

    const tManana = tareas.filter(t => isTaskInRage(t.hora_asignada, ranges.rango_manana));
    const tTarde = tareas.filter(t => isTaskInRage(t.hora_asignada, ranges.rango_tarde));
    const tNoche = tareas.filter(t => isTaskInRage(t.hora_asignada, ranges.rango_noche));

    const checkMedal = (list: any[]) => list.length > 0 && list.every(t => t.estado === 'completada');

    const medals = {
      manana: checkMedal(tManana),
      tarde: checkMedal(tTarde),
      noche: checkMedal(tNoche)
    };

    // 3. Calcular porcentaje global (para compatibilidad)
    const totalPuntos = tareas.reduce((acc, t) => acc + t.puntos_valor, 0);
    const puntosLogrados = tareas
      .filter(t => t.estado === 'completada')
      .reduce((acc, t) => acc + t.puntos_valor, 0);

    const porcentaje = totalPuntos > 0 ? (puntosLogrados / totalPuntos) * 100 : 0;

    // Mantener 'nivel' para compatibilidad legacy (en desuso gradual)
    let nivel = 0;
    if (porcentaje === 100) nivel = 3;
    else if (porcentaje >= 90) nivel = 2;
    else if (porcentaje >= 80) nivel = 1;

    // 4. Registrar en historial usando el cliente administrativo
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('historial_diario')
      .upsert({
        plan_semanal_id: planId,
        alumno_id: alumnoId,
        dia_semana: diaSemana,
        porcentaje_logrado: porcentaje,
        nivel_alcanzado: nivel,
        medal_manana: medals.manana,
        medal_tarde: medals.tarde,
        medal_noche: medals.noche,
        fecha_corte: new Date().toISOString().split('T')[0]
      }, { onConflict: 'plan_semanal_id, dia_semana' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return { porcentaje, nivel, medals, data: upserted };
  } catch (err) {
    console.error("Error en calcularNivelDiario:", err);
    return null;
  }
}
