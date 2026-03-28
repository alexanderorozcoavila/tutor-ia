import { supabase, isSupabaseConfigured } from './supabase';
import { AssessmentQuestion } from './taskService';

// Interfaces Básicas
export interface Subject {
  id: string;
  name: string;
  created_at?: string;
}

export interface Objective {
  id: string;
  subject_id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface AssessmentTemplate {
  id: string;
  objective_id: string;
  title: string;
  time_limit_seconds: number;
  questions: AssessmentQuestion[];
  created_by?: string;
  created_at?: string;
}

const dbWarning = "Conexión a base de datos no configurada.";

export const lmsService = {
  // == MATERIAS (SUBJECTS) ==
  async getAllSubjects(): Promise<Subject[]> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { data, error } = await supabase.from('subjects').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async createSubject(name: string): Promise<Subject> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { data, error } = await supabase.from('subjects').insert([{ name }]).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSubject(id: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw error;
  },

  // == ASIGNACIÓN DE MATERIAS A TUTORES ==
  async assignSubjectsToTutor(tutorId: string, subjectIds: string[]): Promise<void> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    // Eliminar previas
    await supabase.from('tutor_subjects').delete().eq('tutor_id', tutorId);
    
    // Insertar nuevas
    if (subjectIds.length > 0) {
      const inserts = subjectIds.map(sid => ({ tutor_id: tutorId, subject_id: sid }));
      const { error } = await supabase.from('tutor_subjects').insert(inserts);
      if (error) throw error;
    }
  },

  async getTutorSubjects(tutorId: string): Promise<Subject[]> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    // Join
    const { data, error } = await supabase
      .from('tutor_subjects')
      .select('subjects(*)')
      .eq('tutor_id', tutorId);
    if (error) throw error;
    return data.map((d: any) => d.subjects).sort((a: any, b: any) => a.name.localeCompare(b.name));
  },

  // == OBJETIVOS ==
  async getObjectives(subjectId: string): Promise<Objective[]> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { data, error } = await supabase.from('objectives').select('*').eq('subject_id', subjectId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createObjective(objective: Omit<Objective, 'id'|'created_at'>): Promise<Objective> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { data, error } = await supabase.from('objectives').insert([objective]).select().single();
    if (error) throw error;
    return data;
  },

  async deleteObjective(id: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { error } = await supabase.from('objectives').delete().eq('id', id);
    if (error) throw error;
  },

  // == PLANTILLAS DE EVALUACIÓN (TEMPLATES) ==
  async getAssessmentTemplates(objectiveId: string): Promise<AssessmentTemplate[]> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { data, error } = await supabase.from('assessment_templates').select('*').eq('objective_id', objectiveId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createAssessmentTemplate(template: Omit<AssessmentTemplate, 'id'|'created_at'>): Promise<AssessmentTemplate> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { data, error } = await supabase.from('assessment_templates').insert([template]).select().single();
    if (error) throw error;
    return data;
  },

  async deleteAssessmentTemplate(id: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error(dbWarning);
    const { error } = await supabase.from('assessment_templates').delete().eq('id', id);
    if (error) throw error;
  }
};
