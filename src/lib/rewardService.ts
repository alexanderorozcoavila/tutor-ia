import { supabase, isSupabaseConfigured } from './supabase';

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface Recompensa {
  id: string;
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  imagen_data?: string; // base64
  imagen_mime?: string;
  icono_emoji?: string;
  url?: string;
  comando?: string;
  tipo: 'url' | 'comando';
  created_by?: string;
  created_at: string;
}

export interface RecompensaDiaria {
  id: string;
  plan_semanal_id: string;
  recompensa_id?: string;
  dia_semana: number;        // 0=Dom, 1=Lun...6=Sab
  nivel_requerido: number;   // 1=80%, 2=90%, 3=100%
  minutos_disponibles: number;
  created_at: string;
  // JOIN opcional
  recompensa?: Recompensa;
}

export interface UsoRecompensa {
  id: string;
  recompensa_diaria_id: string;
  alumno_id: string;
  iniciado_at: string;
  finalizado_at?: string;
  minutos_usados: number;
  completado: boolean;
}

export interface ControlDispositivo {
  id: string;
  alumno_id: string;
  recompensa_id?: string;
  uso_recompensa_id?: string;
  minutos_disponibles: number;
  estado: 'bloqueado' | 'activo';
  updated_at: string;
}

// ─── FALLBACK LOCAL (sin Supabase) ─────────────────────────────────────────────
const LS_MODE = !isSupabaseConfigured;
const LS_RECOMPENSAS = 'ia_tutor_recompensas';

const getLocalRecompensas = (): Recompensa[] => {
  if (typeof window === 'undefined') return [];
  const val = localStorage.getItem(LS_RECOMPENSAS);
  return val ? JSON.parse(val) : [];
};
const saveLocalRecompensas = (data: Recompensa[]) => {
  if (typeof window !== 'undefined') localStorage.setItem(LS_RECOMPENSAS, JSON.stringify(data));
};

// ─── SERVICIO ─────────────────────────────────────────────────────────────────
export const rewardService = {

  // ── Catálogo de Recompensas (Admin) ─────────────────────────────────────────

  async getAllRecompensas(): Promise<Recompensa[]> {
    if (LS_MODE) return getLocalRecompensas();
    const { data, error } = await supabase
      .from('recompensas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createRecompensa(payload: Omit<Recompensa, 'id' | 'created_at'>): Promise<Recompensa> {
    if (LS_MODE) {
      const newR: Recompensa = {
        ...payload,
        id: Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
      };
      saveLocalRecompensas([newR, ...getLocalRecompensas()]);
      return newR;
    }
    const { data, error } = await supabase.from('recompensas').insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async updateRecompensa(id: string, updates: Partial<Recompensa>): Promise<Recompensa> {
    if (LS_MODE) {
      const all = getLocalRecompensas();
      const idx = all.findIndex(r => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        saveLocalRecompensas(all);
        return all[idx];
      }
      throw new Error('Recompensa no encontrada');
    }
    const { data, error } = await supabase.from('recompensas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteRecompensa(id: string): Promise<void> {
    if (LS_MODE) {
      saveLocalRecompensas(getLocalRecompensas().filter(r => r.id !== id));
      return;
    }
    const { error } = await supabase.from('recompensas').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Asignación por Día/Nivel (Tutor) ─────────────────────────────────────────

  /**
   * Obtiene todas las recompensas asignadas a los días de un plan.
   * Retorna agrupado por dia_semana.
   */
  async getRecompensasDiarias(planId: string): Promise<RecompensaDiaria[]> {
    if (LS_MODE) return [];
    const { data, error } = await supabase
      .from('recompensa_diaria')
      .select('*, recompensa:recompensas(*)')
      .eq('plan_semanal_id', planId)
      .order('dia_semana')
      .order('nivel_requerido');
    if (error) throw error;
    return data || [];
  },

  /**
   * Obtiene la recompensa de un día específico para un nivel dado.
   */
  async getRecompensaDiaria(planId: string, diaSemana: number, nivelRequerido: number): Promise<RecompensaDiaria | null> {
    if (LS_MODE) return null;
    const { data, error } = await supabase
      .from('recompensa_diaria')
      .select('*, recompensa:recompensas(*)')
      .eq('plan_semanal_id', planId)
      .eq('dia_semana', diaSemana)
      .eq('nivel_requerido', nivelRequerido)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  /**
   * Upsert de recompensa para un día/nivel específico.
   * Si recompensaId es null, elimina la asignación.
   */
  async upsertRecompensaDiaria(
    planId: string,
    diaSemana: number,
    nivelRequerido: number,
    recompensaId: string | null,
    minutos: number
  ): Promise<void> {
    if (LS_MODE) return;

    if (recompensaId === null) {
      // Eliminar asignación existente si existe
      await supabase
        .from('recompensa_diaria')
        .delete()
        .eq('plan_semanal_id', planId)
        .eq('dia_semana', diaSemana)
        .eq('nivel_requerido', nivelRequerido);
      return;
    }

    const { error } = await supabase.from('recompensa_diaria').upsert({
      plan_semanal_id: planId,
      recompensa_id: recompensaId,
      dia_semana: diaSemana,
      nivel_requerido: nivelRequerido,
      minutos_disponibles: minutos,
    }, {
      onConflict: 'plan_semanal_id,dia_semana,nivel_requerido'
    });
    if (error) throw error;
  },

  // ── Activación por el Alumno ─────────────────────────────────────────────────

  /**
   * Verifica si una recompensa ya fue usada hoy (UNIQUE constraint).
   */
  async isRecompensaUsada(recompensaDiariaId: string, alumnoId: string): Promise<boolean> {
    if (LS_MODE) return false;
    const { data } = await supabase
      .from('uso_recompensa')
      .select('id')
      .eq('recompensa_diaria_id', recompensaDiariaId)
      .eq('alumno_id', alumnoId)
      .single();
    return !!data;
  },

  /**
   * Devuelve la lista de recompensa_diaria_id que el alumno ya activó hoy.
   * Usado al cargar la pantalla para pre-poblar el estado "ya usado".
   * Incluye tanto los en-curso como los completados para bloquear el botón en ambos casos.
   */
  async getUsosRecompensaHoy(recompensaDiariaIds: string[], alumnoId: string): Promise<string[]> {
    if (LS_MODE || recompensaDiariaIds.length === 0) return [];
    const { data } = await supabase
      .from('uso_recompensa')
      .select('recompensa_diaria_id')
      .in('recompensa_diaria_id', recompensaDiariaIds)
      .eq('alumno_id', alumnoId);
    return (data || []).map((r: any) => r.recompensa_diaria_id);
  },

  /**
   * Activa la recompensa: crea uso_recompensa y señaliza control_dispositivo.
   * Usa la función SQL activar_recompensa para atomicidad.
   */
  async activarRecompensa(
    recompensaDiariaId: string,
    alumnoId: string
  ): Promise<{ uso_id: string; recompensa_nombre: string; minutos: number }> {
    if (LS_MODE) throw new Error('No disponible en modo local');

    const hoy = new Date().getDay();
    const { data: rdcheck } = await supabase.from('recompensa_diaria').select('dia_semana').eq('id', recompensaDiariaId).single();
    if (rdcheck && rdcheck.dia_semana !== hoy) {
      throw new Error('Esta recompensa ha caducado. Solo es válida el día en que fue asignada.');
    }

    const { data, error } = await supabase.rpc('activar_recompensa', {
      p_recompensa_diaria_id: recompensaDiariaId,
      p_alumno_id: alumnoId,
    });
    if (error) throw error;
    return data;
  },

  // ── Para el Agente Python (consultas de estado) ──────────────────────────────

  /**
   * El agente lee esto para saber qué hacer.
   */
  async getControlDispositivo(alumnoId: string): Promise<ControlDispositivo | null> {
    if (LS_MODE) return null;
    const { data, error } = await supabase
      .from('control_dispositivo')
      .select('*, recompensa:recompensas(*)')
      .eq('alumno_id', alumnoId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  /**
   * El agente llama esto cuando finaliza el tiempo de la recompensa.
   */
  async finalizarRecompensa(usoRecompensaId: string, alumnoId: string, minutosUsados: number): Promise<void> {
    if (LS_MODE) return;

    // Actualizar el registro de uso
    const { error: useError } = await supabase
      .from('uso_recompensa')
      .update({
        finalizado_at: new Date().toISOString(),
        minutos_usados: minutosUsados,
        completado: true,
      })
      .eq('id', usoRecompensaId);
    if (useError) throw useError;

    // Resetear el control del dispositivo
    const { error: ctrlError } = await supabase
      .from('control_dispositivo')
      .update({
        estado: 'bloqueado',
        recompensa_id: null,
        uso_recompensa_id: null,
        minutos_disponibles: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('alumno_id', alumnoId);
    if (ctrlError) throw ctrlError;
  },
};
