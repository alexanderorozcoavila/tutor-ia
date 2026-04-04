"use client";

import { useState, useEffect } from "react";
import { taskService, TaskType } from "@/lib/taskService";
import { 
  CheckCircle2, Clock, BookOpen, 
  Home, Star, Settings, Plus, X,
  ChevronRight, AlertCircle, Loader2, DatabaseZap,
  Laptop, Tablet, Smartphone, MonitorX, Camera, ImageIcon,
  BookA, Save, Database, Calendar
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/lib/AuthContext";
import { planService, PlanSemanal, evalEstadoLMS } from "@/lib/planService";
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

  const { user } = useAuth();
  const [availablePlans, setAvailablePlans] = useState<PlanSemanal[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [planDays, setPlanDays] = useState<number[]>([]);
  const [selectedJornada, setSelectedJornada] = useState<string | null>(null); // null = Flexible

  useEffect(() => {
    if (user && studentId) {
      planService.getAllPlanesSemana(studentId).then(planes => {
        // Filtrar solo planes activos o futuros (descartar expirados)
        const validPlanes = planes.filter(p => evalEstadoLMS(p.fecha_inicio) !== 'expired');
        setAvailablePlans(validPlanes);
        // Preseleccionar el plan activo si existe por confort
        const active = validPlanes.find(p => evalEstadoLMS(p.fecha_inicio) === 'active');
        if (active) setSelectedPlanIds([active.id]);
      }).catch(err => console.error("Error fetching plans:", err));
    }
  }, [user, studentId]);

  const togglePlan = (id: string) => {
    setSelectedPlanIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleDay = (d: number) => {
    setPlanDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

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
    }

    try {
      const createdTask = await taskService.createTask({
        title,
        description,
        type,
        assigned_to: studentId,
        supported_devices: supportedDevices,
        metadata,
      });

      if (selectedPlanIds.length > 0 && planDays.length > 0 && studentId) {
        await Promise.all(
          selectedPlanIds.map(planId => 
            planService.cloneTaskToPlan(
              planId, 
              createdTask.id, 
              type, 
              studentId, 
              planDays, 
              10, // 10 puntos por defecto
              selectedJornada
            )
          )
        );
      }

      onTaskCreated();
    } catch (err) {
      console.error(err);
      showAlert("No pudimos guardar la tarea. Revisa tu conexión.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
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

        {availablePlans.length > 0 && (
          <div className="space-y-4 animate-in slide-in-from-top-2 bg-emerald-50/30 p-6 rounded-[2rem] border-2 border-emerald-100">
            <label className="text-sm font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={18} className="text-emerald-500" /> Programar en Plan Semanal
            </label>
            
            <div className="space-y-3 mb-6">
              <p className="text-xs text-emerald-600 font-bold">1. Selecciona los planes destino:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availablePlans.map(plan => {
                  const estado = evalEstadoLMS(plan.fecha_inicio);
                  const isSelected = selectedPlanIds.includes(plan.id);
                  return (
                    <label 
                      key={plan.id}
                      className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-100 bg-white hover:border-emerald-300'}`}
                    >
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePlan(plan.id)}
                        className="w-5 h-5 accent-emerald-500 rounded text-emerald-600"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-800">{plan.recompensa_nombre}</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                           {estado === 'active' ? 'Esta Semana' : 'Semana Futura'} • Inicia: {new Date(plan.fecha_inicio).toLocaleDateString()}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {selectedPlanIds.length > 0 ? (
              <>
                <div className="pt-4 border-t border-emerald-100">
                  <p className="text-xs text-emerald-600 mb-2 font-bold">2. Selecciona los días de aparición automática:</p>
                  <div className="flex gap-2 flex-wrap">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`px-4 py-2 rounded-xl font-bold transition-all ${
                          planDays.includes(i) 
                            ? 'bg-emerald-500 text-white shadow-md' 
                            : 'bg-white text-gray-400 border-2 border-emerald-100 hover:bg-emerald-50'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-emerald-100">
                  <p className="text-xs text-indigo-600 mb-2 font-bold">3. Selecciona la jornada (horario):</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: null, label: "Flexible", emoji: "🔄", color: "bg-gray-100 text-gray-500", active: "bg-gray-500 text-white" },
                      { key: "08:00:00", label: "Mañana", emoji: "🌅", color: "bg-amber-50 text-amber-600 border-amber-100", active: "bg-amber-400 text-white" },
                      { key: "14:00:00", label: "Tarde", emoji: "☀️", color: "bg-orange-50 text-orange-600 border-orange-100", active: "bg-orange-400 text-white" },
                      { key: "20:00:00", label: "Noche", emoji: "🌙", color: "bg-indigo-50 text-indigo-600 border-indigo-100", active: "bg-indigo-500 text-white" },
                    ].map((j) => (
                      <button
                        key={j.label || 'flex'}
                        type="button"
                        onClick={() => setSelectedJornada(j.key)}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all border-2 ${
                          selectedJornada === j.key 
                            ? j.active 
                            : `${j.color} hover:bg-opacity-80`
                        }`}
                      >
                        <span>{j.emoji}</span>
                        <span>{j.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
               <p className="text-xs text-amber-600 italic font-bold">Selecciona al menos un plan arriba para programar días.</p>
            )}
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
