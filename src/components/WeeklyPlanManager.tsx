"use client";

import { useState, useEffect, useCallback } from "react";
import { planService, PlanSemanal } from "@/lib/planService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Calendar, Save, Award, Loader2, Sparkles, TrendingUp } from "lucide-react";

export function WeeklyPlanManager({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [plan, setPlan] = useState<PlanSemanal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [metaPuntos, setMetaPuntos] = useState(100);
  const [recompensaNombre, setRecompensaNombre] = useState("");
  const [recompensaDetalle, setRecompensaDetalle] = useState("");

  const loadPlan = useCallback(async () => {
    if (!user || !studentId) return;
    setIsLoading(true);
    try {
      const activePlan = await planService.getPlanSemanalActivo(studentId, user.id);
      if (activePlan) {
        setPlan(activePlan);
        setMetaPuntos(activePlan.meta_puntos_total);
        setRecompensaNombre(activePlan.recompensa_nombre);
        setRecompensaDetalle(activePlan.recompensa_detalle || "");
      } else {
        setPlan(null);
      }
    } catch (err: any) {
      console.error(err);
      showAlert("Error al cargar el plan semanal.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [user, studentId, showAlert]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleSavePlan = async () => {
    if (!user || !studentId) return;
    if (!recompensaNombre) return showAlert("Ponle un título a la recompensa.", { type: "info" });
    if (metaPuntos <= 0) return showAlert("La meta de puntos debe ser mayor a 0.", { type: "info" });

    setIsSaving(true);
    try {
      if (!plan) {
        // Crear
        await planService.createPlanSemanal({
          alumno_id: studentId,
          tutor_id: user.id,
          meta_puntos_total: metaPuntos,
          recompensa_nombre: recompensaNombre,
          recompensa_detalle: recompensaDetalle,
        });
        showAlert("¡Plan Semanal creado con éxito!", { type: "success" });
        loadPlan();
      } else {
        // Actualizar no está en planService default expuesto todavía, pero la lógica de la plataforma LMS prefiere inmutabilidad semanal. 
        // Mostrar alerta de que el plan ya existe. (Idealmente añadiríamos un updatePlanSemanal en planService)
        showAlert("El plan ya está activo para esta semana. Edición futura.", { type: "info" });
      }
    } catch (err: any) {
      console.error(err);
      showAlert("Hubo un error al guardar el plan.", { type: "error" });
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
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600 shadow-sm">
          <Calendar size={24} />
        </div>
        <div>
          <h3 className="text-xl font-black text-emerald-900 tracking-tight">Estructura Semanal</h3>
          <p className="text-sm font-bold text-emerald-600/70">Asigna una meta visible para el alumno y su recompensa.</p>
        </div>
      </div>

      {plan ? (
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-emerald-100 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest">
              Plan Activo
            </span>
            <span className="text-sm font-black text-gray-400">Puntos Clave: {plan.meta_puntos_total}</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-4 bg-amber-100 text-amber-500 rounded-2xl shadow-inner">
              <Award size={32} />
            </div>
            <div>
              <h4 className="text-xl font-black text-gray-800">{plan.recompensa_nombre}</h4>
              <p className="text-sm text-gray-500 font-medium">Esta es la recompensa configurada. Si asignas tareas 'Domésticas', podrás ligarlas aquí.</p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-emerald-50 flex items-center justify-between">
             <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
               <TrendingUp size={16} /> Rutina predecible activa
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[1.5rem] p-8 shadow-lg border-2 border-emerald-100 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
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
            <p className="text-xs font-bold text-gray-400 mb-2">Puedes añadir fotos aquí si usas el sistema de Tiptap, esto ayuda mucho visualmente.</p>
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
            <div className="flex justify-between text-[10px] font-black text-emerald-400 uppercase">
              <span>Fácil (10)</span>
              <span>Intenso (500)</span>
            </div>
          </div>

          <button
            onClick={handleSavePlan}
            disabled={isSaving}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />} 
            {isSaving ? "Guardando Plan..." : "Activar Plan para esta Semana"}
          </button>
        </div>
      )}
    </div>
  );
}
