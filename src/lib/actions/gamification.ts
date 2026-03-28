"use server";

import { supabaseAdmin } from "@/lib/supabaseServer";

export async function calcularNivelDiario(planId: string, diaSemana: number, alumnoId: string) {
  if (!planId || diaSemana < 0 || diaSemana > 6) return null;

  try {
    // 1. Obtener tareas del día
    const { data: tareas, error: fetchError } = await supabaseAdmin
      .from('tarea_planificada')
      .select('puntos_valor, estado')
      .eq('plan_semanal_id', planId)
      .eq('dia_semana', diaSemana);

    if (fetchError) throw fetchError;
    if (!tareas || tareas.length === 0) return { porcentaje: 0, nivel: 0 };

    // 2. Calcular porcentaje (Solo 'completada' cuentan)
    const totalPuntos = tareas.reduce((acc, t) => acc + t.puntos_valor, 0);
    const puntosLogrados = tareas
      .filter(t => t.estado === 'completada')
      .reduce((acc, t) => acc + t.puntos_valor, 0);

    const porcentaje = totalPuntos > 0 ? (puntosLogrados / totalPuntos) * 100 : 0;

    // 3. Evaluar Niveles
    let nivel = 0;
    if (porcentaje === 100) nivel = 3;       // Perfecto
    else if (porcentaje >= 90) nivel = 2;    // Oro
    else if (porcentaje >= 80) nivel = 1;    // Plata

    // 4. Registrar en historial usando el cliente administrativo
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('historial_diario')
      .upsert({
        plan_semanal_id: planId,
        alumno_id: alumnoId,
        dia_semana: diaSemana,
        porcentaje_logrado: porcentaje,
        nivel_alcanzado: nivel,
        fecha_corte: new Date().toISOString().split('T')[0]
      }, { onConflict: 'plan_semanal_id, dia_semana' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return { porcentaje, nivel, data: upserted };
  } catch (err) {
    console.error("Error en calcularNivelDiario:", err);
    return null;
  }
}
