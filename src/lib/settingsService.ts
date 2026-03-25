import { supabase, isSupabaseConfigured } from './supabase';

export interface SystemSettings {
  attention_message: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  attention_message: "¡Hola! ¿Cómo vas? Sigamos juntos."
};

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

    const { data, error } = await supabase
      .from('system_settings')
      .upsert([settings])
      .select();
    
    if (error) throw error;
    return data[0] as SystemSettings;
  }
};
