"use client";

import { useOptimistic, useState, useEffect, useCallback, startTransition } from "react";
import { planService, PlanSemanal, TareaPlanificada } from "@/lib/planService";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { CheckCircle2, Star, Gift, Loader2, Sparkles, Clock, Trophy, Medal } from "lucide-react";
import confetti from "canvas-confetti";
import parse from "html-react-parser";
import { calcularNivelDiario } from "@/lib/actions/gamification";

interface Props {
  plan: PlanSemanal;
  onRefreshFallback: () => void;
  onStartModule: (task: Task) => void;
}

export function StudentPlanViewer({ plan, onRefreshFallback, onStartModule }: Props) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [tareasCompletas, setTareasCompletas] = useState<TareaPlanificada[]>([]);
  const [tareasEnRevision, setTareasEnRevision] = useState<TareaPlanificada[]>([]);
  const [tareasPendientes, setTareasPendientes] = useState<TareaPlanificada[]>([]);
  const [dbTasksCache, setDbTasksCache] = useState<Record<string, Task>>({});
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [dailyLevel, setDailyLevel] = useState<number>(0);
  const [isSyncingGamification, setIsSyncingGamification] = useState(false);

  // Optimistic State para los puntos (solo suma los 'completada' en duro)
  const realPoints = (plan.tareas || [])
    .filter(t => t.estado === 'completada')
    .reduce((acc, t) => acc + t.puntos_valor, 0);

  const [optimisticPoints, addOptimisticPoints] = useOptimistic(
    realPoints,
    (state, newPoints: number) => state + newPoints
  );

  const loadData = useCallback(async () => {
    if (!plan.tareas) return;
    
    const today = new Date().getDay();
    
    const todaysPlanTasks = plan.tareas
      .filter(t => t.dia_semana === today)
      .sort((a, b) => a.orden_visual - b.orden_visual);

    setTareasCompletas(todaysPlanTasks.filter(t => t.estado === 'completada'));
    setTareasEnRevision(todaysPlanTasks.filter(t => t.estado === 'en_revision'));
    setTareasPendientes(todaysPlanTasks.filter(t => t.estado === 'pendiente'));

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

    // Cargar logro del día (Fase 4)
    try {
      const historial = await planService.getHistorialDiarioDia(plan.id, today);
      let currentLevel = 0;
      if (historial) {
        currentLevel = historial.nivel_alcanzado;
        setDailyLevel(currentLevel);
      }

      // Auto-sanación: Si todas las tareas de hoy están completas pero el nivel no es 3, re-calcular.
      const totalPuntosHoy = todaysPlanTasks.reduce((acc, t) => acc + t.puntos_valor, 0);
      const puntosCompletosHoy = todaysPlanTasks.filter(t => t.estado === 'completada').reduce((acc, t) => acc + t.puntos_valor, 0);
      
      if (totalPuntosHoy > 0 && puntosCompletosHoy === totalPuntosHoy && currentLevel < 3 && user) {
        const res = await calcularNivelDiario(plan.id, today, user.id);
        if (res) setDailyLevel(res.nivel);
      }
    } catch (e) {
      console.error("Error loading daily history:", e);
    }
  }, [plan.id, plan.tareas, user]);

  useEffect(() => {
    loadData();
    if (plan.esta_lograda) {
      setShowRewardModal(true);
    }
  }, [loadData, plan.esta_lograda]);

  const handleEstadoOptimistic = async (tarea: TareaPlanificada, newState: 'completada' | 'en_revision') => {
    startTransition(() => {
      setTareasPendientes(prev => prev.filter(t => t.id !== tarea.id));
      if (newState === 'completada') {
        addOptimisticPoints(tarea.puntos_valor);
        setTareasCompletas(prev => [...prev, { ...tarea, estado: 'completada' }]);
      } else {
        setTareasEnRevision(prev => [...prev, { ...tarea, estado: 'en_revision' }]);
      }
    });

    try {
      await planService.updateEstadoTareaPlanificada(tarea.id, newState);
      
      // Motor de Gamificación Diaria (Fase 4)
      const today = new Date().getDay();
      if (user) {
        setIsSyncingGamification(true);
        const result = await calcularNivelDiario(plan.id, today, user.id);
        if (result && result.nivel > dailyLevel) {
          // ¡Subió de nivel!
          setDailyLevel(result.nivel);
          // Confetti especial según nivel
          confetti({
            particleCount: result.nivel * 50,
            spread: 60,
            colors: result.nivel === 3 ? ['#fbbf24', '#f59e0b', '#ffffff'] : ['#34d399', '#60a5fa']
          });
        }
        setIsSyncingGamification(false);
      }

      // Checar si se desbloqueó la recompensa del plan completo
      if (newState === 'completada') {
        const isAchieved = await planService.checkRewardUnlock(plan.id);
        if (isAchieved && !plan.esta_lograda) {
          confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a855f7']
          });
          setTimeout(() => setShowRewardModal(true), 1500);
        }
      }
    } catch (err: any) {
      console.error("Error cambiando estado:", err);
      showAlert(err.message || "Error al actualizar", { type: "error" });
      loadData(); 
    }
  };

  const handleCardClick = (tarea: TareaPlanificada) => {
    if (tarea.tipo_modulo === 'domestic') {
       // Autocompleta directo
       handleEstadoOptimistic(tarea, 'completada');
    } else {
       const baseTask = dbTasksCache[tarea.modulo_id];
       if (baseTask) {
         // OJO: Al terminar, el TaskManager no tiene cómo avisarle al Plan actualmente en el MVP. 
         // Mostraremos un botón rápido para fingir que "lo terminó" y lo manda a revisión por ahora para destrabar el UX.
         // En el LMS real, el TaskManager dispara onSubmit().
         handleEstadoOptimistic(tarea, 'en_revision');
         onStartModule(baseTask);
       }
    }
  };

  const progressPercent = Math.min(100, Math.round((optimisticPoints / plan.meta_puntos_total) * 100));

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
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

          <div className="bg-emerald-50 p-6 rounded-[2rem] border-2 border-emerald-100 text-center min-w-[200px] relative">
            {isSyncingGamification && (
              <div className="absolute -top-3 -left-3 bg-white rounded-full p-2 shadow-sm animate-spin">
                <Loader2 size={16} className="text-emerald-500" />
              </div>
            )}
            <div className="text-4xl font-black text-emerald-600 mb-1">{optimisticPoints} <span className="text-lg text-emerald-400">/ {plan.meta_puntos_total}</span></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3">Puntos Aprobados</p>
            
            {/* Medallas Diarias */}
            <div className="flex justify-center gap-1.5 border-t border-emerald-200/50 pt-3">
              <Medal size={24} className={`transition-all ${dailyLevel >= 1 ? "text-slate-400 drop-shadow-sm scale-110" : "text-emerald-200 opacity-20"}`} />
              <Medal size={24} className={`transition-all ${dailyLevel >= 2 ? "text-amber-500 drop-shadow-sm scale-110" : "text-emerald-200 opacity-20"}`} />
              <Trophy size={24} className={`transition-all ${dailyLevel >= 3 ? "text-amber-600 drop-shadow-md scale-125 animate-bounce" : "text-emerald-200 opacity-20"}`} />
            </div>
            {dailyLevel > 0 && (
              <p className="text-[10px] font-black text-emerald-600 mt-2 animate-pulse">
                {dailyLevel === 3 ? "¡DÍA PERFECTO!" : dailyLevel === 2 ? "¡LOGRO ORO!" : "¡LOGRO PLATA!"}
              </p>
            )}
          </div>
        </div>

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

      <div className="space-y-4">
        <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest pl-4">Aventuras de Hoy</h3>
        
        {tareasPendientes.length === 0 && tareasCompletas.length === 0 && tareasEnRevision.length === 0 ? (
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
                      {tarea.tipo_modulo === 'dictation' || tarea.tipo_modulo === 'reading' ? <Loader2 size={32} /> : <CheckCircle2 size={32} />} 
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-gray-800">{baseTask ? baseTask.title : "Rutina de Hoy"}</h4>
                      <p className="text-emerald-500 font-black text-sm uppercase tracking-wider">+{tarea.puntos_valor} puntos</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gray-50 border-4 border-gray-100 rounded-full flex items-center justify-center group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors" />
                </div>
              );
            })}

            {tareasEnRevision.map(tarea => {
              const baseTask = dbTasksCache[tarea.modulo_id];
              return (
                <div 
                  key={tarea.id}
                  className="bg-amber-50/50 p-6 rounded-[2rem] border-4 border-amber-100 opacity-90 flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner animate-pulse">
                      <Clock size={32} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-amber-900">{baseTask ? baseTask.title : "Actividad Enviada"}</h4>
                      <p className="text-amber-600 font-bold text-sm">El tutor la está revisando ⏳</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {tareasCompletas.map(tarea => {
              const baseTask = dbTasksCache[tarea.modulo_id];
              return (
                <div 
                  key={tarea.id}
                  className="bg-emerald-50/50 p-6 rounded-[2rem] border-4 border-emerald-100 opacity-70 flex items-center justify-between hue-rotate-15"
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
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white max-w-md w-full rounded-[3rem] shadow-2xl border-4 border-amber-200 p-8 text-center relative overflow-hidden">
             {/* Modal Content */}
             <Gift size={64} className="text-amber-500 mx-auto my-4" />
             <h2 className="text-3xl font-black text-amber-600 mb-2">¡Reto Logrado!</h2>
             <p className="text-gray-500 font-bold mb-6">Ganaste tu recompensa.</p>
             <button onClick={() => setShowRewardModal(false)} className="w-full py-4 rounded-xl bg-amber-500 space-x-2 text-white font-black text-xl hover:bg-amber-600">
               ¡Genial!
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
