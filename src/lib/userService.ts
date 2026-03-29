import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'admin' | 'tutor' | 'student';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password?: string;
  created_by?: string;
  theme_id?: string;
  theme?: {
    slug: string;
    config: any;
  };
}

export interface TutorStudentRelation {
  tutor_id: string;
  student_id: string;
}

const LS_USERS_KEY = 'ia_tutor_users';
const LS_RELATIONS_KEY = 'ia_tutor_relations';
const DEFAULT_ADMIN: User = {
  id: 'admin-id',
  username: 'admin',
  password: 'admin123',
  role: 'admin'
};

const getLocalUsers = (): User[] => {
  if (typeof window === 'undefined') return [DEFAULT_ADMIN];
  const saved = localStorage.getItem(LS_USERS_KEY);
  const users = saved ? JSON.parse(saved) : [];
  // Asegurar que el admin siempre exista
  if (!users.find((u: User) => u.username === 'admin')) {
    users.push(DEFAULT_ADMIN);
  }
  return users;
};

const saveLocalUsers = (users: User[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
};

const getLocalRelations = (): TutorStudentRelation[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(LS_RELATIONS_KEY);
  return saved ? JSON.parse(saved) : [];
};

const saveLocalRelations = (relations: TutorStudentRelation[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_RELATIONS_KEY, JSON.stringify(relations));
};

export const userService = {
  // ... (login stays same)
  async login(username: string, password: string): Promise<User | null> {
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const user = users.find(u => u.username === username && u.password === password);
      return user || null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*, theme:theme_id(slug, config)')
      .eq('username', username)
      .eq('password', password)
      .single();
    
    if (error) return null;
    const user = data as User;
    
    if (user && !isSupabaseConfigured && user.theme_id) {
      const themes = await this.getAvailableThemes();
      const theme = themes.find(t => t.id === user.theme_id);
      if (theme) user.theme = { slug: theme.slug, config: theme.config };
    }
    
    return user;
  },

  async getUserProfile(id: string): Promise<User | null> {
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const user = users.find(u => u.id === id);
      if (user && user.theme_id) {
        const themes = await this.getAvailableThemes();
        const theme = themes.find(t => t.id === user.theme_id);
        if (theme) user.theme = { slug: theme.slug, config: theme.config };
      }
      return user || null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*, theme:theme_id(slug, config)')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data as User;
  },

  async createUser(user: Partial<User>) {
    let newUser: User;
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      if (users.find(u => u.username === user.username)) {
        throw new Error("El nombre de usuario ya existe");
      }
      newUser = {
        id: Math.random().toString(36).substr(2, 9),
        username: user.username || '',
        password: user.password || '123456',
        role: user.role || 'student',
        created_by: user.created_by,
        theme_id: user.theme_id
      };
      saveLocalUsers([...users, newUser]);
      
      // Si un tutor crea un alumno, vincularlo automáticamente
      if (user.role === 'student' && user.created_by) {
        const relations = getLocalRelations();
        relations.push({ tutor_id: user.created_by, student_id: newUser.id });
        saveLocalRelations(relations);
      }
    } else {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          username: user.username,
          password: user.password,
          role: user.role,
          created_by: user.created_by,
          theme_id: user.theme_id
        }])
        .select();
      
      if (error) throw error;
      newUser = data[0] as User;

      // Si un tutor crea un alumno, vincularlo automáticamente en Supabase
      if (user.role === 'student' && user.created_by) {
        await supabase.from('tutor_students').insert([{
          tutor_id: user.created_by,
          student_id: newUser.id
        }]);
      }
    }
    return newUser;
  },

  async getStudentsForTutor(tutorId: string) {
    if (!isSupabaseConfigured) {
      const relations = getLocalRelations().filter(r => r.tutor_id === tutorId);
      const studentIds = relations.map(r => r.student_id);
      return getLocalUsers().filter(u => studentIds.includes(u.id));
    }

    const { data, error } = await supabase
      .from('tutor_students')
      .select('student:student_id(*, theme:theme_id(slug, config))')
      .eq('tutor_id', tutorId);
    
    if (error) throw error;
    return (data as any[]).map(d => d.student) as User[];
  },

  async getAvailableThemes() {
    const DEFAULT_THEMES = [
      { id: 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0', name: 'Original', slug: 'base', config: { primary: '#6366f1', secondary: '#818cf8', background: '#fdfbf7', surface: '#ffffff', border: '1px', radius: '1rem', font: 'var(--font-comic-neue)', bgOpacity: 1 } },
      { id: 'b10c202a-1111-4444-8888-000000000001', name: 'Minecraft', slug: 'minecraft', config: { primary: '#2d6a4f', secondary: '#795548', background: '#F0F9FF', surface: '#ffffff', border: '4px', radius: '0px', font: 'var(--font-pixel)', bgOpacity: 0.1 } },
      { id: 'b10c202a-2222-4444-8888-000000000002', name: 'Sonic', slug: 'sonic', config: { primary: '#1d4ed8', secondary: '#fbbf24', background: '#EFF6FF', surface: '#ffffff', border: '2px', radius: '30px', font: 'var(--font-comic)', bgOpacity: 0.05 } },
      { id: 'b10c202a-3333-4444-8888-000000000003', name: 'Marvel', slug: 'marvel', config: { primary: '#dc2626', secondary: '#fbbf24', background: '#ffffff', surface: '#ffffff', border: '3px', radius: '4px', font: 'var(--font-comic)', bgOpacity: 0.03 } }
    ];

    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('ia_tutor_themes');
      const customThemes = saved ? JSON.parse(saved) : [];
      return [...DEFAULT_THEMES, ...customThemes];
    }
    const { data, error } = await supabase.from('themes').select('*').order('name');
    if (error) throw error;
    return data && data.length > 0 ? data : DEFAULT_THEMES;
  },

  async createTheme(theme: { name: string, slug: string, config: any }) {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('ia_tutor_themes');
      const themes = saved ? JSON.parse(saved) : [];
      const newTheme = { ...theme, id: Math.random().toString(36).substr(2, 9) };
      localStorage.setItem('ia_tutor_themes', JSON.stringify([...themes, newTheme]));
      return newTheme;
    }
    const { data, error } = await supabase.from('themes').insert([theme]).select();
    if (error) throw error;
    return data[0];
  },

  async updateUserTheme(userId: string, themeId: string) {
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
        users[index].theme_id = themeId;
        // Reiniciar el objeto theme para que se resuelva en el próximo login/recarga
        delete users[index].theme;
        saveLocalUsers(users);
        
        // Si es el usuario actual, actualizar la sesión
        const session = localStorage.getItem('ia_tutor_session');
        if (session) {
          const sessionUser = JSON.parse(session);
          if (sessionUser.id === userId) {
            sessionUser.theme_id = themeId;
            const themes = await this.getAvailableThemes();
            const theme = themes.find(t => t.id === themeId);
            if (theme) sessionUser.theme = { slug: theme.slug, config: theme.config };
            localStorage.setItem('ia_tutor_session', JSON.stringify(sessionUser));
          }
        }
        return;
      }
      throw new Error("Usuario no encontrado");
    }

    const { error } = await supabase
      .from('users')
      .update({ theme_id: themeId })
      .eq('id', userId);
    
    if (error) throw error;

    // Si es el usuario actual, refrescar sesión local (útil para pruebas en misma pestaña)
    const session = localStorage.getItem('ia_tutor_session');
    if (session) {
      const sessionUser = JSON.parse(session);
      if (sessionUser.id === userId) {
        const updated = await this.getUserProfile(userId);
        if (updated) localStorage.setItem('ia_tutor_session', JSON.stringify(updated));
      }
    }
  },

  async assignStudentToTutor(tutorId: string, studentId: string) {
    if (!isSupabaseConfigured) {
      const relations = getLocalRelations();
      if (!relations.find(r => r.tutor_id === tutorId && r.student_id === studentId)) {
        relations.push({ tutor_id: tutorId, student_id: studentId });
        saveLocalRelations(relations);
      }
      return;
    }

    const { error } = await supabase
      .from('tutor_students')
      .insert([{ tutor_id: tutorId, student_id: studentId }]);
    
    if (error && error.code !== '23505') throw error; // Ignorar si ya existe (PK error)
  },

  async getAvailableStudents(tutorId: string) {
    const allUsers = await this.getAllUsers();
    const students = allUsers.filter(u => u.role === 'student');
    
    let currentStudentIds: string[] = [];
    if (!isSupabaseConfigured) {
      currentStudentIds = getLocalRelations()
        .filter(r => r.tutor_id === tutorId)
        .map(r => r.student_id);
    } else {
      const { data } = await supabase
        .from('tutor_students')
        .select('student_id')
        .eq('tutor_id', tutorId);
      currentStudentIds = (data || []).map(d => d.student_id);
    }

    return students.filter(s => !currentStudentIds.includes(s.id));
  },

  async getAllUsers() {
    if (!isSupabaseConfigured) return getLocalUsers();
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data as User[];
  },

  async deleteUser(id: string) {
    console.log(`Intentando eliminar usuario ID: ${id}`);
    if (id === 'admin-id') throw new Error("No se puede eliminar al administrador principal");
    
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const filtered = users.filter(u => u.id !== id);
      saveLocalUsers(filtered);

      // Limpiar tareas locales
      const tasksStr = localStorage.getItem('ia_tutor_tasks');
      if (tasksStr) {
        const tasks = JSON.parse(tasksStr);
        const filteredTasks = tasks.filter((t: any) => t.assigned_to !== id && t.created_by !== id);
        localStorage.setItem('ia_tutor_tasks', JSON.stringify(filteredTasks));
      }
      return;
    }

    // En Supabase: Eliminar tareas primero para evitar FK errors
    await supabase.from('tasks').delete().eq('assigned_to', id);
    await supabase.from('tasks').delete().eq('created_by', id);
    
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  async updateUserPassword(id: string, newPassword: string) {
    console.log(`Intentando cambiar contraseña para ID: ${id}`);
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const index = users.findIndex(u => u.id === id);
      if (index !== -1) {
        users[index].password = newPassword;
        saveLocalUsers(users);
        console.log("Contraseña actualizada en localStorage");
        return;
      }
      throw new Error("Usuario no encontrado");
    }

    const { error } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('id', id);
    if (error) throw error;
  }
};
