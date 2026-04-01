"use client";

import { useState, useEffect, useCallback } from "react";
import { planService, PlanSemanal, getFechasPlan } from "@/lib/planService";
import { rewardService, Recompensa, RecompensaDiaria } from "@/lib/rewardService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Calendar, Save, Award, Loader2, Sparkles, Trash2, Info, Gift, X } from "lucide-react";

// ─── Sub-componente: Panel de recompensas diarias expandible ─────────────────

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const NIVELES = [
  { nivel: 1, label: "Nivel 1 (80%)", color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200" },
  { nivel: 2, label: "Nivel 2 (90%)", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { nivel: 3, label: "Nivel 3 (100%)", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
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
        <Gift size={14} /> Recompensas por Día y Nivel de Logro
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
                {NIVELES.map(n => (
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
                  {NIVELES.map(n => {
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
                  {DIAS[modalDia]} — {NIVELES.find(n => n.nivel === modalNivel)?.label}
                </p>
              </div>
              <button onClick={() => setModalDia(null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Selector de nivel */}
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Nivel de Logro</label>
              <div className="grid grid-cols-3 gap-2">
                {NIVELES.map(n => (
                  <button
                    key={n.nivel}
                    onClick={() => setModalNivel(n.nivel)}
                    className={`py-2 px-3 rounded-xl font-black text-xs border-2 transition-all ${
                      modalNivel === n.nivel
                        ? `${n.bg} ${n.border} ${n.color} shadow-sm`
                        : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200"
                    }`}
                  >
                    {n.label.split(" ")[0]} {n.label.split(" ")[1]}
                    <br />
                    <span className="font-bold">{n.label.split(" ")[2]}</span>
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

  // Form State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [metaPuntos, setMetaPuntos] = useState(100);
  const [recompensaNombre, setRecompensaNombre] = useState("");
  const [recompensaDetalle, setRecompensaDetalle] = useState("");

  const loadPlanes = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);
    try {
      const allPlanes = await planService.getAllPlanesSemana(studentId);
      setPlanes(allPlanes);
    } catch (err: any) {
      console.error(err);
      showAlert("Error al cargar los planes semanales.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [user, studentId, showAlert]);

  const loadCatalogo = useCallback(async () => {
    try {
      const all = await rewardService.getAllRecompensas();
      setCatalogoRecompensas(all);
    } catch (err) {
      console.error("Error cargando catálogo de recompensas:", err);
    }
  }, []);

  const loadRecompensasDiarias = useCallback(async (planId: string) => {
    setIsRecompensasLoading(true);
    try {
      const rds = await rewardService.getRecompensasDiarias(planId);
      setRecompensasDiarias(rds);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecompensasLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlanes();
    loadCatalogo();
  }, [loadPlanes, loadCatalogo]);

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
                          if (isExpanded) {
                            setExpandedPlanId(null);
                          } else {
                            setExpandedPlanId(p.id);
                            loadRecompensasDiarias(p.id);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                          isExpanded ? "bg-amber-500 text-white border-amber-500" : "text-amber-600 hover:bg-amber-50 border-amber-100"
                        }`}
                      >
                        <Gift size={14} /> Recompensas
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
                    <DailyRewardsPanel
                      planId={p.id}
                      recompensasDiarias={recompensasDiarias}
                      catalogo={catalogoRecompensas}
                      isLoading={isRecompensasLoading}
                      onRefresh={loadRecompensasDiarias}
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
    </div>
  );
}
