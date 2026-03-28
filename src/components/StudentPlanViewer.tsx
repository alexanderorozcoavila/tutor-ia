"use client";

import { useOptimistic, useState, useEffect, useCallback, startTransition } from "react";
import { planService, PlanSemanal, TareaPlanificada } from "@/lib/planService";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle2, Star, Gift, Loader2, Sparkles, AlertCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { RichTextEditor } from "@/components/RichTextEditor";
import parse from "html-react-parser";

interface Props {
  plan: PlanSemanal;
  onRefreshFallback: () => void;
  onStartModule: (task: Task) => void;
}

export function StudentPlanViewer({ plan, onRefreshFallback, onStartModule }: Props) {
  const { user } = useAuth();
  const [tareasCompletas, setTareasCompletas] = useState<TareaPlanificada[]>([]);
  const [tareasPendientes, setTareasPendientes] = useState<TareaPlanificada[]>([]);
  const [dbTasksCache, setDbTasksCache] = useState<Record<string, Task>>({});
  const [showRewardModal, setShowRewardModal] = useState(false);

  // Optimistic State para los puntos
  const realPoints = (plan.tareas || [])
    .filter(t => t.completada)
    .reduce((acc, t) => acc + t.puntos_valor, 0);

  const [optimisticPoints, addOptimisticPoints] = useOptimistic(
    realPoints,
    (state, newPoints: number) => state + newPoints
  );

  const loadData = useCallback(async () => {
    if (!plan.tareas) return;
    
    // Obtener qué día es hoy (0 a 6, ajustando DOM = 0)
    const today = new Date().getDay();
    
    const todaysPlanTasks = plan.tareas
      .filter(t => t.dia_semana === today)
      .sort((a, b) => a.orden_visual - b.orden_visual);

    setTareasCompletas(todaysPlanTasks.filter(t => t.completada));
    setTareasPendientes(todaysPlanTasks.filter(t => !t.completada));

    // Cargar los objetos virtuales de Tasks(módulo base) para poder pasarlos a onStartModule
    const allModuleIds = [...new Set(todaysPlanTasks.map(t => t.modulo_id))];
    if (allModuleIds.length > 0) {
      try {
        const rawTasks = await taskService.getTasks();
        const map: Record<string, Task> = {};
        rawTasks.forEach(t => map[t.id] = t);
        setDbTasksCache(map);
      } catch (e) {
        console.error("Error loading db tasks for plan:", e);
      }
    }
  }, [plan.tareas]);

  useEffect(() => {
    loadData();
    if (plan.esta_lograda) {
      setShowRewardModal(true);
    }
  }, [loadData, plan.esta_lograda]);

  const handleCompleteOptimistic = async (tarea: TareaPlanificada) => {
    // 1. Inyectar actualización optimista
    startTransition(() => {
      addOptimisticPoints(tarea.puntos_valor);
      setTareasPendientes(prev => prev.filter(t => t.id !== tarea.id));
      setTareasCompletas(prev => [...prev, { ...tarea, completada: true }]);
    });

    try {
      // 2. Ejecutar la llamada asíncrona a Supabase real
      await planService.completeTareaPlanificada(tarea.id, true);
      
      // Checar si se desbloqueó la recompensa
      const isAchieved = await planService.checkRewardUnlock(plan.id);
      if (isAchieved && !plan.esta_lograda) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#34d399', '#fbbf24', '#f87171', '#60a5fa']
        });
        setTimeout(() => setShowRewardModal(true), 1500);
      }
    } catch (err) {
      console.error("Error marcando tarea:", err);
      // Revertir estado crudo
      loadData(); 
    }
  };

  const handleCardClick = (tarea: TareaPlanificada) => {
    // Si es Hogar y permite marcaje directo (simplificación de UX para TDAH)
    if (tarea.tipo_modulo === 'domestic') {
       handleCompleteOptimistic(tarea);
    } else {
       // Si es dictado o lectura, abrimos el módulo y al volver el módulo actualiza la base subyacente de Tasks.
       // OJO: Aquí habría que atar la completion de 'Task' con 'TareaPlanificada'. Por ahora podemos lanzarlo y 
       // solicitar al alumno presionar 'Hecho' al terminar la actividad.
       const baseTask = dbTasksCache[tarea.modulo_id];
       if (baseTask) {
         onStartModule(baseTask);
       }
    }
  };

  const progressPercent = Math.min(100, Math.round((optimisticPoints / plan.meta_puntos_total) * 100));

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Plan Semanal */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-4 border-emerald-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex justify-between items-start relative z-10 flex-col md:flex-row gap-6">
          <div>
            <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest mb-4 inline-block">
              Plan de la Semana
            </span>
            <h1 className="text-3xl font-black text-gray-900 mb-2">¡Cumple tu Meta!</h1>
            <p className="text-gray-500 font-bold text-lg flex items-center gap-2">
              <Gift size={20} className="text-amber-500" />
              Recompensa: <span className="text-amber-600 font-black">{plan.recompensa_nombre}</span>
            </p>
          </div>

          <div className="bg-emerald-50 p-6 rounded-[2rem] border-2 border-emerald-100 text-center min-w-[200px]">
            <div className="text-4xl font-black text-emerald-600 mb-1">{optimisticPoints} <span className="text-lg text-emerald-400">/ {plan.meta_puntos_total}</span></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Puntos Ganados</p>
          </div>
        </div>

        {/* Barra de Progreso Optimista fluidísima */}
        <div className="mt-8 relative z-10">
          <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-2"
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent > 20 && <span className="text-[10px] font-black text-white mix-blend-overlay">{progressPercent}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Tareas Orientadas */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest pl-4">Aventuras de Hoy</h3>
        
        {tareasPendientes.length === 0 && tareasCompletas.length === 0 ? (
          <div className="bg-gray-50/50 border-4 border-dashed border-gray-200 p-12 rounded-[3rem] text-center flex flex-col items-center gap-4">
            <Sparkles className="text-amber-400 mb-2" size={48} />
            <h3 className="text-2xl font-black text-gray-600">¡Día Libre!</h3>
            <p className="text-gray-400 font-bold max-w-sm">Tu tutor no te asignó tareas para hoy en el Plan Semanal. ¡Disfruta tu día!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tareasPendientes.map(tarea => {
              const baseTask = dbTasksCache[tarea.modulo_id];
              return (
                <div 
                  key={tarea.id}
                  onClick={() => handleCardClick(tarea)}
                  className="group cursor-pointer bg-white p-6 rounded-[2rem] border-4 border-white shadow-lg hover:border-emerald-200 transition-all active:scale-[0.98] flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner group-hover:scale-110 transition-transform">
                      {tarea.tipo_modulo === 'dictation' ? <Loader2 size={32} /> : <CheckCircle2 size={32} />} 
                      {/* Icono temporal, podrías mapear íconos según tipo_modulo */}
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-gray-800">{baseTask ? baseTask.title : "Rutina de Hoy"}</h4>
                      <p className="text-emerald-500 font-black text-sm uppercase tracking-wider">+{tarea.puntos_valor} puntos</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gray-50 border-4 border-gray-100 rounded-full flex items-center justify-center group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors">
                     {/* Círculo vacío */}
                  </div>
                </div>
              );
            })}

            {/* Completadas - Opacas al final */}
            {tareasCompletas.map(tarea => {
              const baseTask = dbTasksCache[tarea.modulo_id];
              return (
                <div 
                  key={tarea.id}
                  className="bg-emerald-50/50 p-6 rounded-[2rem] border-4 border-emerald-100 opacity-80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-400 rounded-2xl flex items-center justify-center text-white shadow-md">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-emerald-900 line-through">{baseTask ? baseTask.title : "Rutina Terminada"}</h4>
                      <p className="text-emerald-500 font-bold text-sm">¡Completado!</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-inner">
                     <CheckCircle2 size={24} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showRewardModal && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white max-w-md w-full rounded-[3rem] shadow-2xl border-4 border-amber-200 p-8 text-center relative overflow-hidden">
            <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
               <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20" />
               <Gift size={64} className="text-amber-500 relative z-10" />
            </div>
            <h2 className="text-4xl font-black text-amber-600 mb-2">¡Meta Lograda!</h2>
            <p className="text-xl font-bold text-gray-600 mb-8">Has juntado los puntos necesarios de la semana.</p>
            
            <div className="bg-amber-50 p-6 rounded-3xl mb-8 border border-amber-100">
               <h3 className="text-2xl font-black text-gray-800">{plan.recompensa_nombre}</h3>
               {plan.recompensa_detalle && (
                 <div className="mt-4 prose prose-amber text-left max-w-none richtext-viewer text-sm mx-auto">
                   {parse(plan.recompensa_detalle)}
                 </div>
               )}
            </div>

            <button 
              onClick={() => setShowRewardModal(false)}
              className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white font-black text-2xl rounded-2xl shadow-xl transition-transform active:scale-95"
            >
              ¡Súper!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
