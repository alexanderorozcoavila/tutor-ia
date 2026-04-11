import { supabase, isSupabaseConfigured } from './supabase';

export interface SystemSettings {
  attention_message: string;
  attention_max_minutes?: number;
  notification_sound?: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  attention_message: "¡Hola! ¿Cómo vas? Sigamos juntos."
};
// Defaults for new fields
DEFAULT_SETTINGS.attention_max_minutes = 0;
DEFAULT_SETTINGS.notification_sound = '/sounds/beep.mp3';

const LS_SETTINGS_KEY = 'ia_tutor_system_settings';

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    if (!isSupabaseConfigured) {
      if (typeof window === 'undefined') return DEFAULT_SETTINGS;
      const saved = localStorage.getItem(LS_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();
    
    if (error || !data) {
      // Si no existe, intentar crear con default (en un entorno real esto se haría con migraciones)
      return DEFAULT_SETTINGS;
    }
    return data as SystemSettings;
  },

  async updateSettings(settings: Partial<SystemSettings>) {
    if (!isSupabaseConfigured) {
      if (typeof window === 'undefined') return;
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    }

    // Intentar upsert directo; si falla por columnas nuevas ausentes, hacer fallback seguro
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert([settings])
        .select();
      if (error) throw error;
      return data[0] as SystemSettings;
    } catch (err: any) {
      // Detectar si el error es por columna inexistente en la tabla
      const msg = String(err?.message || err);
      if (/could not find the/i.test(msg) || /column .* of table/i.test(msg)) {
        // Cargar la fila actual para conocer las columnas disponibles
        try {
          const { data: currentRow, error: selErr } = await supabase.from('system_settings').select('*').maybeSingle();
          if (selErr) throw selErr;

          const current = (currentRow as any) || {};
          const allowedKeys = Object.keys(current);

          // Construir payload con solo claves permitidas
          const allowedPayload: any = {};
          Object.keys(settings).forEach(k => {
            if (allowedKeys.includes(k)) allowedPayload[k] = (settings as any)[k];
          });

          // Ejecutar update solo con las claves permitidas
          if (Object.keys(allowedPayload).length > 0) {
            const matchId = (current as any).id;
            if (matchId) {
              const { data: updated, error: upErr } = await supabase.from('system_settings').update(allowedPayload).eq('id', matchId).select().maybeSingle();
              if (upErr) throw upErr;
              // Guardar el resto en localStorage para no perder cambios
              const remaining: any = {};
              Object.keys(settings).forEach(k => { if (!allowedKeys.includes(k)) remaining[k] = (settings as any)[k]; });
              if (typeof window !== 'undefined' && Object.keys(remaining).length > 0) {
                const cached = localStorage.getItem(LS_SETTINGS_KEY);
                const base = cached ? JSON.parse(cached) : (current as any) || {};
                localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify({ ...base, ...remaining }));
              }
              return { ...(current as any), ...(allowedPayload as any) } as SystemSettings;
            }
          }

          // Si no hay claves permitidas, guardar todo en localStorage como fallback y avisar
          if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(LS_SETTINGS_KEY);
            const base = cached ? JSON.parse(cached) : (current as any) || {};
            const updated = { ...base, ...settings };
            localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(updated));
            return updated as SystemSettings;
          }
        } catch (innerErr) {
          // Si falla el fallback, re-lanzar el error original
          throw err;
        }
      }

      // Si el error no es por columnas, volver a lanzar
      throw err;
    }
  }
};

// ============================================================
// Control Parental Smart TV
// ============================================================

export interface TvConfig {
  id?: string;
  student_id: string;
  device_ip: string;
  force_power_off: boolean;
  restricted_start_time: string | null; // "HH:MM:SS"
  restricted_end_time: string | null;   // "HH:MM:SS"
  is_active: boolean;
  updated_at?: string;
  updated_by?: string;
}

const TV_CONFIG_LS_KEY = 'ia_tutor_tv_config';

export const tvConfigService = {
  /** Lee la configuración de TV de un alumno específico */
  async getConfigByStudent(studentId: string): Promise<TvConfig | null> {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(`${TV_CONFIG_LS_KEY}_${studentId}`);
      return saved ? JSON.parse(saved) : null;
    }

    const { data, error } = await supabase
      .from('tv_config')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error('[tvConfigService] getConfigByStudent error:', error);
      return null;
    }
    return data as TvConfig | null;
  },

  /** Crea o actualiza la configuración de TV de un alumno (upsert por student_id) */
  async upsertConfig(
    config: Partial<TvConfig> & { student_id: string }
  ): Promise<TvConfig> {
    const payload = {
      ...config,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      const existing = await this.getConfigByStudent(config.student_id);
      const updated = { ...existing, ...payload } as TvConfig;
      localStorage.setItem(
        `${TV_CONFIG_LS_KEY}_${config.student_id}`,
        JSON.stringify(updated)
      );
      return updated;
    }

    const { data, error } = await supabase
      .from('tv_config')
      .upsert([payload], { onConflict: 'student_id' })
      .select()
      .single();

    if (error) throw error;
    return data as TvConfig;
  },
};

