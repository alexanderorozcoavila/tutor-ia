import { supabase, isSupabaseConfigured } from './supabase';

export type TaskType = 'dictation' | 'domestic' | 'reading' | 'assessment' | 'stem';
export type TaskStatus = 'pending' | 'completed' | 'failed' | 'approved' | 'rejected';

export interface AssessmentQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Task {
  id: string;
  created_at: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  score: number;
  reason_not_done?: string;
  assigned_to?: string;
  created_by?: string;
  supported_devices?: string[];
  image_url?: string;
  metadata: {
    dictation_text?: string;
    reading_text?: string;
    reading_level?: number;
    questions?: AssessmentQuestion[];
    assessment_time_limit?: number; // 0 o undefined = sin limite
    config?: {
      mode: 'LIBRE' | 'TEMPORIZADOR';
      timeLimit: number;
      alertInterval: number;
      enableAlerts: boolean;
      hideText?: boolean;
    };
    [key: string]: any;
  };
}

export interface StemKnowledgeItem {
  id: string;
  category: string;
  title: string;
  content_html: string;
  interactive_type: string;
  metadata: any;
  created_at: string;
}

const LS_KEY = 'ia_tutor_tasks';

const getLocalTasks = (): Task[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(LS_KEY);
  return saved ? JSON.parse(saved) : [];
};

const saveLocalTasks = (tasks: Task[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
};

export const taskService = {
  async getTasks() {
    if (!isSupabaseConfigured) {
      console.log("Usando LocalStorage (Supabase no configurado)");
      return getLocalTasks();
    }
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Task[];
  },

  async createTask(task: Partial<Task>) {
    if (!isSupabaseConfigured) {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        title: task.title || '',
        description: task.description,
        type: task.type || 'dictation',
        status: 'pending',
        score: 0,
        metadata: task.metadata || {},
        ...task
      } as Task;
      
      const tasks = getLocalTasks();
      saveLocalTasks([newTask, ...tasks]);
      return newTask;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select();
    
    if (error) throw error;
    return data[0] as Task;
  },

  async updateTask(id: string, updates: Partial<Task>) {
    if (!isSupabaseConfigured) {
      const tasks = getLocalTasks();
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        saveLocalTasks(tasks);
        return tasks[index];
      }
      throw new Error("Tarea no encontrada");
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data[0] as Task;
  },

  async deleteTask(id: string) {
    if (!isSupabaseConfigured) {
      const tasks = getLocalTasks();
      saveLocalTasks(tasks.filter(t => t.id !== id));
      return;
    }
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  }
};
