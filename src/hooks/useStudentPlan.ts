import { useOptimistic, useState, useEffect, useCallback, startTransition } from "react";
import { planService, PlanSemanal, TareaPlanificada } from "@/lib/planService";
import { rewardService, RecompensaDiaria, Recompensa } from "@/lib/rewardService";
import { supabase } from "@/lib/supabase";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { calcularNivelDiario } from "@/lib/actions/gamification";

export function useStudentPlan(plan: PlanSemanal, onStartModule: (task: Task) => void) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [tareasCompletas, setTareasCompletas] = useState<TareaPlanificada[]>([]);
  const [tareasEnRevision, setTareasEnRevision] = useState<TareaPlanificada[]>([]);
  const [tareasPendientes, setTareasPendientes] = useState<TareaPlanificada[]>([]);
  const [evaluacionesSemanales, setEvaluacionesSemanales] = useState<TareaPlanificada[]>([]);
  const [dbTasksCache, setDbTasksCache] = useState<Record<string, Task>>({});
  // -- Jornadas Gamification --
  const [jornadasMedals, setJornadasMedals] = useState({ manana: false, tarde: false, noche: false });
  const [activeJornada, setActiveJornada] = useState<"manana" | "tarde" | "noche">("manana");
  
  // Recompensas del día
  const [recompensasDelDia, setRecompensasDelDia] = useState<(RecompensaDiaria & { recompensa?: Recompensa })[]>([]);
  const [activatingRecompensaId, setActivatingRecompensaId] = useState<string | null>(null);
  const [activatedRecompensas, setActivatedRecompensas] = useState<Set<string>>(new Set());
  const [newlyUnlockedNivel, setNewlyUnlockedNivel] = useState<{ id: string, name: string } | null>(null);

  // Puntos optimistas
  const realPoints = (plan?.tareas || [])
    .filter(t => t.estado === "completada")
    .reduce((acc, t) => acc + t.puntos_valor, 0);

  const [optimisticPoints, addOptimisticPoints] = useOptimistic(
    realPoints,
    (state, newPoints: number) => state + (newPoints as number)
  );

  const loadData = useCallback(async () => {
    if (!plan?.tareas) return;

    const today = new Date().getDay();
    const now = new Date();
    const h = now.getHours();
    
    // 1. Obtener Configuración de Jornadas (Base de Datos)
    const config = await planService.getJornadaConfig();
    const timeToSeconds = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 3600 + m * 60;
    };
    const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60;

    const isTimeInRange = (range: string) => {
      const [start, end] = range.split('-');
      const s = timeToSeconds(start);
      const e = timeToSeconds(end);
      return nowSecs >= s && nowSecs <= e;
    };

    // 2. Determinar Jornada Activa
    let currentJornada: "manana" | "tarde" | "noche" = "manana";
    if (isTimeInRange(config.rango_tarde)) currentJornada = "tarde";
    else if (isTimeInRange(config.rango_noche)) currentJornada = "noche";
    else currentJornada = "manana"; // Default a mañana si no encaja (ej: madrugada)
    
    setActiveJornada(currentJornada);

    // 3. Obtener tareas de hoy
    const todaysTasks = plan.tareas
      .filter(t => t.dia_semana === today)
      .sort((a: any, b: any) => (a.orden_visual || 0) - (b.orden_visual || 0));

    // 4. Filtrar para visualización (Estricto por Jornada + Flexibles)
    const getJornadaOfTask = (t: TareaPlanificada) => {
      if (!t.hora_asignada) return null; // Flexible
      const hr = parseInt(t.hora_asignada.split(":")[0]);
      const min = parseInt(t.hora_asignada.split(":")[1] || "0");
      const tSecs = hr * 3600 + min * 60;

      const [mStart, mEnd] = config.rango_manana.split('-');
      if (tSecs >= timeToSeconds(mStart) && tSecs <= timeToSeconds(mEnd)) return "manana";

      const [tStart, tEnd] = config.rango_tarde.split('-');
      if (tSecs >= timeToSeconds(tStart) && tSecs <= timeToSeconds(tEnd)) return "tarde";

      return "noche";
    };

    const tasksToShow = todaysTasks.filter(t => {
      const taskJ = getJornadaOfTask(t);
      return taskJ === null || taskJ === currentJornada;
    });

    setTareasCompletas(tasksToShow.filter(t => t.estado === "completada"));
    setTareasEnRevision(tasksToShow.filter(t => t.estado === "en_revision"));
    setTareasPendientes(tasksToShow.filter(t => t.estado === "pendiente"));

    // 4. Calcular Medallas (Sobre todas las de hoy, agrupadas)
    // Only count tasks that are explicitly assigned to each jornada (ignore flexible tasks without hora_asignada)
    const checkJornadas = (allTodayTasks: TareaPlanificada[]) => {
      const mTasks = allTodayTasks.filter(t => getJornadaOfTask(t) === "manana");
      const tTasks = allTodayTasks.filter(t => getJornadaOfTask(t) === "tarde");
      const nTasks = allTodayTasks.filter(t => getJornadaOfTask(t) === "noche");

      return {
        manana: mTasks.length > 0 && mTasks.every(t => t.estado === "completada"),
        tarde: tTasks.length > 0 && tTasks.every(t => t.estado === "completada"),
        noche: nTasks.length > 0 && nTasks.every(t => t.estado === "completada")
      };
    };

    setJornadasMedals(checkJornadas(todaysTasks));

    const weekEvaluations = plan.tareas
      .filter(t => t.tipo_modulo === "assessment")
      .sort((a: any, b: any) => (a.orden_visual || 0) - (b.orden_visual || 0));
    setEvaluacionesSemanales(weekEvaluations);

    const allModuleIds = [...new Set([...todaysTasks, ...weekEvaluations].map(t => t.modulo_id))];
    if (allModuleIds.length > 0) {
      try {
        const rawTasks = await taskService.getTasksByIds(allModuleIds.filter(Boolean));
        const map: Record<string, Task> = {};
        rawTasks.forEach(t => (map[t.id] = t));
        setDbTasksCache(map);
      } catch (e) {
        console.error("Error loading db tasks:", e);
      }
    }

    // Historial de nivel diario -> Now driven client-side by tasks directly (Medallas)
    // No explicit try/catch needed since we calculate medals dynamically off todaysPlanTasks

    // Recompensas del día
    try {
      // Fetch only today's rewards with unlocked flag computed by rewardService
      const hoyRDs = await rewardService.computeRecompensasHoy(plan.id!, today);
      console.info('[useStudentPlan] recompensas calculadas hoy:', hoyRDs);
      setRecompensasDelDia(hoyRDs as any);

      // Cargar usos ya existentes desde BD → evita re-activación tras recarga de página
      if (user && hoyRDs.length > 0) {
        const rdIds = hoyRDs.map(rd => rd.id);
        const usadas = await rewardService.getUsosRecompensaHoy(rdIds, user.id);
        setActivatedRecompensas(new Set(usadas));
      }
    } catch (e) {
      console.error("Error loading recompensas:", e);
    }
  }, [plan?.id, plan?.tareas, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEstadoOptimistic = async (tarea: TareaPlanificada, newState: "completada" | "en_revision") => {
    startTransition(() => {
      setTareasPendientes(prev => prev.filter(t => t.id !== tarea.id));
      if (newState === "completada") {
        addOptimisticPoints(tarea.puntos_valor);
        setTareasCompletas(prev => [...prev, { ...tarea, estado: "completada" }]);
      } else {
        setTareasEnRevision(prev => [...prev, { ...tarea, estado: "en_revision" }]);
      }
    });

    try {
      await planService.updateEstadoTareaPlanificada(tarea.id, newState);

      const config = await planService.getJornadaConfig();
      const timeToSeconds = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 3600 + m * 60;
      };

      const getJornadaOfTask = (t: TareaPlanificada) => {
        if (!t.hora_asignada) return null;
        const [hr, min] = t.hora_asignada.split(":").map(Number);
        const tSecs = hr * 3600 + (min || 0) * 60;

        const [mStart, mEnd] = config.rango_manana.split('-');
        if (tSecs >= timeToSeconds(mStart) && tSecs <= timeToSeconds(mEnd)) return "manana";

        const [tStart, tEnd] = config.rango_tarde.split('-');
        if (tSecs >= timeToSeconds(tStart) && tSecs <= timeToSeconds(tEnd)) return "tarde";

        return "noche";
      };

      const checkJornadas = (allTodayTasks: TareaPlanificada[]) => {
        const check = (task: TareaPlanificada) => (task.id === tarea.id ? newState === "completada" : task.estado === "completada");

        const mTasks = allTodayTasks.filter(t => getJornadaOfTask(t) === "manana");
        const tTasks = allTodayTasks.filter(t => getJornadaOfTask(t) === "tarde");
        const nTasks = allTodayTasks.filter(t => getJornadaOfTask(t) === "noche");

        return {
          manana: mTasks.length > 0 && mTasks.every(check),
          tarde: tTasks.length > 0 && tTasks.every(check),
          noche: nTasks.length > 0 && nTasks.every(check)
        };
      };

      const todayTasks = plan?.tareas?.filter(t => t.dia_semana === new Date().getDay()) || [];
      const newMedals = checkJornadas(todayTasks);
      
      Object.keys(newMedals).forEach(k => {
         const key = k as keyof typeof newMedals;
         if (newMedals[key] && !jornadasMedals[key]) {
            // New medal unlocked!
            setNewlyUnlockedNivel({ id: key, name: `Medalla de la ${key.charAt(0).toUpperCase() + key.slice(1)}` });
            import("canvas-confetti").then((mod) => {
              mod.default({ particleCount: 200, spread: 70, origin: { y: 0.8 }, colors: ["#fbbf24", "#f59e0b", "#10b981", "#ffffff"] });
            });
            setTimeout(() => setNewlyUnlockedNivel(null), 4000);
         }
      });
      setJornadasMedals(newMedals);

      // Recompensas ahora se calculan por jornada y se manejan localmente
      // (el efecto visual de medalla y confetti ya se dispara arriba cuando
      // detectamos que una jornada se completó). No ejecutar lógica global
      // basada en 'nivel' o puntos aquí para desbloquear recompensas diarias.
    } catch (err: any) {
      console.error("Error cambiando estado:", err);
      showAlert(err.message || "Error al actualizar", { type: "error" });
      loadData();
    }
  };

  const handleActivarRecompensa = async (rd: RecompensaDiaria & { recompensa?: Recompensa }) => {
    if (!user || activatingRecompensaId) return;
    const rInfo = (rd as any).recompensa as Recompensa | undefined;
    setActivatingRecompensaId(rd.id);
    try {
      await rewardService.activarRecompensa(rd.id, user.id);
      setActivatedRecompensas(prev => new Set([...prev, rd.id]));
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 100, spread: 55, origin: { y: 0.75 } });
      showAlert(`¡${rInfo?.nombre || "Recompensa"} activada! La app se abrirá en breve. 🚀`, { type: "success" });
    } catch (err: any) {
      showAlert(err.message || "Error al activar la recompensa", { type: "error" });
    } finally {
      setActivatingRecompensaId(null);
    }
  };

  const handleCardClick = async (tarea: TareaPlanificada) => {
    if (tarea.tipo_modulo === "domestic") {
      const baseTask = dbTasksCache[tarea.modulo_id];
      if (baseTask) {
        // Inyectar referencia a la tarea planificada para que el módulo pueda actualizar su estado
        const taskWithPlanRef: Task = {
          ...baseTask,
          metadata: {
            ...(baseTask.metadata || {}),
            is_plan_task: true,
            planTaskId: tarea.id,
          }
        };
        onStartModule(taskWithPlanRef);
      }
    } else if (tarea.tipo_modulo === "assessment") {
      try {
        const { data: template } = await supabase.from("assessment_templates").select("*").eq("id", tarea.modulo_id).single();
        if (template) {
          const virtualTask: Task = {
            id: tarea.id,
            title: template.title,
            type: "assessment",
            status: "pending",
            score: 0,
            created_at: new Date().toISOString(),
            metadata: {
              questions: template.questions,
              assessment_time_limit: template.time_limit_seconds,
              template_id: template.id,
              is_plan_task: true,
            },
          };
          onStartModule(virtualTask);
        }
      } catch (e) {
        showAlert("No se pudo cargar la evaluación.", { type: "error" });
      }
    } else {
      const baseTask = dbTasksCache[tarea.modulo_id];
      if (baseTask) {
        // Si ya estaba en_revision (alumno salió a la mitad), retomar sin cambiar estado nuevamente
        if (tarea.estado !== "en_revision") {
          handleEstadoOptimistic(tarea, "en_revision");
        }
        onStartModule(baseTask);
      }
    }
  };

  const progressPercent = plan ? Math.min(100, Math.round((optimisticPoints / plan.meta_puntos_total) * 100)) : 0;
  const hasRecompensasHoy = recompensasDelDia.some(rd => rd.recompensa_id);

  return {
    tareasCompletas,
    tareasEnRevision,
    tareasPendientes,
    evaluacionesSemanales,
    dbTasksCache,
    jornadasMedals,
    activeJornada,
    isSyncingGamification: false,
    recompensasDelDia,
    activatingRecompensaId,
    activatedRecompensas,
    newlyUnlockedNivel,
    optimisticPoints,
    progressPercent,
    hasRecompensasHoy,
    handleActivarRecompensa,
    handleCardClick,
    loadData
  };
}
