"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTTS } from "@/hooks/useTTS";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { taskService } from "@/lib/taskService";
import { settingsService } from "@/lib/settingsService";
import { ImageCapture } from "@/components/ImageCapture";
import { PhraseToast } from "@/components/PhraseToast";
import {
  Loader2,
  CheckCircle2, Timer, RefreshCcw, Settings,
  Play, BellRing
} from "lucide-react";
import { useAlert } from "@/lib/AlertContext";
import parse from "html-react-parser";

type Mode = "LIBRE" | "TEMPORIZADOR";

interface Config {
  mode: Mode;
  timeLimit: number; // segundos por frase
  alertInterval: number; // segundos para alerta de atención
  enableAlerts: boolean;
  hideText?: boolean;
}

interface Props {
  taskId?: string;
  initialText?: string;
  initialConfig?: Config;
  onFinish?: () => void;
}

export function DictationModule({ taskId, initialText, initialConfig, onFinish }: Props) {
  const { showAlert: globalAlert } = useAlert();
  // Calcular el step inicial y el índice inicial antes de montar el estado.
  // Si la tarea tiene texto y config (modo reanudación), leemos el progreso guardado
  // directamente de localStorage aquí — antes del primer render — para que
  // currentIndex nunca sea 0 equivocado al retomar un dictado interrumpido.
  const PROGRESS_KEY_INIT = taskId ? `dictation_progress_${taskId}` : null;
  const savedIndexOnMount = (() => {
    if (!PROGRESS_KEY_INIT || typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(PROGRESS_KEY_INIT);
    return saved ? parseInt(saved, 10) : 0;
  })();

  const [step, setStep] = useState<"PROCESSING" | "CONFIG" | "DICTATING" | "CAPTURING_EVIDENCE" | "FINISHED">(
    initialConfig ? "DICTATING" : "DICTATING"
  );

  const [phrases, setPhrases] = useState<string[]>([]);
  // Si venimos en modo reanudación (initialText + initialConfig), arrancamos desde el índice guardado
  const [currentIndex, setCurrentIndex] = useState(initialText && initialConfig ? savedIndexOnMount : 0);
  const [timer, setTimer] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<{ success: boolean; message: string; detected_word?: string } | null>(null);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [attentionMessage, setAttentionMessage] = useState("¡Hola! ¿Cómo vas? Sigamos juntos.");

  const [config, setConfig] = useState<Config>(initialConfig || {
    mode: "LIBRE",
    timeLimit: 30,
    alertInterval: 10,
    enableAlerts: true,
    hideText: false,
  });

  const { speak, isSpeaking, stop: stopTTS, unlock } = useTTS();
  const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecorder();
  const alertTimerRef = useRef<number>(0);

  // ─── Helpers para persistencia del progreso ──────────────────────────────────
  const PROGRESS_KEY = taskId ? `dictation_progress_${taskId}` : null;

  const loadSavedProgress = useCallback((): number => {
    if (!PROGRESS_KEY || typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? parseInt(saved, 10) : 0;
  }, [PROGRESS_KEY]);

  const saveProgress = useCallback((index: number) => {
    if (!PROGRESS_KEY) return;
    localStorage.setItem(PROGRESS_KEY, String(index));
    // Fire-and-forget hacia Supabase (metadata.progress_index)
    if (taskId) {
      taskService.updateTask(taskId, {
        metadata: { progress_index: index }
      } as any).catch(err => console.warn("[Progress] Error en DB:", err));
    }
  }, [PROGRESS_KEY, taskId]);

  const clearProgress = useCallback(() => {
    if (!PROGRESS_KEY) return;
    localStorage.removeItem(PROGRESS_KEY);
  }, [PROGRESS_KEY]);

  // Al montar en modo reanudación, si hay un progreso guardado, notificarlo visualmente
  // (El currentIndex ya fue inicializado correctamente en useState)
  useEffect(() => {
    if (initialText && initialConfig && savedIndexOnMount > 0) {
      console.info(`[Dictado] Reanudando desde frase ${savedIndexOnMount}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── annotateHTML: inyecta data-phrase-index en el HTML enriquecido ──────────
  // Estrategia: indexOf posicional en lugar de regex para manejar caracteres
  // especiales (¿?¡!, paréntesis, puntos) sin escapado ni falsos negativos.
  // Normaliza espacios múltiples antes de buscar para tolerar variaciones menores.
  const annotateHTML = useCallback((html: string, phrasesArray: string[]): string => {
    let result = html;
    let searchFrom = 0; // puntero que avanza para evitar re-marcar frases ya anotadas

    phrasesArray.forEach((phrase, idx) => {
      // Normalizar la frase a buscar: recortar y colapsar espacios múltiples
      const normalized = phrase.trim().replace(/\s+/g, ' ');
      if (!normalized) return;

      // Buscar a partir de la posición donde quedamos (evita colisiones con frases iguales)
      const pos = result.indexOf(normalized, searchFrom);
      if (pos === -1) return; // frase no encontrada en el HTML — skip silencioso

      const open = `<span data-phrase-index="${idx}" class="phrase-span">`;
      const close = `</span>`;

      result =
        result.slice(0, pos) +
        open +
        result.slice(pos, pos + normalized.length) +
        close +
        result.slice(pos + normalized.length);

      // Avanzar el puntero más allá del span recién insertado
      searchFrom = pos + open.length + normalized.length + close.length;
    });

    return result;
  }, []);


  // Extrae texto plano del HTML usando regex — compatible con SSR, sin necesidad del DOM.
  // Añade un salto de línea después de cada elemento de bloque para que la segmentación
  // por signos de puntuación funcione correctamente frase a frase.
  const htmlToPlainText = (html: string): string => {
    return html
      // Reemplazar cierres de bloques con salto de línea
      .replace(/<\/(p|h[1-6]|li|div|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Eliminar todas las etiquetas HTML restantes
      .replace(/<[^>]+>/g, '')
      // Decodificar entidades HTML comunes
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      // Normalizar múltiples saltos de línea a uno
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  // Dividir texto en frases estricto por oraciones completas
  const processPhrases = (input: string) => {
    // Si el texto viene en HTML, extraemos el texto plano para el TTS
    const isHtml = /<[a-z][\s\S]*>/i.test(input);
    const plainText = isHtml ? htmlToPlainText(input) : input;
    const cleanText = plainText.trim();

    // Regex estricto: divide por signos de final de oración (. ! ? y saltos de línea).
    // Las comas NO se usan para segmentar; el TTS las maneja de forma natural.
    const parts = cleanText.split(/(?<=[.!?])\s+|\n+/);

    const finalPhrases: string[] = [];
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed) finalPhrases.push(trimmed);
    });

    setPhrases(finalPhrases);

    if (initialConfig) {
      // Modo reanudación: saltar directamente al dictado desde el índice guardado.
      // currentIndex ya fue inicializado correctamente en useState (savedIndexOnMount),
      // pero si processPhrases se llama de nuevo (ej: re-render), lo reafirmamos.
      setCurrentIndex(savedIndexOnMount);
      setStep("DICTATING");
    } else {
      setStep("CONFIG");
    }
  };

  useEffect(() => {
    const loadGlobalSettings = async () => {
      const settings = await settingsService.getSettings();
      if (settings.attention_message) {
        setAttentionMessage(settings.attention_message);
      }
    };
    loadGlobalSettings();
  }, []);

  useEffect(() => {
    if (initialText) {
      processPhrases(initialText);
    }
  }, [initialText]);



  const startDictation = () => {
    // unlock() desbloquea el motor TTS con un utterance silencioso (zero-width space).
    // Esto satisface la política de autoplay sin corromper la cola de síntesis.
    unlock();
    const savedIndex = loadSavedProgress();
    setStep("DICTATING");
    setCurrentIndex(savedIndex);
    setTimer(0);
    alertTimerRef.current = 0;
  };

  // Lógica de cronómetro y alertas
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "DICTATING") {
      interval = setInterval(() => {
        setTimer((prev) => {
          const nextVal = prev + 1;

          // Marcar alerta de atención para mostrar el visual
          if (config.enableAlerts && config.alertInterval > 0 && nextVal % config.alertInterval === 0) {
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 3000);
          }

          // Límite de tiempo en modo temporizador (si no es 0)
          if (config.mode === "TEMPORIZADOR" && config.timeLimit > 0 && nextVal >= config.timeLimit) {
            handleNext();
            return 0;
          }

          return nextVal;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, config.mode, config.timeLimit, config.alertInterval]);

  // Alerta de audio separada del intervalo del timer para evitar duplicidad
  useEffect(() => {
    if (step === "DICTATING" && config.enableAlerts && config.alertInterval > 0) {
      if (timer > 0 && timer % config.alertInterval === 0) {
        speak(attentionMessage);
      }
    }
  }, [timer, step, config.enableAlerts, config.alertInterval, speak, attentionMessage]);

  // Dictar frase automática al cambiar
  useEffect(() => {
    if (step === "DICTATING" && phrases[currentIndex]) {
      speak(phrases[currentIndex]);
    }
  }, [step, currentIndex, phrases, speak]);

  // ─── Auto-scroll + Highlight de frase activa ─────────────────────────────────
  // Al cambiar de frase: quita la clase activa de todos los spans anotados,
  // aplica .phrase-active al span correspondiente al índice actual y hace scroll
  // suave para centrar la frase en la pantalla.
  useEffect(() => {
    if (step !== "DICTATING") return;

    // Limpiar highlight previo
    document.querySelectorAll<HTMLElement>(".phrase-span").forEach(el => {
      el.classList.remove("phrase-active");
    });

    // Activar frase actual
    const activeEl = document.querySelector<HTMLElement>(
      `[data-phrase-index="${currentIndex}"]`
    );
    if (activeEl) {
      activeEl.classList.add("phrase-active");
      activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, step]);

  const handleNext = useCallback(() => {
    if (isSpeaking) return; // Bloquear salto si está hablando
    stopTTS();
    const nextIndex = currentIndex + 1;
    if (nextIndex < phrases.length) {
      setCurrentIndex(nextIndex);
      setTimer(0);
      saveProgress(nextIndex); // Persistir progreso en LS + Supabase
    } else {
      clearProgress(); // Limpiar al completar el dictado
      setStep("CAPTURING_EVIDENCE");
    }
  }, [currentIndex, phrases.length, stopTTS, isSpeaking, saveProgress, clearProgress]);

  const handleFinishWithEvidence = async (base64: string) => {
    setIsProcessing(true);

    try {
      // 1. Pipeline de compresión de imágenes WebP antes de DB
      let finalBase64 = base64;
      try {
        const res = await fetch("/api/compress-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image: base64 })
        });
        if (res.ok) {
          const { compressedImage } = await res.json();
          if (compressedImage) finalBase64 = compressedImage;
        }
      } catch (e) {
        console.warn("No se pudo comprimir la imagen, usando original.", e);
      }

      setEvidencePhoto(finalBase64);

      if (taskId) {
        await taskService.updateTask(taskId, {
          status: "completed",
          score: 100,
          // Guardar base64 puro en la nueva columna BYTEA
          image_data: finalBase64.split(",")[1] || finalBase64,
          image_mime_type: 'image/webp',
          metadata: {
            ...initialConfig, // Mantener config original
            dictation_text: initialText
          }
        });
      }
      setStep("FINISHED");
    } catch (err) {
      console.error(err);
      globalAlert("No pudimos guardar tu foto, pero tu trabajo está terminado.", { type: "info" });
      setStep("FINISHED");
    } finally {
      setIsProcessing(false);
    }
  };

  // Actualizar estado de la tarea al finalizar
  useEffect(() => {
    if (step === "FINISHED" && taskId) {
      taskService.updateTask(taskId, {
        status: "completed",
        score: 100 // Por ahora puntaje fijo al terminar
      }).catch(err => console.error("Error al actualizar tarea:", err));
    }
  }, [step, taskId]);

  // Listener para la tecla Espacio — blureamos el elemento activo para que window reciba el evento
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === "DICTATING" && !isSpeaking && e.code === "Space") {
        e.preventDefault();
        // Devolver el foco al documento aunque se haya clickeado un botón
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, handleNext, isSpeaking]);

  // Refs para acceder al estado actualizado en handleVoiceCommand sin stale closures
  const handleNextRef = useRef(handleNext);
  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // Lógica de Reconocimiento de Voz para el comando "¡Listo, ya copié!"
  // Usa refs para evitar stale closures sobre isSpeaking y handleNext
  const handleVoiceCommand = useCallback(async (blob: Blob) => {
    setIsListening(true);
    try {
      const formData = new FormData();
      formData.append("file", blob);
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const { text, error } = await res.json();
      if (error) throw new Error(error);

      const normalizedText = (text || "").toLowerCase();
      const keywords = ["listo", "copié", "copie", "continuar", "siguiente", "ya está", "ya esta", "ya", "ok", "okey"];
      const matched = keywords.some(kw => normalizedText.includes(kw));
      if (matched && !isSpeakingRef.current) {
        handleNextRef.current();
      }
    } catch (err) {
      console.error("Error reconociendo comando:", err);
    } finally {
      setIsListening(false);
    }
  }, []); // Sin dependencias — usa refs para acceder a valores frescos

  useEffect(() => {
    if (audioBlob && step === "DICTATING") {
      handleVoiceCommand(audioBlob);
    }
  }, [audioBlob, step, handleVoiceCommand]);

  const handleEvaluateDictation = async (base64: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/validate-handwriting", {
        method: "POST",
        body: JSON.stringify({
          targetWord: phrases.join(" "), // El texto completo
          base64Image: base64
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvaluationFeedback(data);
      setStep("FINISHED");
    } catch (err) {
      console.error(err);
      setStep("FINISHED");
    } finally {
      setIsProcessing(false);
      // Actualizar progreso en DB
      if (taskId) {
        taskService.updateTask(taskId, {
          status: "completed",
          score: Math.floor(Math.random() * 21) + 80 // Score aleatorio 80-100 para dictado completado
        }).catch(console.error);
      }
    }
  };



  if (step === "PROCESSING") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-25" />
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl relative">
            <Loader2 size={64} className="text-blue-500 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-gray-800">El tutor está leyendo...</h2>
          <p className="text-gray-400 text-lg mt-2">Estamos extrayendo las palabras mágicas.</p>
        </div>
      </div>
    );
  }

  if (step === "CONFIG") {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 animate-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[3rem] p-12 shadow-2xl border-4 border-indigo-100 flex flex-col items-center gap-8">
          <Settings size={48} className="text-indigo-500 animate-spin-slow" />
          <h2 className="text-3xl font-black text-gray-900">Configura tu dictado</h2>

          <div className="w-full space-y-8">
            {/* Selector de Modo */}
            <div className="flex bg-gray-100 p-2 rounded-2xl gap-2">
              <button
                onClick={() => setConfig({ ...config, mode: "LIBRE" })}
                className={`flex-1 py-4 rounded-xl font-bold transition-all ${config.mode === "LIBRE" ? "bg-white shadow-md text-blue-600" : "text-gray-500"}`}
              >
                Modo Libre
              </button>
              <button
                onClick={() => setConfig({ ...config, mode: "TEMPORIZADOR" })}
                className={`flex-1 py-4 rounded-xl font-bold transition-all ${config.mode === "TEMPORIZADOR" ? "bg-white shadow-md text-red-600" : "text-gray-500"}`}
              >
                Modo Temporizador
              </button>
            </div>

            {config.mode === "TEMPORIZADOR" && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-gray-500 uppercase">Tiempo por frase (segundos)</label>
                <input
                  type="range" min="0" max="60" step="5"
                  value={config.timeLimit}
                  onChange={(e) => setConfig({ ...config, timeLimit: parseInt(e.target.value) })}
                  className="w-full h-3 bg-red-100 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <p className="text-center text-2xl font-black text-red-500">
                  {config.timeLimit === 0 ? "Desactivado" : `${config.timeLimit}s`}
                </p>
              </div>
            )}
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-500 uppercase">Alertas de atención (cada X segundos)</label>
              <input
                type="range" min="0" max="30" step="5"
                value={config.alertInterval}
                onChange={(e) => setConfig({ ...config, alertInterval: parseInt(e.target.value) })}
                className="w-full h-3 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-center text-2xl font-black text-indigo-500">
                {config.alertInterval === 0 ? "Desactivado" : `${config.alertInterval}s`}
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl">
              <span className="font-bold text-indigo-900">Activar alertas de atención</span>
              <button
                onClick={() => setConfig({ ...config, enableAlerts: !config.enableAlerts })}
                className={`w-14 h-8 rounded-full transition-all relative ${config.enableAlerts ? "bg-indigo-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.enableAlerts ? "right-1" : "left-1"}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border-2 border-amber-100">
              <div className="flex flex-col">
                <span className="font-black text-amber-900">Modo Ciego (Ocultar texto)</span>
                <span className="text-xs font-bold text-amber-600">El niño solo escuchará el dictado</span>
              </div>
              <button
                onClick={() => setConfig({ ...config, hideText: !config.hideText })}
                className={`w-14 h-8 rounded-full transition-all relative ${config.hideText ? "bg-amber-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.hideText ? "right-1" : "left-1"}`} />
              </button>
            </div>
          </div>

          <button
            onClick={startDictation}
            className="w-full py-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <Play fill="currentColor" /> ¡Empezar Dictado!
          </button>
        </div>
      </div>
    );
  }

  if (step === "DICTATING") {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 flex flex-col gap-8 relative">
        {/* Alerta de Atención */}
        {showAlert && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-12">
            <div className="bg-indigo-500 text-white p-12 rounded-[3rem] shadow-full flex flex-col items-center gap-6 animate-bounce border-8 border-white">
              <BellRing size={80} className="animate-wiggle" />
              <h2 className="text-4xl font-black">¿Cómo vas?</h2>
              <p className="text-2xl">¡Sigamos juntos!</p>
            </div>
          </div>
        )}

        {/* Barra de Progreso */}
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
          <div
            className={`h-full transition-all duration-700 ${config.mode === "TEMPORIZADOR" ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${((currentIndex + 1) / phrases.length) * 100}%` }}
          />
        </div>

        <div className={`bg-white rounded-[4rem] p-16 shadow-2xl border-4 relative overflow-hidden flex flex-col items-center ${config.mode === "TEMPORIZADOR" ? "border-red-50" : "border-blue-50"}`}>

          <div className="flex items-center gap-4 mb-12">
            <span className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest ${config.mode === "TEMPORIZADOR" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
              {config.mode === "TEMPORIZADOR" ? "Modo Temporizador" : "Modo Libre"}
            </span>
            <div className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-600 rounded-full font-bold text-sm">
              <Timer size={16} />
              <span className={config.mode === "TEMPORIZADOR" && config.timeLimit > 0 && timer > config.timeLimit - 5 ? "text-red-600 animate-pulse" : ""}>
                {timer}s {config.mode === "TEMPORIZADOR" && config.timeLimit > 0 && `/ ${config.timeLimit}s`}
              </span>
            </div>
          </div>

          <div className="w-full space-y-8">

            {/* === VISOR GLOBAL: HTML enriquecido sin scroll interno ===
                El contenedor ya no tiene max-h ni overflow, crece con el contenido.
                annotateHTML() inyecta data-phrase-index en cada frase para el highlight. */}
            {!config.hideText && initialText && /<[a-z][\s\S]*>/i.test(initialText) && (
              <div className="bg-gray-50 border-2 border-gray-100 rounded-[2rem] p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Texto Completo (Referencia)</p>
                <div className="rich-viewer">
                  {parse(annotateHTML(initialText, phrases))}
                </div>
              </div>
            )}

            <div className="pt-12 border-t border-gray-50 flex flex-col items-center gap-8">
              <h3 className="text-4xl font-black text-gray-800">¿Ya copiaste esta frase?</h3>

              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => speak(phrases[currentIndex])}
                    className="p-6 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 active:scale-95 transition-all shadow-sm"
                    title="Repetir frase"
                  >
                    <RefreshCcw size={32} />
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={isSpeaking}
                    className={`px-16 py-6 rounded-full font-black text-3xl shadow-2xl transition-all flex items-center gap-4 ${isSpeaking ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-80" : "bg-green-500 text-white hover:bg-green-600 active:scale-95"}`}
                  >
                    {isSpeaking ? "Escuchando..." : "¡Listo, ya copié!"} {!isSpeaking && <CheckCircle2 size={32} />}
                  </button>

                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    className={`p-6 rounded-full transition-all shadow-lg active:scale-90 ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-blue-500 text-white"}`}
                    title="Mantén para hablar"
                  >
                    {isListening ? <Loader2 className="animate-spin" size={32} /> : <Play size={32} />}
                  </button>
                </div>
                <p className="text-gray-400 font-bold flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-gray-100 rounded-md border shadow-sm">Espacio</kbd>
                  o di "¡Listo!" para avanzar
                </p>
              </div>
            </div>
          </div>

          {/* === TOAST: Frase actual flotante (reemplaza el visor de foco estático) === */}
          <PhraseToast
            phrase={phrases[currentIndex] ?? ""}
            phraseIndex={currentIndex}
            total={phrases.length}
            isSpeaking={isSpeaking}
            isHidden={config.hideText}
          />
        </div>
      </div>
    );
  }

  if (step === "CAPTURING_EVIDENCE") {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-[3rem] p-12 shadow-2xl border-4 border-dashed border-emerald-100 flex flex-col items-center gap-10">
          <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500">
            <CheckCircle2 size={48} />
          </div>
          <div className="text-center">
            <h2 className="text-4xl font-black text-gray-900 mb-4">¡Dictado completado!</h2>
            <p className="text-gray-500 text-lg">Ahora toma una foto de lo que escribiste en tu cuaderno.</p>
          </div>
          <div className="w-full max-w-md">
            <ImageCapture onImageReady={handleFinishWithEvidence} label="Tomar foto del cuaderno" />
          </div>
          <button
            onClick={() => setStep("FINISHED")}
            className="text-gray-400 font-bold hover:text-gray-600 transition-colors"
          >
            Omitir y terminar (sin foto)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh] gap-8">
      <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center text-green-500 border-4 border-green-200">
        <CheckCircle2 size={64} />
      </div>
      <div className="max-w-2xl">
        <h1 className="text-5xl font-black text-gray-900 mb-4">
          ¡Felicitaciones!
        </h1>
        <p className="text-2xl text-gray-600">
          Has terminado todo el dictado. El tutor va a revisarlo muy pronto. ¡Qué buen trabajo!
        </p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => {
            if (onFinish) {
              onFinish();
            } else {
              setStep("CONFIG");
              setEvaluationFeedback(null);
            }
          }}
          className="px-12 py-5 bg-blue-500 text-white rounded-full font-extrabold text-2xl shadow-xl hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2"
        >
          <RefreshCcw /> {onFinish ? "Volver a Tareas" : "Otro Dictado"}
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="px-12 py-5 bg-gray-200 text-gray-700 rounded-full font-extrabold text-2xl shadow-md hover:bg-gray-300 transition-all active:scale-95"
        >
          Ir al Inicio
        </button>
      </div>
    </div>
  );
}
