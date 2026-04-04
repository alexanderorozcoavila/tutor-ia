import { supabase, isSupabaseConfigured } from './supabase';

export interface TareaPlanificada {
  id: string;
  plan_semanal_id?: string;
  dia_semana: number;
  puntos_valor: number;
  estado: "pendiente" | "en_revision" | "completada";
  fecha_completado?: string;
  tipo_modulo: string;
  modulo_id: string;
  alumno_id: string;
  orden_visual: number;
  hora_asignada?: string | null;
  metadata?: any;
  
  // Opcional, traído con JOIN
  task_detalle?: any;
}

export interface PlanSemanal {
  id: string;
  fecha_inicio: string;
  tutor_id: string;
  alumno_id: string;
  meta_puntos_total: number;
  recompensa_nombre: string;
  recompensa_detalle?: string;
  esta_lograda: boolean;
  created_at: string;

  tareas?: TareaPlanificada[];
}

// ─── LOCAL STORAGE FALLBACKS ───
const LS_MODE = !isSupabaseConfigured;
const LS_KEY_PLAN = 'ia_tutor_planes';
const LS_KEY_TAREAS = 'ia_tutor_tareas_plan';

const getLocalPlanes = (): PlanSemanal[] => {
  if (typeof window === 'undefined') return [];
  const val = localStorage.getItem(LS_KEY_PLAN);
  return val ? JSON.parse(val) : [];
};
const saveLocalPlanes = (data: PlanSemanal[]) => {
  if (typeof window !== 'undefined') localStorage.setItem(LS_KEY_PLAN, JSON.stringify(data));
};

const getLocalTareasPlan = (): TareaPlanificada[] => {
  if (typeof window === 'undefined') return [];
  const val = localStorage.getItem(LS_KEY_TAREAS);
  return val ? JSON.parse(val) : [];
};
const saveLocalTareasPlan = (data: TareaPlanificada[]) => {
  if (typeof window !== 'undefined') localStorage.setItem(LS_KEY_TAREAS, JSON.stringify(data));
};

// ─── HELPERS DE FECHA ───
export const getMonday = (dateInput: Date | string) => {
  // Truco seguro para evitar que new Date('YYYY-MM-DD') se convierta a UTC y retroceda un día en zonas horarias negativas (GMT-3, GMT-5)
  let d;
  if (typeof dateInput === 'string') {
    // Si viene del input date (YYYY-MM-DD), le añadimos mediodía local para anclarlo
    d = new Date(`${dateInput}T12:00:00`);
  } else {
    d = new Date(dateInput);
  }

  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  d.setDate(diff);

  // Formatear manualmente a YYYY-MM-DD basándonos en la fecha local, no en toISOString()(UTC)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
};

export const getFechasPlan = (fechaInicio: string) => {
  // Asume que fechaInicio siempre llega validada como Lunes (YYYY-MM-DD)
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(inicio.getTime());
  fin.setDate(fin.getDate() + 6); // Suma 6 días para ser Domingo
  fin.setHours(23, 59, 59, 999);
  
  return { inicio, fin };
};

export const evalEstadoLMS = (fechaInicio: string) => {
  const { inicio, fin } = getFechasPlan(fechaInicio);
  const now = new Date();
  
  if (now < inicio) return 'future';
  if (now > fin) return 'expired';
  return 'active';
};

// ─── SERVICIO ───
export const planService = {
  // 0. Método para el Tutor: Listar absolutamente todos los planes
  async getAllPlanesSemana(alumnoId: string): Promise<PlanSemanal[]> {
    if (LS_MODE) {
      const planes = getLocalPlanes().filter(p => p.alumno_id === alumnoId)
        .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());
      
      const tareasMap = getLocalTareasPlan().reduce((acc, t) => {
        if (!t.plan_semanal_id) return acc;
        if (!acc[t.plan_semanal_id]) acc[t.plan_semanal_id] = [];
        acc[t.plan_semanal_id].push(t);
        return acc;
      }, {} as Record<string, TareaPlanificada[]>);

      return planes.map(p => ({ ...p, tareas: tareasMap[p.id] || [] }));
    }

    const { data, error } = await supabase
      .from('plan_semanal')
      .select('*, tarea_planificada(*)')
      .eq('alumno_id', alumnoId)
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      tareas: d.tarea_planificada || []
    }));
  },

  // 0.5. Método para el Tutor: Obtener tareas en revisión
  async getTareasEnRevision(tutorId: string): Promise<TareaPlanificada[]> {
    if (LS_MODE) {
      const dbTareas = getLocalTareasPlan();
      return dbTareas.filter(t => t.estado === 'en_revision');
    }

    const { data, error } = await supabase
      .from('tarea_planificada')
      .select('*, plan_semanal!inner(tutor_id)')
      .eq('estado', 'en_revision')
      .eq('plan_semanal.tutor_id', tutorId);

    if (error) throw error;
    // Map tasks to exclude the joined plan_semanal object or flatten if needed. We'll just return it.
    return data || [];
  },

  async getTareasPlanificadasAlumno(alumnoId: string, tipo?: string) {
    if (LS_MODE) {
      const all = getLocalTareasPlan();
      return all.filter(t => t.alumno_id === alumnoId && (!tipo || t.tipo_modulo === tipo));
    }

    let query = supabase.from('tarea_planificada').select('*').eq('alumno_id', alumnoId);
    if (tipo) query = query.eq('tipo_modulo', tipo);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as TareaPlanificada[];
  },

  async getAllPlanesAlumno(alumnoId: string): Promise<PlanSemanal[]> {
    if (LS_MODE) {
      return getLocalPlanes().filter(p => p.alumno_id === alumnoId)
        .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());
    }

    const { data, error } = await supabase
      .from('plan_semanal')
      .select('*, tarea_planificada(*)')
      .eq('alumno_id', alumnoId)
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      tareas: d.tarea_planificada || []
    }));
  },

  // 0.7. Obtener el logro del día desde el servidor
  async getHistorialDiarioDia(planId: string, diaSemana: number) {
    if (LS_MODE) return null; // No disponible en local
    const { data, error } = await supabase
      .from('historial_diario')
      .select('nivel_alcanzado, porcentaje_logrado')
      .eq('plan_semanal_id', planId)
      .eq('dia_semana', diaSemana)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // 1. Obtiene el plan de la semana basado en una fecha, o la actual por defecto
  async getPlanSemanalActivo(alumnoId: string, specificDate?: string): Promise<PlanSemanal | null> {
    const targetDate = specificDate ? new Date(specificDate) : new Date();
    const monday = getMonday(targetDate);

    if (LS_MODE) {
      const planes = getLocalPlanes();
      const plan = planes.find(p => p.alumno_id === alumnoId && p.fecha_inicio === monday);
      if (!plan) return null;
      
      const tareas = getLocalTareasPlan().filter(t => t.plan_semanal_id === plan.id);
      return { ...plan, tareas };
    }

    // Busqueda Supabase
    const { data, error } = await supabase
      .from('plan_semanal')
      .select('*, tarea_planificada(*)')
      .eq('alumno_id', alumnoId)
      .eq('fecha_inicio', monday)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // 116 = no rows returned
    
    if (data) {
      return {
        ...data,
        tareas: data.tarea_planificada || []
      };
    }
    return null;
  },

  async createPlanSemanal(plan: Partial<PlanSemanal>): Promise<PlanSemanal> {
    const forcedMonday = getMonday(plan.fecha_inicio || new Date());

    if (LS_MODE) {
      // Prevención de Duplicados en LocalStorage
      const existing = getLocalPlanes().find(p => p.alumno_id === plan.alumno_id && p.fecha_inicio === forcedMonday);
      if (existing) throw new Error("duplicate");

      const newPlan: PlanSemanal = {
        id: Math.random().toString(36).substr(2, 9),
        fecha_inicio: forcedMonday,
        tutor_id: plan.tutor_id!,
        alumno_id: plan.alumno_id!,
        meta_puntos_total: plan.meta_puntos_total || 0,
        recompensa_nombre: plan.recompensa_nombre || '',
        recompensa_detalle: plan.recompensa_detalle || '',
        esta_lograda: false,
        created_at: new Date().toISOString()
      };
      saveLocalPlanes([...getLocalPlanes(), newPlan]);
      return newPlan;
    }

    const payload = { ...plan, fecha_inicio: forcedMonday };
    const { data, error } = await supabase.from('plan_semanal').insert([payload]).select().single();
    if (error) {
      if (error.code === '23505') throw new Error("duplicate");
      throw error;
    }
    return { ...data, tareas: [] };
  },

  async cloneTaskToPlan(
    planId: string, 
    moduloId: string, 
    tipoModulo: string, 
    alumnoId: string, 
    days: number[], 
    puntos: number = 10,
    horaAsignada: string | null = null
  ) {
    const payload = days.map(d => ({
      plan_semanal_id: planId,
      dia_semana: d,
      puntos_valor: puntos,
      estado: "pendiente" as const,
      tipo_modulo: tipoModulo,
      modulo_id: moduloId,
      alumno_id: alumnoId,
      hora_asignada: horaAsignada
    }));

    if (LS_MODE) {
      const all = getLocalTareasPlan();
      const withIds = payload.map(p => ({ ...p, id: Math.random().toString(36).substr(2, 9), orden_visual: 0 }));
      saveLocalTareasPlan([...all, ...withIds]);
      return true;
    }

    const { error } = await supabase.from('tarea_planificada').insert(payload);
    if (error) throw error;
    return true;
  },

  async assignAssessmentToPlan(planId: string, templateId: string, alumnoId: string, puntos: number = 20) {
    if (LS_MODE) {
       const all = getLocalTareasPlan();
       const newTask: TareaPlanificada = {
         id: Math.random().toString(36).substr(2, 9),
         plan_semanal_id: planId,
         dia_semana: null as any, 
         puntos_valor: puntos,
         estado: "pendiente",
         tipo_modulo: "assessment",
         modulo_id: templateId,
         alumno_id: alumnoId,
         orden_visual: 0
       };
       saveLocalTareasPlan([...all, newTask]);
       return true;
    }

    const { error } = await supabase.from('tarea_planificada').insert([{
      plan_semanal_id: planId,
      dia_semana: null, 
      puntos_valor: puntos,
      estado: "pendiente",
      tipo_modulo: "assessment",
      modulo_id: templateId,
      alumno_id: alumnoId,
      hora_asignada: null
    }]);
    if (error) throw error;
    return true;
  },

  async updateTareaPlanificada(id: string, updates: Partial<TareaPlanificada> & { metadata?: any }) {
    if (LS_MODE) {
      const all = getLocalTareasPlan();
      const idx = all.findIndex(t => t.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        saveLocalTareasPlan(all);
        return all[idx];
      }
      throw new Error("Tarea no encontrada");
    }

    const { data, error } = await supabase
      .from('tarea_planificada')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTareaPlanificada(id: string) {
    if (LS_MODE) {
      const all = getLocalTareasPlan();
      saveLocalTareasPlan(all.filter(t => t.id !== id));
      return;
    }
    const { error } = await supabase.from('tarea_planificada').delete().eq('id', id);
    if (error) throw error;
  },

  async updateEstadoTareaPlanificada(tareaId: string, nuevoEstado: "pendiente" | "en_revision" | "completada") {
    const ts = nuevoEstado === 'completada' ? new Date().toISOString() : null;
    
    // Verificar caducidad antes de guardar
    if (!LS_MODE) {
       const { data: currentTarea } = await supabase.from('tarea_planificada').select('plan_semanal(fecha_inicio)').eq('id', tareaId).single();
       if (currentTarea && (currentTarea as any).plan_semanal) {
          const status = evalEstadoLMS((currentTarea as any).plan_semanal.fecha_inicio);
          if (status === 'expired') {
            throw new Error("Este plan ya caducó. No puedes modificar tareas de semanas pasadas.");
          }
       }
    }

    if (LS_MODE) {
      const tasks = getLocalTareasPlan();
      const idx = tasks.findIndex(t => t.id === tareaId);
      if (idx !== -1) {
        tasks[idx].estado = nuevoEstado;
        tasks[idx].fecha_completado = ts || undefined;
        saveLocalTareasPlan(tasks);
      }
      return true;
    }

    const { error } = await supabase.from('tarea_planificada').update({
      estado: nuevoEstado,
      fecha_completado: ts
    }).eq('id', tareaId);

    if (error) throw error;
    return true;
  },

  async checkRewardUnlock(planId: string) {
    if (LS_MODE) {
      const planes = getLocalPlanes();
      const pIdx = planes.findIndex(p => p.id === planId);
      if (pIdx === -1) return false;

      const tareas = getLocalTareasPlan().filter(t => t.plan_semanal_id === planId && t.estado === 'completada');
      const points = tareas.reduce((acc, t) => acc + t.puntos_valor, 0);

      const achieved = points >= planes[pIdx].meta_puntos_total;
      
      if (planes[pIdx].esta_lograda !== achieved) {
         planes[pIdx].esta_lograda = achieved;
         saveLocalPlanes(planes);
      }
      return achieved;
    }

    // Corrección: usar estado='completada' en lugar de columna booleana inexistente
    const { data: tareas } = await supabase.from('tarea_planificada')
       .select('puntos_valor')
       .eq('plan_semanal_id', planId)
       .eq('estado', 'completada');
       
    const { data: plan } = await supabase.from('plan_semanal')
       .select('meta_puntos_total, esta_lograda')
       .eq('id', planId)
       .single();

    if (!plan || !tareas) return false;

    const points = (tareas as any[]).reduce((a: number, b: any) => a + (b.puntos_valor || 0), 0);
    const isUnlocked = points >= plan.meta_puntos_total;
    
    if (plan.esta_lograda !== isUnlocked) {
      await supabase.from('plan_semanal').update({ esta_lograda: isUnlocked }).eq('id', planId);
    }

    return isUnlocked;
  },

  async deletePlanSemanal(planId: string) {
    if (LS_MODE) {
      const planes = getLocalPlanes().filter(p => p.id !== planId);
      const tasks = getLocalTareasPlan().filter(t => t.plan_semanal_id !== planId);
      saveLocalPlanes(planes);
      saveLocalTareasPlan(tasks);
      return true;
    }

    const { error } = await supabase.from('plan_semanal').delete().eq('id', planId);
    if (error) throw error;
    return true;
  },

  // 10. Gestión de Jornadas
  async getJornadaConfig() {
    if (LS_MODE) return { rango_manana: '00:00-11:59', rango_tarde: '12:00-17:59', rango_noche: '18:00-23:59' };
    // Use API route when in browser (bypasses RLS via service role key on the server)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/jornadas');
        if (res.ok) return await res.json();
      } catch (e) { /* fall through to direct query */ }
    }
    const { data, error } = await supabase.from('configuracion_jornadas').select('*').limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data || { rango_manana: '00:00-11:59', rango_tarde: '12:00-17:59', rango_noche: '18:00-23:59' };
  },

  async updateJornadaConfig(updates: any) {
    if (LS_MODE) return true;
    const { data: existing } = await supabase.from('configuracion_jornadas').select('id').single();
    
    if (existing) {
      const { error } = await supabase.from('configuracion_jornadas').update(updates).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('configuracion_jornadas').insert([updates]);
      if (error) throw error;
    }
    return true;
  }
};
