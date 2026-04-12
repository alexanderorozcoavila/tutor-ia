'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { TvConfig } from '@/lib/settingsService';

/**
 * Cliente de Supabase con service_role key — solo corre en servidor.
 * Usa las mismas credenciales de .env.local del proyecto.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key);
}

/**
 * Lee la configuración de TV de un alumno.
 * Retorna null si el alumno aún no tiene configuración.
 */
export async function getTvConfigByStudent(
  studentId: string
): Promise<TvConfig | null> {
  if (!studentId) return null;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('tv_config')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    console.error('[tvConfigActions] getTvConfigByStudent error:', error);
    return null;
  }
  return data as TvConfig | null;
}

/**
 * Crea o actualiza la configuración de TV de un alumno.
 * Utiliza upsert con conflicto en student_id (la constraint UNIQUE).
 */
export async function upsertTvConfig(
  config: Partial<TvConfig> & { student_id: string }
): Promise<TvConfig> {
  const supabase = getServiceClient();

  const payload = {
    ...config,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tv_config')
    .upsert([payload], { onConflict: 'student_id' })
    .select()
    .single();

  if (error) {
    console.error('[tvConfigActions] upsertTvConfig error:', error);
    throw new Error(error.message);
  }

  // Notificar a Termux vía NTFY.sh
  try {
    const topic = `iatutor_tv_config_${config.student_id}`;
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('[tvConfigActions] failed to notify ntfy:', err);
    // No interrumpimos el flujo principal si falla NTFY
  }

  return data as TvConfig;
}
