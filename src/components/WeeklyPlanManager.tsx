"use client";

import { useState, useEffect, useCallback } from "react";
import { planService, PlanSemanal, TareaPlanificada, getFechasPlan } from "@/lib/planService";
import { rewardService, Recompensa, RecompensaDiaria } from "@/lib/rewardService";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Calendar, Save, Award, Loader2, Sparkles, Trash2, Info, Gift, X, Clock, Settings2, Pencil, ChevronLeft } from "lucide-react";

// ─── Sub-componente: Panel de recompensas diarias expandible ─────────────────

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Mapeo sencillo: usamos el campo `nivel_requerido` en BD para identificar la jornada
// 1 = Mañana, 2 = Tarde, 3 = Noche
const JORNADAS = [
  { nivel: 1, key: 'manana', label: "Mañana", color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200" },
  { nivel: 2, key: 'tarde',  label: "Tarde",  color: "text-amber-600", bg: "bg-amber-50",  border: "border-amber-200" },
  { nivel: 3, key: 'noche',  label: "Noche",  color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
];

interface DailyRewardsPanelProps {
  planId: string;
  recompensasDiarias: RecompensaDiaria[];
  catalogo: Recompensa[];
  isLoading: boolean;
  onRefresh: (planId: string) => void;
  showAlert: (msg: string, opts?: any) => void;
}

function DailyRewardsPanel({ planId, recompensasDiarias, catalogo, isLoading, onRefresh, showAlert }: DailyRewardsPanelProps) {
  const [modalDia, setModalDia] = useState<number | null>(null);
  const [modalNivel, setModalNivel] = useState<number>(1);
  const [modalRecompensaId, setModalRecompensaId] = useState<string>("");
  const [modalMinutos, setModalMinutos] = useState<number>(15);
  const [isSaving, setIsSaving] = useState(false);

  const getRecompensaDia = (dia: number, nivel: number) =>
    recompensasDiarias.find(rd => rd.dia_semana === dia && rd.nivel_requerido === nivel);

  const openModal = (dia: number, nivel: number) => {
    const rd = getRecompensaDia(dia, nivel);
    setModalDia(dia);
    setModalNivel(nivel);
    setModalRecompensaId(rd?.recompensa_id || "");
    setModalMinutos(rd?.minutos_disponibles || 15);
  };

  const handleSave = async () => {
    if (modalDia === null) return;
    setIsSaving(true);
    try {
      await rewardService.upsertRecompensaDiaria(
        planId, modalDia, modalNivel,
        modalRecompensaId || null, modalMinutos
      );
      showAlert("Recompensa asignada correctamente", { type: "success" });
      setModalDia(null);
      onRefresh(planId);
    } catch (err: any) {
      showAlert(err.message || "Error al guardar", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (dia: number, nivel: number) => {
    try {
      await rewardService.upsertRecompensaDiaria(planId, dia, nivel, null, 0);
      showAlert("Recompensa removida", { type: "info" });
      onRefresh(planId);
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    }
  };

  const selectedRecompensa = catalogo.find(r => r.id === modalRecompensaId);

  return (
    <div className="border-t-2 border-amber-100 bg-amber-50/40 p-5 animate-in slide-in-from-top-2 duration-300">
      <h5 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-4 flex items-center gap-2">
        <Gift size={14} /> Recompensas por Día y Jornada
        <span className="text-amber-400 font-bold normal-case text-[10px]">(Opcional)</span>
      </h5>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-amber-400" size={24} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-gray-400 font-black uppercase tracking-wider pb-2 pr-3 w-24">Día</th>
                {JORNADAS.map(n => (
                  <th key={n.nivel} className={`text-center pb-2 px-2 font-black ${n.color}`}>{n.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {[1, 2, 3, 4, 5, 6, 0].map(dia => (
                <tr key={dia} className="hover:bg-amber-50 transition-colors">
                  <td className="py-2 pr-3">
                    <span className="font-black text-gray-700">{DIAS[dia]}</span>
                  </td>
                  {JORNADAS.map(n => {
                    const rd = getRecompensaDia(dia, n.nivel);
                    const rInfo = rd ? catalogo.find(r => r.id === rd.recompensa_id) : null;
                    return (
                      <td key={n.nivel} className="py-2 px-2 text-center">
                        {rd && rInfo ? (
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${n.border} ${n.bg} max-w-[140px]`}>
                            <span className="text-base leading-none">{rInfo.icono_emoji || "🎁"}</span>
                            <span className={`font-black truncate text-[10px] ${n.color}`}>{rInfo.nombre}</span>
                            <span className="text-gray-400 font-bold whitespace-nowrap text-[9px]">{rd.minutos_disponibles}m</span>
                            <button
                              onClick={() => handleRemove(dia, n.nivel)}
                              className="text-gray-300 hover:text-red-500 transition-colors ml-0.5 flex-shrink-0"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openModal(dia, n.nivel)}
                            className="text-gray-300 hover:text-amber-500 font-black transition-colors text-lg leading-none"
                            title={`Asignar recompensa ${n.label} para ${DIAS[dia]}`}
                          >
                            +
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal asignación */}
      {modalDia !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl border-2 border-amber-200 w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-gray-900">Asignar Recompensa</h3>
                <p className="text-sm font-bold text-amber-600">
                  {DIAS[modalDia]} — {JORNADAS.find(n => n.nivel === modalNivel)?.label}
                </p>
              </div>
              <button onClick={() => setModalDia(null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Selector de nivel */}
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Jornada</label>
              <div className="grid grid-cols-3 gap-2">
                {JORNADAS.map(n => (
                  <button
                    key={n.nivel}
                    onClick={() => setModalNivel(n.nivel)}
                    className={`py-2 px-3 rounded-xl font-black text-xs border-2 transition-all ${
                      modalNivel === n.nivel
                        ? `${n.bg} ${n.border} ${n.color} shadow-sm`
                        : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de recompensa */}
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Recompensa del Catálogo</label>
              {catalogo.length === 0 ? (
                <p className="text-sm font-bold text-gray-400 p-4 bg-gray-50 rounded-xl text-center">
                  No hay recompensas en el catálogo.<br />
                  <span className="text-xs">El Admin debe crearlas primero.</span>
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    !modalRecompensaId ? "border-gray-300 bg-gray-50" : "border-transparent bg-gray-50"
                  }`}>
                    <input type="radio" name="rw" value="" checked={!modalRecompensaId} onChange={() => setModalRecompensaId("")} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${!modalRecompensaId ? "bg-gray-500 border-gray-500" : "border-gray-300"}`} />
                    <span className="font-bold text-sm text-gray-500">Sin recompensa</span>
                  </label>
                  {catalogo.map(r => (
                    <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      modalRecompensaId === r.id ? "border-amber-400 bg-amber-50" : "border-gray-100 hover:border-amber-200"
                    }`}>
                      <input type="radio" name="rw" value={r.id} checked={modalRecompensaId === r.id} onChange={() => setModalRecompensaId(r.id)} className="hidden" />
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${modalRecompensaId === r.id ? "bg-amber-500 border-amber-500" : "border-gray-300"}`} />
                      <span className="text-xl">{r.icono_emoji || "🎁"}</span>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-gray-800 truncate">{r.nombre}</p>
                        <p className="text-[10px] font-bold text-gray-400 truncate">{r.tipo === 'url' ? r.url : r.comando}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Minutos */}
            {modalRecompensaId && (
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex justify-between">
                  <span>Tiempo disponible</span>
                  <span className="text-amber-600">{modalMinutos} minutos</span>
                </label>
                <input
                  type="range" min="5" max="120" step="5" value={modalMinutos}
                  onChange={e => setModalMinutos(parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-gray-300 font-bold mt-1">
                  <span>5 min</span><span>60 min</span><span>120 min</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {modalRecompensaId ? "Asignar Recompensa" : "Guardar (Sin Recompensa)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: Editor de Jornadas por Tarea ────────────────────────────

const TIPO_EMOJI_MAP: Record<string, string> = {
  dictation: "📝", reading: "📖", domestic: "🏡", assessment: "📊"
};
const TIPO_LABEL_MAP: Record<string, string> = {
  dictation: "Dictado", reading: "Lectura", domestic: "Tarea del Hogar", assessment: "Evaluación"
};
const JORNADA_OPTS = [
  { key: "flexible", label: "Flexible", emoji: "🔄", hora: null as string | null,
    inactive: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200",
    active:   "bg-gray-500 text-white border-gray-500 shadow-sm" },
  { key: "manana",   label: "Mañana",   emoji: "🌅", hora: "08:00:00" as string | null,
    inactive: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    active:   "bg-amber-400 text-white border-amber-400 shadow-sm" },
  { key: "tarde",    label: "Tarde",    emoji: "☀️", hora: "14:00:00" as string | null,
    inactive: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    active:   "bg-orange-400 text-white border-orange-400 shadow-sm" },
  { key: "noche",    label: "Noche",    emoji: "🌙", hora: "20:00:00" as string | null,
    inactive: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
    active:   "bg-indigo-500 text-white border-indigo-500 shadow-sm" },
];

interface TaskJornadaEditorProps {
  plan: PlanSemanal;
  taskCache: Record<string, Task>;
  onSaved: () => void;
  showAlert: (msg: string, opts?: any) => void;
}

function TaskJornadaEditor({ plan, taskCache, onSaved, showAlert }: TaskJornadaEditorProps) {
  const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Tareas diarias (excluye evaluaciones semanales que tienen dia_semana=null)
  const tareas = (plan.tareas || []).filter(t => t.dia_semana != null && t.tipo_modulo !== "assessment");

  const getJornadaKey = (hora: string | null | undefined): string => {
    if (!hora) return "flexible";
    const h = parseInt(hora.split(":")[0]);
    if (h < 12) return "manana";
    if (h < 18) return "tarde";
    return "noche";
  };

  const getCurrentHora = (tarea: TareaPlanificada): string | null => {
    // Si fue editada localmente, tomar el valor del edits buffer
    if (tarea.id in edits) return edits[tarea.id];
    return tarea.hora_asignada ?? null;
  };

  const handleSave = async () => {
    const changed = Object.entries(edits);
    if (changed.length === 0) return showAlert("No hay cambios para guardar.", { type: "info" });
    setIsSaving(true);
    try {
      await Promise.all(
        changed.map(([id, hora]) =>
          planService.updateTareaPlanificada(id, { hora_asignada: hora as any })
        )
      );
      showAlert(`¡Jornadas guardadas para ${changed.length} tarea(s)!`, { type: "success" });
      setEdits({});
      onSaved();
    } catch (err: any) {
      showAlert(err.message || "Error al guardar jornadas", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const dias = [1, 2, 3, 4, 5, 6, 0]
    .map(d => ({ dia: d, name: DIAS_FULL[d], tareas: tareas.filter(t => t.dia_semana === d) }))
    .filter(g => g.tareas.length > 0);

  const pendingCount = Object.keys(edits).length;

  return (
    <div className="border-t-2 border-blue-100 bg-blue-50/40 p-5 animate-in slide-in-from-top-2 duration-300 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="text-xs font-black uppercase tracking-widest text-blue-700 flex items-center gap-2">
          <Clock size={14} /> Jornadas por Tarea
          <span className="text-blue-400 font-bold normal-case text-[10px]">(Mañana · Tarde · Noche)</span>
        </h5>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2.5 py-0.5 rounded-full animate-pulse">
              {pendingCount} cambio(s)
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || pendingCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-black transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Guardar Jornadas
          </button>
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap gap-1.5">
        {JORNADA_OPTS.map(j => (
          <span key={j.key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${j.active}`}>
            {j.emoji} {j.label}
          </span>
        ))}
      </div>

      {dias.length === 0 ? (
        <div className="bg-white rounded-[1rem] border border-blue-100 p-6 text-center">
          <Clock size={32} className="mx-auto text-blue-200 mb-2" />
          <p className="text-sm font-bold text-blue-400">No hay tareas diarias en este plan.</p>
          <p className="text-xs font-medium text-blue-300 mt-1">Asigna tareas por día desde el panel del tutor primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dias.map(({ dia, name, tareas: dt }) => (
            <div key={dia} className="bg-white rounded-[1rem] shadow-sm border border-blue-100 overflow-hidden">
              <div className="px-4 py-2 bg-blue-50/80 border-b border-blue-100">
                <span className="text-xs font-black text-blue-700 uppercase tracking-widest">{name}</span>
              </div>
              <div className="divide-y divide-blue-50">
                {dt.map((tarea, i) => {
                  const currentHora = getCurrentHora(tarea);
                  const currentKey = getJornadaKey(currentHora);
                  const isDirty = tarea.id in edits;
                  return (
                    <div
                      key={tarea.id}
                      className={`px-4 py-3 flex items-center gap-3 flex-wrap transition-colors duration-200 ${
                        isDirty ? "bg-blue-50/60" : ""
                      }`}
                    >
                      {/* Identificación de tarea */}
                      <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                        <span className="text-xl">{TIPO_EMOJI_MAP[tarea.tipo_modulo] || "⭐"}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-700 truncate" title={taskCache[tarea.modulo_id]?.title || TIPO_LABEL_MAP[tarea.tipo_modulo]}>
                            {taskCache[tarea.modulo_id]?.title || TIPO_LABEL_MAP[tarea.tipo_modulo] || "Tarea"}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400">
                            #{i + 1}{isDirty && <span className="text-blue-500 ml-1">• editado</span>}
                          </p>
                        </div>
                      </div>

                      {/* Botones de jornada */}
                      <div className="flex gap-1 flex-wrap">
                        {JORNADA_OPTS.map(opt => {
                          const isActive = currentKey === opt.key;
                          return (
                            <button
                              key={opt.key}
                              onClick={() => setEdits(prev => ({ ...prev, [tarea.id]: opt.hora }))}
                              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black transition-all flex items-center gap-1 active:scale-95 ${
                                isActive ? opt.active : opt.inactive
                              }`}
                              title={opt.label}
                            >
                              {opt.emoji}
                              <span className="hidden sm:inline">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function WeeklyPlanManager({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [planes, setPlanes] = useState<PlanSemanal[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Recompensas
  const [catalogoRecompensas, setCatalogoRecompensas] = useState<Recompensa[]>([]);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [recompensasDiarias, setRecompensasDiarias] = useState<RecompensaDiaria[]>([]);
  const [isRecompensasLoading, setIsRecompensasLoading] = useState(false);
  const [expandedJornadaPlanId, setExpandedJornadaPlanId] = useState<string | null>(null);
  const [taskCache, setTaskCache] = useState<Record<string, Task>>({});
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingTarea, setEditingTarea] = useState<TareaPlanificada | null>(null);

  // Form State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [metaPuntos, setMetaPuntos] = useState(100);
  const [recompensaNombre, setRecompensaNombre] = useState("");
  const [recompensaDetalle, setRecompensaDetalle] = useState("");

  const loadPlanes = useCallback(async () => {
    console.info('[WeeklyPlanManager] loadPlanes start', { userId: user?.id, studentId });
    if (!user || !studentId) {
      console.info('[WeeklyPlanManager] loadPlanes aborted - missing user or studentId');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const allPlanes = await planService.getAllPlanesSemana(studentId);
      console.info('[WeeklyPlanManager] loadPlanes success', { count: (allPlanes || []).length });
      setPlanes(allPlanes);
    } catch (err: any) {
      console.error('[WeeklyPlanManager] loadPlanes error', err);
      showAlert("Error al cargar los planes semanales.", { type: "error" });
    } finally {
      setIsLoading(false);
      console.info('[WeeklyPlanManager] loadPlanes done');
    }
  }, [user, studentId, showAlert]);

  const loadCatalogo = useCallback(async () => {
    console.info('[WeeklyPlanManager] loadCatalogo start');
    try {
      const all = await rewardService.getAllRecompensas();
      console.info('[WeeklyPlanManager] loadCatalogo success', { count: (all || []).length });
      setCatalogoRecompensas(all);
    } catch (err) {
      console.error('[WeeklyPlanManager] loadCatalogo error', err);
    }
  }, []);

  const loadRecompensasDiarias = useCallback(async (planId: string) => {
    setIsRecompensasLoading(true);
    try {
      console.info('[WeeklyPlanManager] loadRecompensasDiarias start', { planId });
      const rds = await rewardService.getRecompensasDiarias(planId);
      console.info('[WeeklyPlanManager] loadRecompensasDiarias success', { planId, count: (rds || []).length });
      setRecompensasDiarias(rds);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecompensasLoading(false);
    }
  }, []);

  const loadTaskCatalog = useCallback(async () => {
    try {
      // If we have plans loaded, prefer fetching only module ids referenced by plan tasks
      const allModuleIds = planes.flatMap(p => (p.tareas || []).map(t => t.modulo_id)).filter(Boolean);
      console.info('[WeeklyPlanManager] loadTaskCatalog start', { moduleIdsCount: allModuleIds.length });
      let rawTasks: Task[] = [];
      if (allModuleIds.length > 0) {
        rawTasks = await taskService.getTasksByIds([...new Set(allModuleIds)]);
      } else {
        rawTasks = await taskService.getTasks();
      }
      console.info('[WeeklyPlanManager] loadTaskCatalog success', { fetched: rawTasks.length });
      const map: Record<string, Task> = {};
      rawTasks.forEach(t => (map[t.id] = t));
      setTaskCache(map);
    } catch (err) {
      console.error("Error cargando catálogo de tareas:", err);
    }
  }, [planes]);

  useEffect(() => {
    console.info('[WeeklyPlanManager] useEffect mount - invoking loaders');
    loadPlanes();
    loadCatalogo();
    // loadTaskCatalog will run automatically when `planes` changes
  }, [loadPlanes, loadCatalogo]);

  useEffect(() => {
    // When planes update, refresh the task catalog
    if ((planes || []).length > 0) {
      console.info('[WeeklyPlanManager] planes changed - refreshing task catalog', { planesCount: planes.length });
      loadTaskCatalog();
    }
  }, [planes, loadTaskCatalog]);

  const handleSavePlan = async () => {
    if (!user || !studentId) return;
    if (metaPuntos <= 0) return showAlert("La meta de puntos debe ser mayor a 0.", { type: "info" });

    setIsSaving(true);
    try {
      await planService.createPlanSemanal({
        alumno_id: studentId,
        tutor_id: user.id,
        fecha_inicio: selectedDate,
        meta_puntos_total: metaPuntos,
        recompensa_nombre: recompensaNombre || "Meta Semanal",
        recompensa_detalle: recompensaDetalle,
      });
      showAlert("¡Plan Semanal creado con éxito!", { type: "success" });
      setShowCreateForm(false);
      setMetaPuntos(100);
      setRecompensaNombre("");
      setRecompensaDetalle("");
      loadPlanes();
    } catch (err: any) {
      console.error(err);
      if (err.message === 'duplicate') {
        showAlert("Ya existe un plan para la semana seleccionada.", { type: "error" });
      } else {
        showAlert("Hubo un error al guardar el plan.", { type: "error" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (planToDel: PlanSemanal) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este plan? Se borrarán todas las tareas programadas asociadas.")) return;
    setIsSaving(true);
    try {
      await planService.deletePlanSemanal(planToDel.id);
      showAlert("Plan eliminado correctamente.", { type: "success" });
      if (expandedPlanId === planToDel.id) setExpandedPlanId(null);
      loadPlanes();
    } catch (err: any) {
      console.error(err);
      showAlert("No se pudo eliminar el plan.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-emerald-50 rounded-[2rem] border-2 border-emerald-100 animate-pulse">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-[2rem] border-2 border-emerald-100 shadow-inner mb-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600 shadow-sm">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-emerald-900 tracking-tight">Historial de Planes</h3>
            <p className="text-sm font-bold text-emerald-600/70">Gestiona las metas semanales para el alumno.</p>
          </div>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-black transition-all shadow-md active:scale-95"
          >
            <Sparkles size={16} /> Crear Nuevo Plan
          </button>
        )}
      </div>

      {!showCreateForm ? (
        <div className="space-y-4">
          {planes.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-[1.5rem] border-2 border-dashed border-emerald-100 opacity-60">
              <Calendar size={48} className="mx-auto text-emerald-300 mb-2" />
              <p className="font-bold text-emerald-600">No hay planes semanales creados aún.</p>
            </div>
          ) : (
            planes.map(p => {
              const { inicio, fin } = getFechasPlan(p.fecha_inicio);
              const now = new Date();
              let statusText = "Activo";
              let statusColor = "bg-emerald-100 text-emerald-700 font-black";
              if (now < inicio) {
                statusText = "Futuro";
                statusColor = "bg-blue-100 text-blue-700 font-bold";
              } else if (now > fin) {
                statusText = "Finalizado / Expirado";
                statusColor = "bg-gray-100 text-gray-400 font-medium line-through decoration-gray-300";
              }
              const isExpanded = expandedPlanId === p.id;
              const isJornadaExpanded = expandedJornadaPlanId === p.id;

              return (
                <div key={p.id} className="bg-white rounded-[1.5rem] shadow-sm border border-emerald-50 transition-all hover:border-emerald-200 overflow-hidden">
                  <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest ${statusColor}`}>
                          {statusText}
                        </span>
                        <span className="text-xs font-bold text-gray-400">Inicio: {inicio.toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        <Award size={18} className="text-amber-500" /> {p.recompensa_nombre}
                      </h4>
                      <p className="text-xs font-bold text-emerald-600/80">Meta: {p.meta_puntos_total} pts | {p.tareas?.length || 0} tareas asig.</p>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          const newId = isExpanded ? null : p.id;
                          setExpandedPlanId(newId);
                          setSelectedDay(null);
                          if (!isExpanded) {
                            loadRecompensasDiarias(p.id);
                          } else {
                            setRecompensasDiarias([]);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                          isExpanded ? "bg-emerald-600 text-white" : "bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50"
                        }`}
                      >
                        <Settings2 size={14} />
                        {isExpanded ? "Cerrar" : "Gestionar Plan"}
                      </button>
                      <button
                        onClick={() => {
                          setExpandedJornadaPlanId(isJornadaExpanded ? null : p.id);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                          isJornadaExpanded
                            ? "bg-blue-500 text-white border-blue-500"
                            : "text-blue-600 hover:bg-blue-50 border-blue-100"
                        }`}
                      >
                        <Clock size={14} /> Jornadas
                      </button>
                      <button
                        onClick={() => handleDeletePlan(p)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs font-black transition-all"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-8 pt-8 border-t-2 border-emerald-50 animate-in slide-in-from-top-4 duration-300">
                      {selectedDay === null ? (
                        /* Vista de Selección de Día */
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((name, i) => {
                            const dailyTasks = (p.tareas || []).filter(t => t.dia_semana === i);
                            const count = dailyTasks.length;
                            return (
                              <button
                                key={i}
                                onClick={() => setSelectedDay(i)}
                                className="bg-white p-4 rounded-2xl border-2 border-emerald-50 hover:border-emerald-500 hover:shadow-lg transition-all group text-center"
                              >
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-emerald-500">{name}</p>
                                <p className="text-2xl font-black text-gray-800 my-1">{count}</p>
                                <p className="text-[9px] font-bold text-gray-400">Tareas</p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Vista Detalle Diario */
                        <div className="space-y-6">
                          <div className="flex justify-between items-center bg-white/50 p-4 rounded-2xl border border-emerald-100">
                            <h4 className="font-black text-emerald-900 flex items-center gap-2">
                              <Calendar size={18} />
                              {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][selectedDay]}
                            </h4>
                            <button
                              onClick={() => setSelectedDay(null)}
                              className="text-xs font-black text-emerald-600 hover:underline flex items-center gap-1"
                            >
                              <ChevronLeft size={14} /> Volver a la semana
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(p.tareas || []).filter(t => t.dia_semana === selectedDay).length === 0 ? (
                              <div className="text-center py-10 bg-white/30 rounded-3xl border-2 border-dashed border-emerald-100">
                                <p className="text-sm font-bold text-emerald-400">No hay tareas programadas para este día.</p>
                              </div>
                            ) : (
                              (p.tareas || []).filter(t => t.dia_semana === selectedDay)
                                .sort((a,b) => (a.orden_visual || 0) - (b.orden_visual || 0))
                                .map((tarea) => {
                                  const taskDetalle = taskCache[tarea.modulo_id];
                                  const h = tarea.hora_asignada;
                                  let jornadaLabel = "Flexible";
                                  let jornadaColor = "bg-gray-100 text-gray-500";
                                  if (h) {
                                    const hr = parseInt(h.split(":")[0]);
                                    if (hr < 12) { jornadaLabel = "Mañana"; jornadaColor = "bg-amber-100 text-amber-700"; }
                                    else if (hr < 18) { jornadaLabel = "Tarde"; jornadaColor = "bg-orange-100 text-orange-700"; }
                                    else { jornadaLabel = "Noche"; jornadaColor = "bg-indigo-100 text-indigo-700"; }
                                  }

                                  return (
                                    <div key={tarea.id} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50 flex items-center justify-between gap-4 group hover:border-emerald-200 transition-all">
                                      <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-xl shadow-inner">
                                          {TIPO_EMOJI_MAP[tarea.tipo_modulo] || "⭐"}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-black text-gray-800 text-sm truncate">{taskDetalle?.title || TIPO_LABEL_MAP[tarea.tipo_modulo]}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${jornadaColor}`}>
                                              {jornadaLabel}
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400">
                                              {tarea.puntos_valor} XP
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => setEditingTarea(tarea)}
                                          className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-all"
                                          title="Editar tarea"
                                        >
                                          <Pencil size={16} />
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (confirm("¿Eliminar esta tarea del plan?")) {
                                              await planService.deleteTareaPlanificada(tarea.id);
                                              loadPlanes();
                                              showAlert("Tarea eliminada.", { type: "success" });
                                            }
                                          }}
                                          className="p-2 text-red-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                                          title="Eliminar tarea"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isExpanded && (
                    <DailyRewardsPanel
                      planId={p.id}
                      recompensasDiarias={recompensasDiarias}
                      catalogo={catalogoRecompensas}
                      isLoading={isRecompensasLoading}
                      onRefresh={loadRecompensasDiarias}
                      showAlert={showAlert}
                    />
                  )}
                  {isJornadaExpanded && (
                    <TaskJornadaEditor
                      plan={p}
                      taskCache={taskCache}
                      onSaved={loadPlanes}
                      showAlert={showAlert}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[1.5rem] p-8 shadow-lg border-2 border-emerald-100 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-2 pb-4 border-b border-emerald-50">
            <h4 className="text-lg font-black text-gray-800">Diseñar Nuevo Plan</h4>
            <button onClick={() => setShowCreateForm(false)} className="text-sm font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-emerald-800 uppercase tracking-widest">Semana Activa (Selecciona cualquier día)</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-emerald-50/50 border-2 border-emerald-100 rounded-xl p-3 text-emerald-800 font-bold focus:outline-none focus:border-emerald-400 transition-colors"
            />
            <p className="text-[10px] font-bold text-emerald-600/70">El sistema ajustará el inicio automáticamente al Lunes correspondiente.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" /> Título del Plan (Opcional)
            </label>
            <input
              type="text"
              value={recompensaNombre}
              onChange={(e) => setRecompensaNombre(e.target.value)}
              placeholder="Ej: Semana de las estrellas, Plan Héroe..."
              className="w-full p-4 rounded-xl border-2 border-emerald-50 focus:border-emerald-300 focus:outline-none transition-all font-bold text-gray-700 bg-emerald-50/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
              Detalle del Plan (Opcional)
            </label>
            <div className="border-2 border-emerald-50 rounded-2xl overflow-hidden focus-within:border-emerald-300 transition-colors">
              <RichTextEditor
                content={recompensaDetalle}
                onChange={setRecompensaDetalle}
                placeholder="Escribe detalles o descripción de la semana..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-emerald-800 uppercase tracking-widest flex justify-between items-center w-full">
              <span>Meta Mínima de Puntos</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-lg shadow-sm">{metaPuntos} pts</span>
            </label>
            <input
              type="range" min="10" max="500" step="10" value={metaPuntos}
              onChange={(e) => setMetaPuntos(parseInt(e.target.value))}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-emerald-100 accent-emerald-500"
            />
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
              <Gift size={14} /> Las recompensas diarias por nivel se asignan después de crear el plan, usando el botón <strong>"Recompensas"</strong> en cada plan de la lista.
            </p>
          </div>

          <button
            onClick={handleSavePlan}
            disabled={isSaving}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-3 mt-4"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            {isSaving ? "Guardando Plan..." : "Registrar Plan Semanal"}
          </button>
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-8 bg-white/50 border-2 border-dashed border-emerald-200 p-6 rounded-[2rem]">
        <h4 className="flex items-center gap-2 text-emerald-800 font-black text-sm uppercase tracking-widest mb-4">
          <Info size={18} /> ¿Cómo funciona el Plan Semanal?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
            <p className="text-xs font-black text-emerald-600 uppercase mb-2">1. Crea el Plan</p>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              Define una <b>Meta de Puntos</b> y un título. Al activarse, el alumno verá su progreso diario con medallas.
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
            <p className="text-xs font-black text-amber-600 uppercase mb-2">2. Asigna Recompensas por Día</p>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              Usa el botón <b>"Recompensas"</b> de cada plan. Por cada día puedes asignar hasta <b>3 recompensas</b> (una por nivel 80%, 90%, 100%). Es completamente <b>opcional</b>.
            </p>
          </div>
        </div>
      </div>
      {/* Modal de Edición Rápida */}
      {editingTarea && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-gray-900 mb-6">Editar Tarea</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Jornada</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: null, label: "Flexible", emoji: "🔄" },
                    { key: "08:00:00", label: "Mañana", emoji: "🌅" },
                    { key: "14:00:00", label: "Tarde", emoji: "☀️" },
                    { key: "20:00:00", label: "Noche", emoji: "🌙" },
                  ].map((j) => (
                    <button
                      key={j.label}
                      onClick={() => setEditingTarea({ ...editingTarea, hora_asignada: j.key })}
                      className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                        editingTarea.hora_asignada === j.key ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-100 text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-xl">{j.emoji}</span>
                      {j.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Puntos XP</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min="5" max="50" step="5"
                    value={editingTarea.puntos_valor}
                    onChange={(e) => setEditingTarea({ ...editingTarea, puntos_valor: parseInt(e.target.value) })}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="text-lg font-black text-emerald-600 w-12">{editingTarea.puntos_valor}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingTarea(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await planService.updateTareaPlanificada(editingTarea.id, {
                      hora_asignada: editingTarea.hora_asignada,
                      puntos_valor: editingTarea.puntos_valor
                    });
                    setEditingTarea(null);
                    loadPlanes();
                    showAlert("Cambios guardados.", { type: "success" });
                  }}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
