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
  const [dailyLevel, setDailyLevel] = useState<number>(0);
  const [isSyncingGamification, setIsSyncingGamification] = useState(false);

  // Recompensas del día
  const [recompensasDelDia, setRecompensasDelDia] = useState<(RecompensaDiaria & { recompensa?: Recompensa })[]>([]);
  const [activatingRecompensaId, setActivatingRecompensaId] = useState<string | null>(null);
  const [activatedRecompensas, setActivatedRecompensas] = useState<Set<string>>(new Set());
  const [newlyUnlockedNivel, setNewlyUnlockedNivel] = useState<number>(0);

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

    const todaysPlanTasks = plan.tareas
      .filter(t => t.dia_semana === today)
      .sort((a: any, b: any) => a.orden_visual - b.orden_visual);

    setTareasCompletas(todaysPlanTasks.filter(t => t.estado === "completada"));
    setTareasEnRevision(todaysPlanTasks.filter(t => t.estado === "en_revision"));
    setTareasPendientes(todaysPlanTasks.filter(t => t.estado === "pendiente"));

    const weekEvaluations = plan.tareas
      .filter(t => t.tipo_modulo === "assessment")
      .sort((a: any, b: any) => (a.orden_visual || 0) - (b.orden_visual || 0));
    setEvaluacionesSemanales(weekEvaluations);

    const allModuleIds = [...new Set([...todaysPlanTasks, ...weekEvaluations].map(t => t.modulo_id))];
    if (allModuleIds.length > 0) {
      try {
        const rawTasks = await taskService.getTasks();
        const map: Record<string, Task> = {};
        rawTasks.forEach(t => (map[t.id] = t));
        setDbTasksCache(map);
      } catch (e) {
        console.error("Error loading db tasks:", e);
      }
    }

    // Historial de nivel diario
    try {
      const historial = await planService.getHistorialDiarioDia(plan.id!, today);
      let currentLevel = 0;
      if (historial) {
        currentLevel = historial.nivel_alcanzado;
        setDailyLevel(currentLevel);
      }

      // Auto-sanación
      const totalHoy = todaysPlanTasks.reduce((acc, t) => acc + t.puntos_valor, 0);
      const completosHoy = todaysPlanTasks.filter(t => t.estado === "completada").reduce((acc, t) => acc + t.puntos_valor, 0);
      if (totalHoy > 0 && completosHoy === totalHoy && currentLevel < 3 && user && plan?.id) {
        const res = await calcularNivelDiario(plan.id, today, user.id);
        if (res) setDailyLevel(res.nivel);
      }
    } catch (e) {
      console.error("Error loading daily history:", e);
    }

    // Recompensas del día
    try {
      const rds = await rewardService.getRecompensasDiarias(plan.id!);
      
      // Filter out rewards not meant for the current device
      const isWindowAvailable = typeof window !== 'undefined';
      const width = isWindowAvailable ? window.innerWidth : 1024;
      const deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'pc';

      const hoyRDs = rds.filter(rd => {
        if (rd.dia_semana !== today) return false;
        const target = rd.recompensa?.dispositivo_objetivo;
        return !target || target === 'all' || target === deviceType;
      });

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

      const today = new Date().getDay();
      if (user && plan?.id) {
        setIsSyncingGamification(true);
        const result = await calcularNivelDiario(plan.id, today, user.id);
        if (result && result.nivel > dailyLevel) {
          const newNivel = result.nivel;
          setDailyLevel(newNivel);
          setNewlyUnlockedNivel(newNivel);

          const confetti = (await import("canvas-confetti")).default;
          confetti({
            particleCount: newNivel * 60,
            spread: 70,
            origin: { y: 0.8 },
            colors: newNivel === 3 ? ["#fbbf24", "#f59e0b", "#10b981", "#ffffff"] : ["#34d399", "#60a5fa", "#a78bfa"],
          });

          // Quitar la animación de "recién desbloqueado" después de 4 segundos
          setTimeout(() => setNewlyUnlockedNivel(0), 4000);
        }
        setIsSyncingGamification(false);
      }

      if (newState === "completada" && plan?.id) {
        const isAchieved = await planService.checkRewardUnlock(plan.id);
        if (isAchieved && !plan.esta_lograda) {
          const confetti = (await import("canvas-confetti")).default;
          confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: ["#34d399", "#fbbf24", "#f87171", "#60a5fa", "#a855f7"],
          });
        }
      }
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
      handleEstadoOptimistic(tarea, "completada");
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
    dailyLevel,
    isSyncingGamification,
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
