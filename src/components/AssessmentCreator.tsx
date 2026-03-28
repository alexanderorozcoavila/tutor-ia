"use client";

import { useState } from "react";
import { lmsService, Objective } from "@/lib/lmsService";
import { AssessmentQuestion } from "@/lib/taskService";
import { Plus, Save, X, BookA, DatabaseZap, Loader2 } from "lucide-react";
import { useAlert } from "@/lib/AlertContext";
import { useAuth } from "@/lib/AuthContext";

interface Props {
  objective: Objective;
  onSaved: () => void;
  onCancel: () => void;
}

export function AssessmentCreator({ objective, onSaved, onCancel }: Props) {
  const { showAlert } = useAlert();
  const { user } = useAuth();
  
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessmentTimeLimit, setAssessmentTimeLimit] = useState(0); 
  const [baseText, setBaseText] = useState("");
  const [questionCount, setQuestionCount] = useState(3);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title) return showAlert("Por favor ponle un título a la evaluación.", { type: "info" });
    if (questions.length === 0) return showAlert("Debes añadir al menos una pregunta a la evaluación.", { type: "info" });
    if (!user) return;

    setIsSaving(true);
    try {
      await lmsService.createAssessmentTemplate({
        objective_id: objective.id,
        title,
        time_limit_seconds: assessmentTimeLimit,
        questions,
        created_by: user.id
      });
      showAlert("Plantilla de evaluación guardada con éxito", { type: "success" });
      onSaved();
    } catch (err) {
      console.error(err);
      showAlert("No pudimos guardar la evaluación. Revisa tu conexión.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const generateQuiz = async () => {
    if (!baseText.trim()) return showAlert("Por favor pega o escribe el texto base primero.", { type: "info" });
    setIsGeneratingQuiz(true);
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseText, questionCount })
      });
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      if (data.questions) {
        setQuestions(prev => [...prev, ...data.questions]);
        showAlert("¡Preguntas generadas y añadidas con éxito!", { type: "success" });
        setBaseText("");
      } else {
        throw new Error(data.error || "Desconocido");
      }
    } catch (err) {
      console.error(err);
      showAlert("Ocurrió un error generando las preguntas con IA.", { type: "error" });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const addManualQuestion = () => {
    setQuestions([
      ...questions,
      { id: "man-" + Date.now(), text: "", options: ["", "", ""], correctIndex: 0, explanation: "" }
    ]);
  };

  return (
    <div className="w-full bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-purple-50 animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-8 border-b-2 border-gray-100 pb-4">
        <div>
          <span className="text-purple-600 font-bold uppercase tracking-widest text-xs">Objetivo: {objective.name}</span>
          <h2 className="text-3xl font-black text-gray-900 mt-1">Nueva Evaluación</h2>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-gray-400 transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-8">
        <div className="space-y-2">
          <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Título de Cuestionario</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Prueba Final de Animales Vertebrados"
            className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-purple-300 focus:outline-none font-bold text-gray-800 transition-all text-lg"
          />
        </div>

        <div className="bg-purple-50/50 p-6 rounded-[2rem] border-2 border-purple-100 space-y-8">
          
          {/* MODO IA */}
          <div className="bg-white p-6 rounded-2xl border-2 border-purple-100 shadow-sm space-y-4">
            <h3 className="font-black text-purple-900 flex items-center gap-2">
              <DatabaseZap size={20} className="text-amber-500" /> Auto-Completar con IA Gemini
            </h3>
            <p className="text-sm text-gray-500 font-bold">Pega un texto y Gemini generará el cuestionario completo para el objetivo.</p>
            
            <textarea
              value={baseText}
              onChange={(e) => setBaseText(e.target.value)}
              disabled={isGeneratingQuiz}
              placeholder="Ejemplo: Había una vez un perro azul que vivía en la luna..."
              className="w-full p-4 rounded-xl border-2 border-purple-50 focus:border-purple-300 outline-none h-24 resize-none transition-all disabled:opacity-50"
            />
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-[2] w-full flex items-center justify-between gap-4 bg-purple-50 p-2 px-4 rounded-xl border border-purple-100">
                <label className="text-xs font-black text-purple-800 uppercase">Cantidad de Preguntas a crear:</label>
                <input 
                  type="number" min="1" max="10" value={questionCount} 
                  disabled={isGeneratingQuiz}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 3)}
                  className="w-16 p-2 rounded-lg font-bold text-center border outline-none"
                />
              </div>
              <button
                onClick={generateQuiz}
                disabled={isGeneratingQuiz || !baseText.trim()}
                className="flex-[1] w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGeneratingQuiz ? <Loader2 size={18} className="animate-spin" /> : <BookA size={18} />}
                ¡Magia IA!
              </button>
            </div>
          </div>

          {/* MODO MANUAL / EDITOR DE PREGUNTAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Cuestionario Creado ({questions.length})</h3>
              <button 
                onClick={addManualQuestion}
                className="text-xs font-bold px-4 py-2 bg-white text-purple-600 border-2 border-purple-100 rounded-full hover:bg-purple-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus size={14} /> Añadir Manual
              </button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm relative group space-y-4 transition-all hover:border-purple-200 hover:shadow-md">
                  <button 
                    onClick={() => setQuestions(questions.filter(x => x.id !== q.id))}
                    className="absolute top-4 right-4 text-red-300 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>

                  <div className="flex gap-2 items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</span>
                    <input 
                      value={q.text} 
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[idx].text = e.target.value;
                        setQuestions(newQ);
                      }}
                      placeholder="Escribe la pregunta aquí..."
                      className="flex-1 border-b-2 border-gray-100 focus:border-purple-300 outline-none pb-1 font-bold text-gray-800 text-lg"
                    />
                  </div>

                  <div className="space-y-2 pl-8">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`flex items-center gap-3 p-2 rounded-lg border-2 transition-all ${q.correctIndex === oIdx ? 'border-emerald-200 bg-emerald-50' : 'border-transparent hover:border-gray-50'}`}>
                        <div 
                          onClick={() => {
                            const newQ = [...questions];
                            newQ[idx].correctIndex = oIdx;
                            setQuestions(newQ);
                          }}
                          className={`w-5 h-5 rounded-full cursor-pointer flex items-center justify-center transition-all ${q.correctIndex === oIdx ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                          {q.correctIndex === oIdx && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input 
                          value={opt}
                          onChange={(e) => {
                            const newQ = [...questions];
                            newQ[idx].options[oIdx] = e.target.value;
                            setQuestions(newQ);
                          }}
                          placeholder={`Opción ${oIdx + 1}`}
                          className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-700"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pl-8 pt-2">
                    <input 
                      value={q.explanation}
                      onChange={(e) => {
                         const newQ = [...questions];
                         newQ[idx].explanation = e.target.value;
                         setQuestions(newQ);
                      }}
                      placeholder="Explicación de refuerzo positivo si responde correctamente (Obligatorio)..."
                      className="w-full text-xs p-3 rounded-xl bg-amber-50 text-amber-900 placeholder:text-amber-400 border border-amber-100 outline-none font-medium"
                    />
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center p-12 bg-white/50 border-2 border-dashed border-purple-200 rounded-2xl text-purple-400 font-bold">
                  Usa la IA de arriba o pulsa "Añadir Manualmente" para empezar a nutrir esta prueba.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t-2 border-purple-100">
            <label className="text-xs font-black text-purple-600 uppercase tracking-tighter flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-purple-50">
              Tiempo Límite Global de Evaluación
              <span className={`px-3 py-1 rounded-full text-xs ${assessmentTimeLimit === 0 ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-700'}`}>
                {assessmentTimeLimit === 0 ? "Prueba Sin límite (Libre)" : `${assessmentTimeLimit / 60} minutos`}
              </span>
            </label>
            <input 
              type="range" min="0" max="3600" step="60" value={assessmentTimeLimit} 
              onChange={(e) => setAssessmentTimeLimit(parseInt(e.target.value))}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <p className="text-xs text-gray-400 font-bold text-center">Define cuánto tiempo tendrán los alumnos para responder esta prueba entera en su dashboard.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-5 bg-indigo-900 hover:bg-black text-white rounded-full font-black text-xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <><Save /> Guardar Plantilla en el Repositorio</>}
        </button>
      </div>
    </div>
  );
}
