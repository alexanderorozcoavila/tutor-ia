"use client";

import { useState } from "react";
import { taskService, TaskType, AssessmentQuestion } from "@/lib/taskService";
import { Plus, BookOpen, Home, Save, X, BookA, Laptop, Tablet, Smartphone, Database, CheckCircle2, ClipboardSignature, Search, Loader2, DatabaseZap } from "lucide-react";
import { useAlert } from "@/lib/AlertContext";
import { RichTextEditor } from "@/components/RichTextEditor";

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
  const [dictationText, setDictationText] = useState(""); // Guardará HTML del editor
  const [mode, setMode] = useState<"LIBRE" | "TEMPORIZADOR">("TEMPORIZADOR");
  const [timeLimit, setTimeLimit] = useState(30);
  const [alertInterval, setAlertInterval] = useState(10);
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [hideText, setHideText] = useState(false);
  const [readingLevel, setReadingLevel] = useState<number>(1);
  const [readingText, setReadingText] = useState("");
  const [supportedDevices, setSupportedDevices] = useState<string[]>(['desktop', 'tablet', 'mobile']);
  const [isSaving, setIsSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // States for Assessment
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessmentTimeLimit, setAssessmentTimeLimit] = useState(0); // 0 = sin límite
  const [baseText, setBaseText] = useState("");
  const [questionCount, setQuestionCount] = useState(3);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const toggleDevice = (dev: string) => {
    setSupportedDevices(prev => {
      if (prev.includes(dev) && prev.length === 1) return prev; // Siempre debe haber al menos uno
      return prev.includes(dev) ? prev.filter(d => d !== dev) : [...prev, dev];
    });
  };

  const READING_LEVELS: Record<number, string> = {
    1: "ma me mi mo mu. pa pe pi po pu.",
    2: "Mi mamá me mima. Ese oso se asea.",
    3: "Había una vez un pequeño perro llamado Toby. Le gustaba correr por el parque y jugar con la pelota.",
    4: "El universo es increíblemente vasto y misterioso. Los planetas orbitan alrededor del sol formando nuestro sistema solar, el cual es solo una pequeña parte de la Vía Láctea."
  };

  const handleLevelChange = (level: number) => {
    setReadingLevel(level);
    setReadingText(READING_LEVELS[level]);
  };

  const handleSave = async () => {
    if (!title) return showAlert("Por favor ponle un título a la tarea.", { type: "info" });
    if (type === "dictation" && !dictationText) return showAlert("El dictado necesita un texto.", { type: "info" });
    if (type === "reading" && !readingText) return showAlert("La actividad de lectura necesita un texto.", { type: "info" });
    if (type === "assessment" && questions.length === 0) return showAlert("Debes añadir al menos una pregunta a la evaluación.", { type: "info" });

    setIsSaving(true);
    let metadata: any = {};
    if (type === "dictation") {
      metadata = {
        dictation_text: dictationText,
        config: {
          mode,
          timeLimit: mode === "TEMPORIZADOR" ? timeLimit : 0,
          alertInterval,
          enableAlerts,
          hideText
        }
      };
    } else if (type === "reading") {
      metadata = {
        reading_text: readingText,
        reading_level: readingLevel
      };
    } else if (type === "assessment") {
      metadata = {
        questions,
        assessment_time_limit: assessmentTimeLimit
      };
    }

    try {
      await taskService.createTask({
        title,
        description,
        type,
        assigned_to: studentId,
        supported_devices: supportedDevices,
        metadata,
      });
      onTaskCreated();
    } catch (err) {
      console.error(err);
      showAlert("No pudimos guardar la tarea. Revisa tu conexión.", { type: "error" });
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
        setBaseText(""); // Limpiar para no re-generar por accidente
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
    <div className="w-full max-w-2xl md:max-w-[90vw] bg-white rounded-[2.5rem] p-8 shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-gray-900">Nueva Actividad</h2>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Selector de Tipo */}
        <div className="flex gap-4 p-2 bg-gray-50 rounded-2xl flex-wrap or overflow-x-auto">
          <button
            onClick={() => setType("dictation")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${type === "dictation" ? "bg-white shadow-md text-blue-600" : "text-gray-400"}`}
          >
            <BookOpen size={20} /> Dictado
          </button>
          <button
            onClick={() => setType("reading")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${type === "reading" ? "bg-white shadow-md text-amber-500" : "text-gray-400"}`}
          >
            <BookA size={20} /> Lectura
          </button>
          <button
            onClick={() => setType("domestic")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${type === "domestic" ? "bg-white shadow-md text-emerald-600" : "text-gray-400"}`}
          >
            <Home size={20} /> Del Hogar
          </button>
          <button
            onClick={() => setType("assessment")}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all ${type === "assessment" ? "bg-white shadow-md text-purple-600" : "text-gray-400"}`}
          >
            <ClipboardSignature size={20} /> Evaluación
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

        <div className="space-y-3">
          <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Dispositivos Permitidos</label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => toggleDevice('desktop')}
              className={`flex-1 py-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${supportedDevices.includes('desktop') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
            >
              <Laptop size={20} /> PC
            </button>
            <button
              type="button"
              onClick={() => toggleDevice('tablet')}
              className={`flex-1 py-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${supportedDevices.includes('tablet') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
            >
              <Tablet size={20} /> Tablet
            </button>
            <button
              type="button"
              onClick={() => toggleDevice('mobile')}
              className={`flex-1 py-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${supportedDevices.includes('mobile') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
            >
              <Smartphone size={20} /> Móvil
            </button>
          </div>
        </div>

        {type === "dictation" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 bg-indigo-50/30 p-6 rounded-[2rem] border-2 border-indigo-100">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Texto para dictar</label>
                <button
                  type="button"
                  onClick={() => setShowRaw(!showRaw)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${showRaw ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white text-gray-400 border border-gray-200 hover:text-indigo-500"}`}
                  title="Ver cómo se guarda en DB"
                >
                  <Database size={12} /> {showRaw ? "Ocultar Código" : "Ver Código"}
                </button>
              </div>
              <RichTextEditor
                content={dictationText}
                onChange={setDictationText}
                placeholder="Escribe aquí el texto que el alumno leerá y transcribirá..."
              />
              
              {showRaw && (
                <div className="mt-4 p-4 bg-gray-900 rounded-2xl border-2 border-indigo-200 shadow-inner overflow-hidden animate-in slide-in-from-top-1 duration-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Storage: metadata.dictation_text</span>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/50" />
                      <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                    </div>
                  </div>
                  <pre className="text-xs font-mono text-indigo-100 whitespace-pre-wrap break-all leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar italic bg-black/30 p-3 rounded-lg border border-white/5">
                    {dictationText || "<!-- El texto aparecerá aquí -->"}
                  </pre>
                </div>
              )}
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

        {type === "reading" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 bg-amber-50/30 p-6 rounded-[2rem] border-2 border-amber-100">
            <div className="space-y-4">
              <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Nivel Sugerido (Opcional)</label>
              <div className="flex gap-2 bg-white p-1 rounded-xl border-2 border-amber-100 overflow-x-auto">
                {[1, 2, 3, 4].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleLevelChange(lvl)}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap px-4 ${readingLevel === lvl ? "bg-amber-500 text-white shadow-md" : "text-gray-400"}`}
                  >
                    Nivel {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-wider">Texto para que el alumno lea</label>
              <textarea
                value={readingText}
                onChange={(e) => setReadingText(e.target.value)}
                placeholder="Escribe aquí el texto a leer, o selecciona un nivel arriba..."
                className="w-full p-4 rounded-2xl border-2 border-amber-100 bg-white focus:border-amber-300 focus:outline-none transition-all h-32 resize-none font-medium text-lg leading-relaxed"
              />
            </div>
          </div>
        )}

        {type === "assessment" && (
          <div className="space-y-6 animate-in slide-in-from-top-2 bg-purple-50/30 p-6 rounded-[2rem] border-2 border-purple-100">
            
            {/* MODO IA */}
            <div className="bg-white p-6 rounded-2xl border-2 border-purple-100 shadow-sm space-y-4">
              <h3 className="font-black text-purple-900 flex items-center gap-2">
                <DatabaseZap size={20} className="text-amber-500" /> Auto-Completar con IA Gemini
              </h3>
              <p className="text-sm text-gray-500 font-bold">Pega un texto y Gemini generará el cuestionario completo para niños.</p>
              
              <textarea
                value={baseText}
                onChange={(e) => setBaseText(e.target.value)}
                disabled={isGeneratingQuiz}
                placeholder="Ejemplo: Había una vez un perro azul que vivía en la luna..."
                className="w-full p-4 rounded-xl border-2 border-purple-50 focus:border-purple-300 outline-none h-24 resize-none transition-all disabled:opacity-50"
              />
              
              <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center gap-4 bg-purple-50 p-2 rounded-xl">
                  <label className="text-xs font-black text-purple-800 uppercase pl-2">Cantidad:</label>
                  <input 
                    type="number" min="1" max="10" value={questionCount} 
                    disabled={isGeneratingQuiz}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value) || 3)}
                    className="w-16 p-2 rounded-lg font-bold text-center border focus:outline-none"
                  />
                </div>
                <button
                  onClick={generateQuiz}
                  disabled={isGeneratingQuiz || !baseText.trim()}
                  className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingQuiz ? <Loader2 size={18} className="animate-spin" /> : <BookA size={18} />}
                  ¡Magia IA!
                </button>
              </div>
            </div>

            {/* MODO MANUAL / EDITOR DE PREGUNTAS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Preguntas ({questions.length})</h3>
                <button 
                  onClick={addManualQuestion}
                  className="text-xs font-bold px-4 py-2 bg-white text-purple-600 border-2 border-purple-100 rounded-full hover:bg-purple-50 transition-all flex items-center gap-2"
                >
                  <Plus size={14} /> Crear Vacía
                </button>
              </div>

              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm relative group space-y-4">
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
                      className="flex-1 border-b-2 border-gray-100 focus:border-purple-300 outline-none pb-1 font-bold text-gray-800"
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
                      placeholder="Explicación de refuerzo positivo (Obligatorio)..."
                      className="w-full text-xs p-3 rounded-xl bg-amber-50 text-amber-900 placeholder:text-amber-300 border border-amber-100 outline-none font-medium"
                    />
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center p-8 bg-white/50 border-2 border-dashed border-purple-200 rounded-2xl text-purple-400 font-bold">
                  No has agregado ninguna pregunta.
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t-2 border-purple-100">
              <label className="text-xs font-black text-purple-600 uppercase tracking-tighter flex justify-between items-center">
                Tiempo Límite de Evaluación
                <span className={`px-2 py-0.5 rounded text-[10px] ${assessmentTimeLimit === 0 ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>
                  {assessmentTimeLimit === 0 ? "Sin límite" : `${assessmentTimeLimit} s`}
                </span>
              </label>
              <input 
                type="range" min="0" max="1800" step="30" value={assessmentTimeLimit} 
                onChange={(e) => setAssessmentTimeLimit(parseInt(e.target.value))}
                className="w-full accent-purple-500"
              />
              <p className="text-[10px] text-gray-400 font-bold text-center">Un límite presiona el envío automático. 0 significa libre de tiempos.</p>
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
