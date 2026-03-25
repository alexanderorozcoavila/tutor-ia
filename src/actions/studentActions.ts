"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Helper para instanciar cliente de supabase en server actions
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Unhandled
          }
        },
      },
    }
  )
}

export async function updateStudentXP(studentId: string, amount: number) {
  const supabase = await createClient();
  
  // Realiza query RPC si existiera, o usamos una update simple 
  // Ojo con concurrencia: lo ideal es un RPC `increment_xp` en la DB
  const { data: student, error: getErr } = await supabase
    .from('students')
    .select('xp_points')
    .eq('id', studentId)
    .single();
    
  if (getErr || !student) throw new Error("Estudiante no encontrado");

  const newXp = student.xp_points + amount;

  const { error: setErr } = await supabase
    .from('students')
    .update({ xp_points: newXp })
    .eq('id', studentId);

  if (setErr) throw new Error("No se pudo actualizar la XP");
  
  return { newXp };
}

export async function getTutorDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("No autorizado");
  }

  // Traer estudiantes del tutor
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('tutor_id', user.id);

  return students || [];
}
