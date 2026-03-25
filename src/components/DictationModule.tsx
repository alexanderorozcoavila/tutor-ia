"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTTS } from "@/hooks/useTTS";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { ImageCapture } from "@/components/ImageCapture";
import { 
  Loader2, BookOpen, PenTool, ArrowRight, 
  CheckCircle2, Timer, RefreshCcw, Settings, 
  Play, StopCircle, BellRing, AlertTriangle 
} from "lucide-react";

type Mode = "LIBRE" | "TEMPORIZADOR";

interface Config {
  mode: Mode;
  timeLimit: number; // segundos por frase
  alertInterval: number; // segundos para alerta de atención
  enableAlerts: boolean;
}

export function DictationModule() {
  const [step, setStep] = useState<"INPUT" | "PROCESSING" | "CONFIG" | "DICTATING" | "EVALUATING" | "FINISHED">("INPUT");
  const [inputText, setInputText] = useState("");
  const [phrases, setPhrases] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<{ success: boolean; message: string; detected_word?: string } | null>(null);
  
  const [config, setConfig] = useState<Config>({
    mode: "LIBRE",
    timeLimit: 30,
    alertInterval: 10,
    enableAlerts: true,
  });

  const { speak, isSpeaking, stop: stopTTS } = useTTS();
  const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecorder();
  const alertTimerRef = useRef<number>(0);

  // Dividir texto en frases por pausas gramaticales
  const processPhrases = (text: string) => {
    // Dividir por puntos, exclamaciones o interrogaciones seguidos de espacio o fin de línea
    // También dividimos por saltos de línea y por comas si la frase es muy larga
    const cleanText = text.trim();
    
    // Regex para dividir por . ! ? \n manteniendo el signo
    const parts = cleanText.split(/(?<=[.!?\n])\s+/);
    
    const finalPhrases: string[] = [];
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      
      // Si una frase es demasiado larga (más de 12 palabras), intentamos dividirla por comas
      if (trimmed.split(/\s+/).length > 12) {
        const subParts = trimmed.split(/(?<=[,;])\s+/);
        finalPhrases.push(...subParts.map(p => p.trim()).filter(p => p.length > 0));
      } else {
        finalPhrases.push(trimmed);
      }
    });

    setPhrases(finalPhrases);
    setStep("CONFIG");
  };

  const handleImageReady = async (base64: string) => {
    setIsProcessing(true);
    setStep("PROCESSING");
    try {
      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: JSON.stringify({ base64Image: base64 }),
      });
      const { text, error } = await res.json();
      if (error) throw new Error(error);
      setInputText(text);
      processPhrases(text);
    } catch (err) {
      console.error(err);
      alert("No pude leer bien la imagen. ¿Podrías intentar de nuevo o escribir el texto?");
      setStep("INPUT");
    } finally {
      setIsProcessing(false);
    }
  };

  const startDictation = () => {
    setStep("DICTATING");
    setCurrentIndex(0);
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
          
          // Alerta de atención cada alertInterval segundos
          if (config.enableAlerts && nextVal % config.alertInterval === 0) {
            setShowAlert(true);
            speak("¡Hola! ¿Cómo vas? Sigamos juntos.");
            setTimeout(() => setShowAlert(false), 3000);
          }

          // Límite de tiempo en modo temporizador
          if (config.mode === "TEMPORIZADOR" && nextVal >= config.timeLimit) {
            handleNext();
            return 0;
          }

          return nextVal;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, config.mode, config.timeLimit, config.alertInterval]);

  // Dictar frase automática al cambiar
  useEffect(() => {
    if (step === "DICTATING" && phrases[currentIndex]) {
      speak(phrases[currentIndex]);
    }
  }, [step, currentIndex, phrases, speak]);

  const handleNext = useCallback(() => {
    console.log("Avanzando a la siguiente frase...");
    stopTTS(); // Detener audio actual si sigue hablando
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setTimer(0);
    } else {
      setStep("FINISHED");
    }
  }, [currentIndex, phrases.length, stopTTS]);

  // Listener para la tecla Espacio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === "DICTATING" && e.code === "Space") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, handleNext]);

  // Lógica de Reconocimiento de Voz para el comando "¡Listo, ya copié!"
  const handleVoiceCommand = useCallback(async (blob: Blob) => {
    setIsListening(true);
    try {
      const formData = new FormData();
      formData.append("file", blob);
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const { text, error } = await res.json();
      if (error) throw new Error(error);

      const normalizedText = text.toLowerCase();
      if (normalizedText.includes("listo") || normalizedText.includes("copié") || normalizedText.includes("continuar") || normalizedText.includes("ya está")) {
        handleNext();
      }
    } catch (err) {
      console.error("Error reconociendo comando:", err);
    } finally {
      setIsListening(false);
    }
  }, [handleNext]);

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
      alert("Hubo un problema evaluando tu dictado. ¡Igual lo hiciste genial!");
      setStep("FINISHED");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "INPUT") {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-[3rem] p-12 shadow-2xl border-4 border-dashed border-indigo-100 flex flex-col items-center gap-10">
          <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-500">
            <BookOpen size={48} />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-black text-gray-900 mb-4">¿Qué vamos a dictar hoy?</h1>
            <p className="text-gray-500 text-lg">Escribe el texto o toma una foto de tu libro favorito.</p>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
            {/* Opción Imagen */}
            <div className="bg-indigo-50/50 p-8 rounded-[2rem] border-2 border-transparent hover:border-indigo-200 transition-all flex flex-col items-center gap-6 group">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <PenTool className="text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-indigo-900">Desde una imagen</h3>
              <p className="text-sm text-indigo-400 text-center">IA leerá el texto por ti.</p>
              <ImageCapture onImageReady={handleImageReady} label="Subir foto del libro" />
            </div>

            {/* Opción Texto */}
            <div className="bg-emerald-50/50 p-8 rounded-[2rem] border-2 border-transparent hover:border-emerald-200 transition-all flex flex-col items-center gap-6 group">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <BookOpen className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-emerald-900">Escribir texto</h3>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escribe aquí las palabras..."
                className="w-full h-24 p-4 rounded-xl border-2 border-emerald-100 focus:border-emerald-300 focus:outline-none text-gray-700 resize-none bg-white"
              />
              <button
                disabled={!inputText.trim()}
                onClick={() => processPhrases(inputText)}
                className="w-full py-4 bg-emerald-500 text-white rounded-full font-bold shadow-lg hover:bg-emerald-600 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                Continuar <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  type="range" min="10" max="60" step="5"
                  value={config.timeLimit}
                  onChange={(e) => setConfig({ ...config, timeLimit: parseInt(e.target.value) })}
                  className="w-full h-3 bg-red-100 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <p className="text-center text-2xl font-black text-red-500">{config.timeLimit}s</p>
              </div>
            )}
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-500 uppercase">Alertas de atención (cada X segundos)</label>
              <input
                type="range" min="5" max="30" step="5"
                value={config.alertInterval}
                onChange={(e) => setConfig({ ...config, alertInterval: parseInt(e.target.value) })}
                className="w-full h-3 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-center text-2xl font-black text-indigo-500">{config.alertInterval}s</p>
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
                <span className={config.mode === "TEMPORIZADOR" && timer > config.timeLimit - 5 ? "text-red-600 animate-pulse" : ""}>
                   {timer}s {config.mode === "TEMPORIZADOR" && `/ ${config.timeLimit}s`}
                </span>
             </div>
          </div>

          <div className="w-full text-center space-y-12">
            <div className="flex flex-wrap justify-center gap-4 text-3xl font-bold leading-relaxed">
              {phrases.map((phrase, idx) => (
                <span 
                  key={idx}
                  className={`
                    px-3 py-1 rounded-xl transition-all duration-500
                    ${idx === currentIndex 
                      ? "text-red-600 bg-red-50 ring-4 ring-red-200 animate-pulse scale-110" 
                      : idx < currentIndex 
                        ? "text-gray-300" 
                        : "text-gray-100 select-none"
                    }
                  `}
                >
                  {phrase}
                </span>
              ))}
            </div>

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
                      className="px-16 py-6 bg-green-500 text-white rounded-full font-black text-3xl shadow-2xl hover:bg-green-600 active:scale-95 transition-all flex items-center gap-4"
                    >
                      ¡Listo, ya copié! <CheckCircle2 size={32} />
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
        </div>
      </div>
    );
  }

  if (step === "EVALUATING") {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-[3rem] p-12 shadow-2xl border-4 border-dashed border-blue-100 flex flex-col items-center gap-10">
          <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500">
            <Camera size={48} />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-black text-gray-900 mb-4">¡Genial! Ahora muéstrame</h1>
            <p className="text-gray-500 text-lg">Tómale una foto a lo que escribiste para que pueda verlo.</p>
          </div>
          <ImageCapture onImageReady={handleEvaluateDictation} label="Subir foto de mi trabajo" />
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
            setStep("INPUT");
            setEvaluationFeedback(null);
          }}
          className="px-12 py-5 bg-blue-500 text-white rounded-full font-extrabold text-2xl shadow-xl hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2"
        >
          <RefreshCcw /> Otro Dictado
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
