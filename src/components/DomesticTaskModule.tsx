"use client";

import { useState } from "react";
import { Task, taskService } from "@/lib/taskService";
import { CheckCircle2, AlertCircle, ArrowLeft, Loader2, Home, Camera, X } from "lucide-react";
import { useAlert } from "@/lib/AlertContext";
import { ImageCapture } from "@/components/ImageCapture";

interface Props {
  task: Task;
  onBack: () => void;
}

export function DomesticTaskModule({ task, onBack }: Props) {
  const { showAlert } = useAlert();
  const [isFinishing, setIsFinishing] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null);

  const handleComplete = async () => {
    setIsFinishing(true);
    try {
      await taskService.updateTask(task.id, { 
        status: "completed", 
        score: 50,
        metadata: {
          ...task.metadata,
          evidence: evidenceImage
        }
      });
      onBack();
    } catch (err) {
      console.error(err);
      showAlert("Error al guardar el progreso.", { type: "error" });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleFail = async () => {
    if (!reason) return showAlert("Por favor dinos por qué no pudiste hacerla.", { type: "info" });
    setIsFinishing(true);
    try {
      await taskService.updateTask(task.id, { 
        status: "failed", 
        reason_not_done: reason 
      });
      onBack();
    } catch (err) {
      console.error(err);
      showAlert("Error al guardar el progreso.", { type: "error" });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[4rem] p-12 shadow-2xl border-4 border-emerald-50 relative overflow-hidden flex flex-col items-center">
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 p-3 hover:bg-emerald-50 rounded-full text-emerald-500 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mb-8">
          <Home size={48} />
        </div>

        <h2 className="text-4xl font-black text-gray-900 text-center mb-2">{task.title}</h2>
        <p className="text-xl text-gray-400 text-center mb-8">{task.description || "¡Vamos a trabajar juntos en esta tarea!"}</p>

        {!showReasonInput && (
          <div className="w-full mb-10 p-6 bg-emerald-50/50 rounded-[2.5rem] border-2 border-dashed border-emerald-100 flex flex-col items-center gap-4">
            {evidenceImage ? (
              <div className="relative w-full aspect-video rounded-3xl overflow-hidden border-4 border-white shadow-lg">
                <img src={evidenceImage} alt="Evidencia" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setEvidenceImage(null)}
                  className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                  <Camera size={32} />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-emerald-900 italic">¿Quieres mostrar cómo quedó?</h3>
                  <p className="text-sm text-emerald-400">Toma una foto de tu tarea terminada</p>
                </div>
                <ImageCapture onImageReady={(base64) => setEvidenceImage(base64)} label="Tomar foto de evidencia" />
              </div>
            )}
          </div>
        )}

        {!showReasonInput ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
            <button
              onClick={handleComplete}
              disabled={isFinishing}
              className="flex flex-col items-center gap-4 p-8 bg-emerald-500 text-white rounded-[2.5rem] shadow-xl hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 size={48} />
              <span className="text-2xl font-black italic">¡Ya terminé!</span>
            </button>

            <button
              onClick={() => setShowReasonInput(true)}
              disabled={isFinishing}
              className="flex flex-col items-center gap-4 p-8 bg-white text-orange-500 border-4 border-orange-100 rounded-[2.5rem] hover:bg-orange-50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <AlertCircle size={48} />
              <span className="text-2xl font-black italic">No puedo hacerla</span>
            </button>
          </div>
        ) : (
          <div className="w-full space-y-6 animate-in zoom-in-95">
            <div className="space-y-4">
              <label className="text-lg font-bold text-gray-500">¿Qué pasó, amiguito?</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: No alcanzo el estante, está muy pesado..."
                className="w-full p-6 rounded-3xl border-4 border-gray-100 focus:border-orange-200 outline-none h-32 resize-none transition-all"
              />
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowReasonInput(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-full font-bold hover:bg-gray-200 transition-all"
              >
                Volver
              </button>
              <button
                onClick={handleFail}
                disabled={isFinishing}
                className="flex-[2] py-4 bg-orange-500 text-white rounded-full font-black text-lg hover:bg-orange-600 shadow-lg transition-all"
              >
                {isFinishing ? <Loader2 className="animate-spin mx-auto" /> : "Enviar motivo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
