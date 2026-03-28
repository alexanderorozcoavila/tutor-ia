import { supabase, isSupabaseConfigured } from './supabase';

export interface TareaPlanificada {
  id: string;
  plan_semanal_id?: string;
  dia_semana: number;
  puntos_valor: number;
  completada: boolean;
  fecha_completado?: string;
  tipo_modulo: string;
  modulo_id: string;
  alumno_id: string;
  orden_visual: number;
  
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
export const getMonday = (d: Date) => {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

// ─── SERVICIO ───
export const planService = {
  // 1. Obtiene o crea el plan de la semana si no existe, o retorna el actual
  async getPlanSemanalActivo(alumnoId: string, tutorId?: string): Promise<PlanSemanal | null> {
    const monday = getMonday(new Date());

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
    return data || null;
  },

  async createPlanSemanal(plan: Partial<PlanSemanal>): Promise<PlanSemanal> {
    if (LS_MODE) {
      const newPlan: PlanSemanal = {
        id: Math.random().toString(36).substr(2, 9),
        fecha_inicio: plan.fecha_inicio || getMonday(new Date()),
        tutor_id: plan.tutor_id!,
        alumno_id: plan.alumno_id!,
        meta_puntos_total: plan.meta_puntos_total || 0,
        recompensa_nombre: plan.recompensa_nombre || '',
        recompensa_detalle: plan.recompensa_detalle,
        esta_lograda: false,
        created_at: new Date().toISOString()
      };
      saveLocalPlanes([...getLocalPlanes(), newPlan]);
      return newPlan;
    }

    const payload = {
      ...plan,
      fecha_inicio: plan.fecha_inicio || getMonday(new Date())
    };

    const { data, error } = await supabase.from('plan_semanal').insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async cloneTaskToPlan(planId: string, moduloId: string, tipoModulo: string, alumnoId: string, days: number[], puntos: number = 10) {
    const payload = days.map(d => ({
      plan_semanal_id: planId,
      dia_semana: d,
      puntos_valor: puntos,
      completada: false,
      tipo_modulo: tipoModulo,
      modulo_id: moduloId,
      alumno_id: alumnoId
    }));

    if (LS_MODE) {
      const all = getLocalTareasPlan();
      const withIds = payload.map(p => ({ ...p, id: Math.random().toString(36).substr(2, 9) }));
      saveLocalTareasPlan([...all, ...withIds]);
      return true;
    }

    const { error } = await supabase.from('tarea_planificada').insert(payload);
    if (error) throw error;
    return true;
  },

  async completeTareaPlanificada(tareaId: string, newValue: boolean = true) {
    if (LS_MODE) {
      const tasks = getLocalTareasPlan();
      const idx = tasks.findIndex(t => t.id === tareaId);
      if (idx !== -1) {
        tasks[idx].completada = newValue;
        tasks[idx].fecha_completado = newValue ? new Date().toISOString() : undefined;
        saveLocalTareasPlan(tasks);
      }
      return true;
    }

    const { error } = await supabase.from('tarea_planificada').update({
      completada: newValue,
      fecha_completado: newValue ? new Date().toISOString() : null
    }).eq('id', tareaId);

    if (error) throw error;
    return true;
  },

  async checkRewardUnlock(planId: string) {
    if (LS_MODE) {
      const planes = getLocalPlanes();
      const pIdx = planes.findIndex(p => p.id === planId);
      if (pIdx === -1) return false;

      const tareas = getLocalTareasPlan().filter(t => t.plan_semanal_id === planId && t.completada);
      const points = tareas.reduce((acc, t) => acc + t.puntos_valor, 0);

      const achieved = points >= planes[pIdx].meta_puntos_total;
      
      if (planes[pIdx].esta_lograda !== achieved) {
         planes[pIdx].esta_lograda = achieved;
         saveLocalPlanes(planes);
      }
      return achieved;
    }

    // Usaremos un fetch local manual para asegurar soporte multiplataforma en Supabase.
    // Lo ideal seria RPC pero fetch + local match es rápido
    const { data: tareas } = await supabase.from('tarea_planificada')
       .select('puntos_valor, completada')
       .eq('plan_semanal_id', planId)
       .eq('completada', true);
       
    const { data: plan } = await supabase.from('plan_semanal')
       .select('meta_puntos_total, esta_lograda')
       .eq('id', planId)
       .single();

    if (!plan || !tareas) return false;

    const points = tareas.reduce((a, b) => a + b.puntos_valor, 0);
    const isUnlocked = points >= plan.meta_puntos_total;
    
    if (plan.esta_lograda !== isUnlocked) {
      await supabase.from('plan_semanal').update({ esta_lograda: isUnlocked }).eq('id', planId);
    }

    return isUnlocked;
  }
};
