"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTTS, TTSDiagnostic } from "@/hooks/useTTS";
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

  const { speak, isSpeaking, isLocked, stop: stopTTS, unlock, diagnostic } = useTTS({ cooldownMs: 2000 });
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
    // Reconstruir el JSON completo para no sobrescribir y perder dictation_text en Supabase
    if (taskId) {
      taskService.updateTask(taskId, {
        metadata: {
          dictation_text: initialText,
          config: config,
          progress_index: index
        }
      } as any).catch(err => console.warn("[Progress] Error en DB:", err));
    }
  }, [PROGRESS_KEY, taskId, initialText, config]);

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
  // Estrategia: "Tag-Blind Matching". Construye una Regex por cada frase que permite
  // la existencia opcional de etiquetas HTML entre cada carácter. Esto asegura
  // que el resaltado funcione incluso si el tutor usó negritas o cursivas en
  // medio de una oración.
  const annotateHTML = useCallback((html: string, phrasesArray: string[]): string => {
    let result = html;
    let searchFromIndex = 0;

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    phrasesArray.forEach((phrase, idx) => {
      // Normalizar: colapsar espacios y escapar para Regex
      const normalized = phrase.trim().replace(/\s+/g, ' ');
      if (!normalized) return;

      // Construir patrón "ciego a etiquetas":
      // Cada carácter de la frase puede estar seguido de cero o más etiquetas HTML.
      // Los espacios se tratan como \s+ (uno o más espacios en blanco).
      const pattern = normalized
        .split('')
        .map(char => (char === ' ' ? '\\s+' : escapeRegex(char)))
        .join('(<[^>]+>)*');

      // Buscar la frase a partir de donde quedamos
      const regex = new RegExp(pattern, 'i');
      const fragment = result.slice(searchFromIndex);
      const match = fragment.match(regex);

      if (match && match.index !== undefined) {
        const absolutePos = searchFromIndex + match.index;
        const matchText = match[0];
        const openTag = `<span data-phrase-index="${idx}" class="phrase-span">`;
        const closeTag = `</span>`;

        // Insertar el span alrededor del texto encontrado (que incluye sus etiquetas internas)
        result =
          result.slice(0, absolutePos) +
          openTag +
          matchText +
          closeTag +
          result.slice(absolutePos + matchText.length);

        // Avanzar el puntero para la siguiente frase
        searchFromIndex = absolutePos + openTag.length + matchText.length + closeTag.length;
      }
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

    // Regex estricto: divide por signos de final de oración y pausas gramaticales.
    const grammarTokens = cleanText.split(/(?<=[.,;:!?”])\s+|\n+/);

    const finalPhrases: string[] = [];

    grammarTokens.forEach(token => {
      const trimmed = token.trim();
      if (!trimmed) return;

      const words = trimmed.split(' ');

      // Segmentación estricta: Fragmentos de no más de 8 palabras
      if (words.length > 8) {
        let currentChunk: string[] = [];
        words.forEach(word => {
          currentChunk.push(word);
          if (currentChunk.length === 8) {
            finalPhrases.push(currentChunk.join(' '));
            currentChunk = [];
          }
        });
        if (currentChunk.length > 0) {
          finalPhrases.push(currentChunk.join(' '));
        }
      } else {
        finalPhrases.push(trimmed);
      }
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
    //if (step !== "DICTATING") return;
    if (step !== "DICTATING" || phrases.length === 0) return;

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
  }, [currentIndex, step, phrases]);

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
          // Guardar url / base64 en la nueva columna de bucket
          image_url: finalBase64.split(",")[1] || finalBase64,
          metadata: {
            config: initialConfig, // Mantener config original anidado
            dictation_text: initialText,
            progress_index: currentIndex
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
      // Usar isLocked para candado anti-rebote integral (Audio + 2s cooldown)
      if (step === "DICTATING" && e.code === "Space") {
        e.preventDefault(); // Prevenir el salto nativo de barra espaciadora
        if (!isLocked) {
          // Devolver el foco al documento aunque se haya clickeado un botón
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          handleNext();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, handleNext, isLocked]);

  // Refs para acceder al estado actualizado en handleVoiceCommand sin stale closures
  const handleNextRef = useRef(handleNext);
  const isLockedRef = useRef(isLocked);
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

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
      if (matched && !isLockedRef.current) {
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
      <div className="w-full max-w-5xl mx-auto p-4 flex flex-col gap-6 relative animate-in fade-in duration-500">

        {/* === Banner de diagnóstico TTS === */}
        {(diagnostic.status !== "ok" && diagnostic.status !== "checking") && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🔇</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-red-800 text-sm">
                Sin sonido — El sistema de voz no está disponible
              </p>
              <p className="text-red-600 text-xs mt-1 font-bold">{diagnostic.message}</p>
              {(diagnostic.status === "no-voices" || diagnostic.status === "no-spanish") && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 font-black cursor-pointer hover:text-red-700">Ver instrucciones de instalación ▾</summary>
                  <div className="mt-2 bg-red-900 text-green-300 rounded-xl p-3 font-mono text-xs leading-relaxed">
                    <p className="text-gray-400 mb-1"># Ejecutar en el terminal de Lubuntu:</p>
                    <p>sudo apt install speech-dispatcher \</p>
                    <p>&nbsp;&nbsp;espeak-ng espeak-ng-data \</p>
                    <p>&nbsp;&nbsp;libspeechd2</p>
                    <p className="mt-2 text-gray-400"># Luego reiniciar el navegador</p>
                  </div>
                </details>
              )}
              {diagnostic.status === "error" && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 font-black cursor-pointer hover:text-red-700">Ver instrucciones de diagnóstico ▾</summary>
                  <div className="mt-2 bg-red-900 text-green-300 rounded-xl p-3 font-mono text-xs leading-relaxed">
                    <p className="text-gray-400 mb-1"># Verificar que speech-dispatcher esté activo:</p>
                    <p>speech-dispatcher</p>
                    <p className="mt-1">spd-say -l es "prueba de voz"</p>
                  </div>
                </details>
              )}
            </div>
            <span
              title={`Voces totales: ${diagnostic.totalVoices} | En español: ${diagnostic.spanishVoices}`}
              className="text-[10px] text-red-400 font-black bg-red-100 px-2 py-1 rounded-full flex-shrink-0 cursor-help"
            >
              {diagnostic.totalVoices} voz(ces)
            </span>
          </div>
        )}

        {/* Indicador OK sutil (solo cuando status es ok) */}
        {diagnostic.status === "ok" && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Voz activa: {diagnostic.selectedVoice ?? "sistema"}
          </div>
        )}

        {/* === Barra Superior Anclada: Controles Multimedia Directos === */}
        <div className="sticky top-20 z-[100] bg-white/90 backdrop-blur-xl p-4 md:px-8 rounded-[2rem] shadow-xl shadow-indigo-100/50 border-2 border-indigo-50 flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => speak(phrases[currentIndex])}
              disabled={isSpeaking}
              className="p-4 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              title="Escuchar frase de nuevo"
            >
              <RefreshCcw size={24} />
            </button>
            <div className="h-8 w-px bg-indigo-100 hidden sm:block"></div>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              className={`p-4 rounded-full transition-all shadow-md active:scale-90 ${isRecording ? "bg-red-500 text-white animate-pulse shadow-red-200" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
              title="Mantén para decir: 'Ya copié'"
            >
              {isListening ? <Loader2 className="animate-spin text-blue-600" size={24} /> : <Play size={24} />}
            </button>
          </div>

          <div className="hidden md:flex flex-col items-center">
            <span className="text-xs font-black text-indigo-300 uppercase tracking-widest">Dictado en Progreso</span>
            <div className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Frase {currentIndex + 1} de {phrases.length}
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={isLocked}
            className={`px-8 py-4 rounded-full font-black text-lg shadow-lg active:scale-95 transition-all flex items-center gap-2 ${isLocked ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-80 shadow-none border-2 border-transparent" : "bg-gradient-to-r from-emerald-400 to-green-500 text-white hover:shadow-green-200"}`}
          >
            {isLocked ? (isSpeaking ? "Escucha..." : "Espera...") : "¡Siguiente!"} {!isLocked && <CheckCircle2 size={24} />}
          </button>
        </div>
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

            {/* === VISOR GLOBAL: HTML/Texto enriquecido sin scroll interno ===
                El contenedor ya no tiene max-h ni overflow, crece con el contenido.
                annotateHTML() inyecta data-phrase-index en cada frase para el highlight. */}
            {!config.hideText && initialText && (
              <div className="bg-gray-50 border-2 border-gray-100 rounded-[2rem] p-6 w-full text-lg md:text-xl font-medium text-gray-800 leading-relaxed max-w-none prose prose-indigo">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Texto Activo</p>
                <div className="rich-viewer">
                  {parse(annotateHTML(initialText, phrases))}
                </div>
              </div>
            )}

            {/* Los controles repetidos inferiores se pueden eliminar dado que la botonera anclada superior cumple el propósito principal. 
                Dejaremos un recordatorio de teclado limpio en la parte inferior. */}
            <div className="pt-8 border-t border-gray-100 mt-2 text-center w-full">
              <p className="text-gray-400 font-bold flex flex-wrap items-center justify-center gap-2 text-sm">
                Presiona <kbd className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg border shadow-sm font-sans mx-1">Espacio</kbd>
                o di <span className="text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">"¡Ya copié!"</span> por voz para continuar.
              </p>
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
