"use client";

import { useState, useEffect } from "react";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { TaskCreator } from "./TaskCreator";
import { 
  CheckCircle2, Clock, BookOpen, 
  Home, Star, Settings, Plus,
  ChevronRight, AlertCircle, Loader2, DatabaseZap
} from "lucide-react";

interface Props {
  onStartTask: (task: Task) => void;
}

export function TaskDashboard({ onStartTask }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isLocalMode = typeof window !== 'undefined' && 
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('TU_PROJECT_ID'));

  const loadTasks = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await taskService.getTasks();
      // Filtrar tareas asignadas a este alumno
      setTasks(data.filter(t => t.assigned_to === user.id));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="text-indigo-500 animate-spin" size={48} />
        <p className="text-gray-400 font-bold">Cargando tus aventuras...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center text-white shadow-lg">
            <Star size={40} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900">¡Hola, Pequeño Aventurero!</h1>
            <p className="text-gray-500 font-bold text-lg">Tienes {tasks.filter(t => t.status === "pending").length} tareas pendientes hoy.</p>
            {isLocalMode && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full mt-2">
                <DatabaseZap size={12} /> MODO LOCAL (Sin configurar DB)
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          {/* Botón de configuración removido para el alumno */}
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 gap-4">
        {tasks.filter(t => !['approved', 'rejected'].includes(t.status)).length === 0 ? (
          <div className="bg-indigo-50/50 border-4 border-dashed border-indigo-100 p-16 rounded-[3rem] text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-400">
              <Clock size={40} />
            </div>
            <h3 className="text-2xl font-black text-indigo-900">¡Todo al día!</h3>
            <p className="text-indigo-400 font-bold">No tienes aventuras pendientes por ahora.</p>
          </div>
        ) : (
          tasks.filter(t => !['approved', 'rejected'].includes(t.status)).map((task) => (
            <div 
              key={task.id}
              onClick={() => task.status === "pending" && onStartTask(task)}
              className={`
                group relative flex items-center justify-between p-6 rounded-[2rem] border-4 transition-all
                ${task.status === "completed" || task.status === "failed"
                  ? "bg-amber-50 border-amber-100 opacity-90 cursor-default" 
                  : "bg-white border-white shadow-lg hover:border-indigo-200 cursor-pointer active:scale-[0.98]"
                }
              `}
            >
              <div className="flex items-center gap-6">
                <div className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center 
                  ${task.type === "dictation" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}
                `}>
                  {task.type === "dictation" ? <BookOpen size={32} /> : <Home size={32} />}
                </div>
                <div>
                  <h3 className={`text-xl font-black ${task.status === "completed" ? "text-amber-700" : "text-gray-900"}`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm font-bold mt-1 text-gray-400">
                    <span className="uppercase tracking-widest">{task.type === "dictation" ? "Dictado" : "Hogar"}</span>
                    {(task.status === "completed" || task.status === "failed") && (
                      <span className="flex items-center gap-1 text-amber-500 bg-amber-100 px-3 py-1 rounded-full text-xs">
                        <Clock size={12} /> ESPERANDO REVISIÓN
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {task.status === "pending" ? (
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                    <ChevronRight size={28} />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center">
                    <AlertCircle size={24} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mis Logros (Historial del Alumno) */}
      {tasks.filter(t => t.status === 'approved').length > 0 && (
        <div className="pt-8 space-y-6">
          <h2 className="text-2xl font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" /> Mis Logros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.filter(t => t.status === 'approved').map(task => (
              <div key={task.id} className="bg-white/50 p-6 rounded-[2rem] border-2 border-emerald-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Star size={24} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800">{task.title}</h4>
                    <p className="text-xs font-bold text-emerald-500">¡GANASTE {task.score} PUNTOS!</p>
                  </div>
                </div>
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
