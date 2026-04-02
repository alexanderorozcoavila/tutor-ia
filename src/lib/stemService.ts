import { supabase, isSupabaseConfigured } from './supabase';
import { StemKnowledgeItem } from './taskService';

const LS_KEY = 'ia_tutor_stem_kb';

const getLocalStemItems = (): StemKnowledgeItem[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(LS_KEY);
  return saved ? JSON.parse(saved) : [];
};

export const stemService = {
  async getKnowledgeBaseItems(): Promise<StemKnowledgeItem[]> {
    if (!isSupabaseConfigured) {
      return getLocalStemItems();
    }
    const { data, error } = await supabase
      .from('stem_knowledge_base')
      .select('*')
      .order('category', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as StemKnowledgeItem[];
  },

  async getKnowledgeBaseItem(id: string): Promise<StemKnowledgeItem | null> {
    if (!isSupabaseConfigured) {
      return getLocalStemItems().find(item => item.id === id) || null;
    }
    const { data, error } = await supabase
      .from('stem_knowledge_base')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as StemKnowledgeItem | null;
  }
};
