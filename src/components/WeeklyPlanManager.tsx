"use client";

import { useState, useEffect, useCallback } from "react";
import { planService, PlanSemanal, getFechasPlan } from "@/lib/planService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Calendar, Save, Award, Loader2, Sparkles, TrendingUp, Trash2, Info } from "lucide-react";

export function WeeklyPlanManager({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [planes, setPlanes] = useState<PlanSemanal[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    loadPlanes();
  }, [loadPlanes]);

  const handleSavePlan = async () => {
    if (!user || !studentId) return;
    if (!recompensaNombre) return showAlert("Ponle un título a la recompensa.", { type: "info" });
    if (metaPuntos <= 0) return showAlert("La meta de puntos debe ser mayor a 0.", { type: "info" });

    setIsSaving(true);
    try {
      // Create new plan (Service handles duplicate date constraints implicitly, but we can catch it)
      await planService.createPlanSemanal({
        alumno_id: studentId,
        tutor_id: user.id,
        fecha_inicio: selectedDate, // Normaliza a lunes internamente
        meta_puntos_total: metaPuntos,
        recompensa_nombre: recompensaNombre,
        recompensa_detalle: recompensaDetalle,
      });
      showAlert("¡Plan Semanal creado con éxito!", { type: "success" });
      setShowCreateForm(false);
      
      // Reset form
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
               // Evaluar estado para styling visual
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

               return (
                 <div key={p.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-emerald-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:border-emerald-200">
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
                      <p className="text-xs font-bold text-emerald-600/80">Meta Asignada: {p.meta_puntos_total} pts | {p.tareas?.length || 0} tareas asig.</p>
                    </div>

                    <button
                       onClick={() => handleDeletePlan(p)}
                       disabled={isSaving}
                       className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs font-black transition-all"
                       title="Eliminar Plan"
                    >
                       <Trash2 size={14} /> Eliminar
                    </button>
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
              <Sparkles size={16} className="text-amber-500" /> Título de la Recompensa
            </label>
            <input
              type="text"
              value={recompensaNombre}
              onChange={(e) => setRecompensaNombre(e.target.value)}
              placeholder="Ej: Salida al parque de diversiones, Helado gigante..."
              className="w-full p-4 rounded-xl border-2 border-emerald-50 focus:border-emerald-300 focus:outline-none transition-all font-bold text-gray-700 bg-emerald-50/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
               Detalle visual de la Recompensa (Opcional)
            </label>
            <div className="border-2 border-emerald-50 rounded-2xl overflow-hidden focus-within:border-emerald-300 transition-colors">
               <RichTextEditor 
                 content={recompensaDetalle}
                 onChange={setRecompensaDetalle}
                 placeholder="Escribe detalles o añade imagen de la recompensa..."
               />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-emerald-800 uppercase tracking-widest flex items-between items-center w-full justify-between">
              <span>Meta Mínima de Puntos</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-lg shadow-sm">{metaPuntos} pts</span>
            </label>
            <input 
              type="range" min="10" max="500" step="10" value={metaPuntos} 
              onChange={(e) => setMetaPuntos(parseInt(e.target.value))}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-emerald-100 accent-emerald-500"
            />
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

      {/* Leyenda Explicativa */}
      <div className="mt-8 bg-white/50 border-2 border-dashed border-emerald-200 p-6 rounded-[2rem]">
        <h4 className="flex items-center gap-2 text-emerald-800 font-black text-sm uppercase tracking-widest mb-4">
          <Info size={18} /> ¿Cómo funciona el Plan Semanal?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
            <p className="text-xs font-black text-emerald-600 uppercase mb-2">1. Crea la Estructura</p>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              Define una <b>Recompensa</b> atractiva y una <b>Meta de Puntos</b>. Al activarse, el alumno verá una barra de progreso que le motivará a completar sus tareas para ganar el premio.
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
            <p className="text-xs font-black text-emerald-600 uppercase mb-2">2. Asigna Tareas al Plan</p>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              Usa el botón <b>"Asignar Tarea"</b> de arriba. Al elegir una categoría (ej. Hogar), selecciona los días en que debe repetirse. Estas aparecerán automáticamente en el tablero del alumno cada día.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
