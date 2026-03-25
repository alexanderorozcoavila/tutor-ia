"use client";

import { useState } from "react";
import { taskService, TaskType } from "@/lib/taskService";
import { Plus, BookOpen, Home, Save, X } from "lucide-react";
import { useAlert } from "@/lib/AlertContext";

interface Props {
  studentId?: string;
  onTaskCreated: () => void;
  onCancel: () => void;
}

export function TaskCreator({ studentId, onTaskCreated, onCancel }: Props) {
  const { showAlert } = useAlert();
  const [type, setType] = useState<TaskType>("dictation");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dictationText, setDictationText] = useState("");
  const [mode, setMode] = useState<"LIBRE" | "TEMPORIZADOR">("TEMPORIZADOR");
  const [timeLimit, setTimeLimit] = useState(30);
  const [alertInterval, setAlertInterval] = useState(10);
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [hideText, setHideText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title) return showAlert("Por favor ponle un título a la tarea.", { type: "info" });
    if (type === "dictation" && !dictationText) return showAlert("El dictado necesita un texto.", { type: "info" });

    setIsSaving(true);
    try {
      await taskService.createTask({
        title,
        description,
        type,
        assigned_to: studentId,
        metadata: type === "dictation" ? { 
          dictation_text: dictationText,
          config: {
            mode,
            timeLimit: mode === "TEMPORIZADOR" ? timeLimit : 0,
            alertInterval,
            enableAlerts,
            hideText
          }
        } : {},
      });
      onTaskCreated();
    } catch (err) {
      console.error(err);
      showAlert("No pudimos guardar la tarea. Revisa tu conexión.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-gray-900">Nueva Actividad</h2>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Selector de Tipo */}
        <div className="flex gap-4 p-2 bg-gray-50 rounded-2xl">
          <button
            onClick={() => setType("dictation")}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${type === "dictation" ? "bg-white shadow-md text-blue-600" : "text-gray-400"}`}
          >
            <BookOpen size={20} /> Dictado
          </button>
          <button
            onClick={() => setType("domestic")}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${type === "domestic" ? "bg-white shadow-md text-emerald-600" : "text-gray-400"}`}
          >
            <Home size={20} /> Tarea del Hogar
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Título de la actividad</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "dictation" ? "Ej: El Principito - Cap 1" : "Ej: Ordenar los juguetes"}
            className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-300 focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Instrucciones (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿Hay algo especial que deba saber el niño?"
            className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-300 focus:outline-none transition-all h-24 resize-none"
          />
        </div>

        {type === "dictation" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 bg-indigo-50/30 p-6 rounded-[2rem] border-2 border-indigo-100">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Texto para dictar</label>
              <textarea
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="Escribe aquí el texto que el tutor leerá..."
                className="w-full p-4 rounded-2xl border-2 border-indigo-100 bg-white focus:border-indigo-300 focus:outline-none transition-all h-24 resize-none font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Modo de dictado</label>
              <div className="flex bg-white p-1 rounded-xl border-2 border-indigo-100">
                <button
                  type="button"
                  onClick={() => setMode("LIBRE")}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode === "LIBRE" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400"}`}
                >
                  Modo Libre
                </button>
                <button
                  type="button"
                  onClick={() => setMode("TEMPORIZADOR")}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode === "TEMPORIZADOR" ? "bg-indigo-600 text-white shadow-md" : "text-gray-400"}`}
                >
                  Temporizador
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm">
              <div className="space-y-3">
                <label className="text-xs font-black text-indigo-400 uppercase tracking-tighter flex justify-between items-center">
                  Tiempo Máx. / Frase
                  <span className={`px-2 py-0.5 rounded text-[10px] ${timeLimit === 0 ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}>
                    {timeLimit === 0 ? "Desactivado" : `${timeLimit}s`}
                  </span>
                </label>
                <input 
                  type="range" min="0" max="60" step="5" value={timeLimit} 
                  disabled={mode === "LIBRE"}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                  className={`w-full accent-indigo-500 ${mode === "LIBRE" ? "opacity-30" : ""}`}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-indigo-400 uppercase tracking-tighter flex justify-between items-center">
                  Alerta de atención
                  <span className={`px-2 py-0.5 rounded text-[10px] ${alertInterval === 0 ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-600'}`}>
                    {alertInterval === 0 ? "Desactivado" : `${alertInterval}s`}
                  </span>
                </label>
                <input 
                  type="range" min="0" max="30" step="5" value={alertInterval} 
                  onChange={(e) => setAlertInterval(parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">Activar alertas automáticas</span>
              <button
                type="button"
                onClick={() => setEnableAlerts(!enableAlerts)}
                className={`w-12 h-6 rounded-full relative transition-all ${enableAlerts ? "bg-indigo-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enableAlerts ? "right-1" : "left-1"}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
              <div className="flex flex-col">
                <span className="text-sm font-black text-indigo-900">Ocultar texto al niño</span>
                <span className="text-[10px] font-bold text-gray-400">Solo escuchará el audio</span>
              </div>
              <button
                type="button"
                onClick={() => setHideText(!hideText)}
                className={`w-12 h-6 rounded-full relative transition-all ${hideText ? "bg-amber-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hideText ? "right-1" : "left-1"}`} />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black text-xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isSaving ? "Guardando..." : <><Save /> Guardar Actividad</>}
        </button>
      </div>
    </div>
  );
}
