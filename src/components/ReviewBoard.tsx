"use client";

import { useState, useEffect, useCallback } from "react";
import { planService, TareaPlanificada } from "@/lib/planService";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { Check, X, Loader2, BookOpen, Clock, AlertCircle } from "lucide-react";
import { useAlert } from "@/lib/AlertContext";

export function ReviewBoard() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [tareas, setTareas] = useState<TareaPlanificada[]>([]);
  const [dbTasksCache, setDbTasksCache] = useState<Record<string, Task>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Cargar tareas en revisión para este tutor
      const inReview = await planService.getTareasEnRevision(user.id);
      setTareas(inReview);

      // 2. Diccionario de Tasks base para ver nombres reales
      const allModuleIds = [...new Set(inReview.map(t => t.modulo_id))];
      if (allModuleIds.length > 0) {
        const rawTasks = await taskService.getTasks();
        const map: Record<string, Task> = {};
        rawTasks.forEach(t => map[t.id] = t);
        setDbTasksCache(map);
      }
    } catch (err) {
      console.error(err);
      showAlert("Error cargando las revisiones pendientes.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [user, showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDecision = async (tareaId: string, flag: 'aprobar' | 'rechazar') => {
    setProcessingId(tareaId);
    try {
      const newState = flag === 'aprobar' ? 'completada' : 'pendiente';
      await planService.updateEstadoTareaPlanificada(tareaId, newState);
      
      showAlert(
        flag === 'aprobar' ? "¡Tarea aprobada con éxito!" : "Se ha regresado la tarea al alumno.", 
        { type: flag === 'aprobar' ? 'success' : 'info' }
      );
      
      // Actualizar estado local
      setTareas(prev => prev.filter(t => t.id !== tareaId));
    } catch (err) {
      console.error(err);
      showAlert("No se pudo procesar la decisión.", { type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={48} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-amber-50 rounded-[2.5rem] p-8 border-4 border-amber-100 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-amber-900 mb-2">Panel de Revisión</h2>
          <p className="text-amber-700 font-bold">Aprueba o rechaza el trabajo de tus alumnos.</p>
        </div>
        <div className="w-20 h-20 bg-amber-200 rounded-full flex items-center justify-center relative shadow-inner">
           <Clock size={40} className="text-amber-600" />
           {tareas.length > 0 && (
             <span className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shadow-md border-2 border-white animate-bounce">
               {tareas.length}
             </span>
           )}
        </div>
      </div>

      {tareas.length === 0 ? (
        <div className="bg-gray-50/50 border-4 border-dashed border-gray-200 p-12 rounded-[3rem] text-center flex flex-col items-center gap-4">
          <Check className="text-emerald-400 mb-2" size={48} />
          <h3 className="text-2xl font-black text-gray-600">¡Todo al día!</h3>
          <p className="text-gray-400 font-bold max-w-sm">No tienes actividades académicas pendientes de revisión.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tareas.map(tarea => {
            const baseTask = dbTasksCache[tarea.modulo_id];
            const isProcessing = processingId === tarea.id;

            return (
              <div 
                key={tarea.id} 
                className="bg-white p-6 rounded-[2rem] border-4 border-amber-50 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 hover:border-amber-100 transition-colors"
              >
                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner shrink-0">
                    <BookOpen size={32} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-gray-800 leading-tight">
                      {baseTask?.title || "Actividad Desconocida"}
                    </h4>
                    <p className="text-amber-600 font-black text-sm uppercase tracking-wider mt-1">
                      Vale {tarea.puntos_valor} pts • Día Limite: {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][tarea.dia_semana]}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => handleDecision(tarea.id, 'rechazar')}
                    disabled={isProcessing}
                    className="flex-1 md:flex-none px-6 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <><X size={20} /> Rehacer</>}
                  </button>
                  <button
                    onClick={() => handleDecision(tarea.id, 'aprobar')}
                    disabled={isProcessing}
                    className="flex-1 md:flex-none px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Aprobar</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
