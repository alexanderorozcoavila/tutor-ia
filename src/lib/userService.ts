import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'admin' | 'tutor' | 'student';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password?: string;
  created_by?: string;
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
      .select('*')
      .eq('username', username)
      .eq('password', password)
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
        .insert([user])
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
      .select('student:student_id(*)')
      .eq('tutor_id', tutorId);
    
    if (error) throw error;
    return (data as any[]).map(d => d.student) as User[];
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
