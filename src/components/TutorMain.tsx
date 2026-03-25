"use client";

import { useState, useEffect } from "react";
import { useTTS } from "@/hooks/useTTS";
import { useSession } from "@/components/SessionProvider";
import { INITIAL_EXERCISES, Exercise } from "@/data/exercises";
import { AudioRecorder } from "@/components/AudioRecorder";
import { HandwritingCapture } from "@/components/HandwritingCapture";
import { ProgressBar } from "@/components/ProgressBar";
import { Loader2, Sparkles, Volume2 } from "lucide-react";

export function TutorMain() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<"START" | "INSTRUCTING" | "WAITING" | "PROCESSING" | "FEEDBACK">("START");
  const [feedback, setFeedback] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { speak, isSpeaking } = useTTS();
  const { addXP, isSessionActive } = useSession();
  
  const currentExercise = INITIAL_EXERCISES[currentIndex];

  // Iniciar el tutor al presionar "Comenzar"
  const startTutor = () => {
    setState("INSTRUCTING");
    speak(`¡Hola! Soy tu tutor de aventuras. ${currentExercise.instruction}`);
  };

  // Cuando la IA deja de hablar la instrucción, esperamos la acción del niño
  useEffect(() => {
    if (state === "INSTRUCTING" && !isSpeaking) {
      setState("WAITING");
    }
  }, [state, isSpeaking]);

  const handleAudioReady = async (blob: Blob) => {
    setState("PROCESSING");
    try {
      // 1. Transcribir audio con Groq/Whisper
      const formData = new FormData();
      formData.append("file", blob);
      
      const resTranscribe = await fetch("/api/transcribe", { method: "POST", body: formData });
      const { text, error } = await resTranscribe.json();
      
      if (error) throw new Error(error);

      // 2. Validar con Gemini
      const resValidate = await fetch("/api/validate-speech", {
        method: "POST",
        body: JSON.stringify({ targetWord: currentExercise.word, transcribedText: text }),
      });
      const { status, tutor_message } = await resValidate.json();

      setFeedback(tutor_message);
      setIsSuccess(status === "success");
      setState("FEEDBACK");
      speak(tutor_message);
      
      if (status === "success") {
        addXP(10);
      }
    } catch (err) {
      console.error(err);
      const msg = "Vaya, parece que hubo un problemita técnico. ¿Lo intentamos de nuevo?";
      setFeedback(msg);
      setState("FEEDBACK");
      speak(msg);
    }
  };

  const handleImageReady = async (base64: string) => {
    setState("PROCESSING");
    try {
      const res = await fetch("/api/validate-handwriting", {
        method: "POST",
        body: JSON.stringify({ targetWord: currentExercise.word, base64Image: base64 }),
      });
      const { success, message } = await res.json();
      
      setFeedback(message);
      setIsSuccess(success);
      setState("FEEDBACK");
      speak(message);
      
      if (success) {
        addXP(20); // Caligrafía da más puntos porque es más difícil
      }
    } catch (err) {
      console.error(err);
      const msg = "Me costó un poquito ver tu dibujo. ¿Podrías sacar otra foto?";
      setFeedback(msg);
      setState("FEEDBACK");
      speak(msg);
    }
  };

  const nextExercise = () => {
    if (currentIndex < INITIAL_EXERCISES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setState("INSTRUCTING");
      // El useEffect se encargará de dar la nueva instrucción
    } else {
      // Fin del set de ejercicios (podría loopear o mostrar resumen)
      setCurrentIndex(0);
      setState("START");
    }
  };

  // Efecto para dar instrucción al cambiar de ejercicio
  useEffect(() => {
    if (state === "INSTRUCTING" && currentIndex > 0) {
      speak(currentExercise.instruction);
    }
  }, [currentIndex]);

  if (state === "START") {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-blue-50 rounded-3xl border-4 border-dashed border-blue-200 shadow-xl">
        <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center shadow-inner mb-8">
          <Sparkles size={80} className="text-yellow-400 animate-bounce" />
        </div>
        <h1 className="text-4xl font-black text-blue-700 text-center mb-4">¡Bienvenido a tu aventura de hoy!</h1>
        <p className="text-xl text-blue-500 mb-8 max-w-sm text-center">Presiona el botón para despertar a tu tutor y comenzar a jugar.</p>
        <button
          onClick={startTutor}
          className="px-12 py-5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-2xl rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          ¡Comenzar!
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-8 max-w-4xl mx-auto py-12">
      <ProgressBar />
      
      <div className="bg-white/80 backdrop-blur-md p-12 rounded-[3rem] shadow-2xl border-2 border-indigo-100 flex flex-col items-center gap-10 w-full min-h-[500px] justify-center text-center">
        
        {/* Visual de la Actividad */}
        <div className="flex flex-col items-center gap-2">
          <div className="px-6 py-2 bg-indigo-100 text-indigo-600 rounded-full font-bold text-sm uppercase tracking-widest">
            {currentExercise.type === "reading" ? "¡A leer!" : "¡A escribir!"}
          </div>
          <h2 className="text-7xl font-black text-indigo-900 tracking-tight mt-4">
            {currentExercise.word}
          </h2>
        </div>

        {/* Zona de Interacción Variable */}
        <div className="w-full min-h-[150px] flex items-center justify-center">
          {state === "PROCESSING" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={64} className="text-blue-500 animate-spin" />
              <p className="text-xl font-medium text-blue-400">Analizando...</p>
            </div>
          )}

          {state === "WAITING" && currentExercise.type === "reading" && (
            <AudioRecorder onAudioReady={handleAudioReady} isProcessing={false} />
          )}

          {state === "WAITING" && currentExercise.type === "writing" && (
            <HandwritingCapture onImageReady={handleImageReady} />
          )}

          {state === "FEEDBACK" && (
            <div className="flex flex-col items-center gap-8 px-6 animate-in fade-in zoom-in duration-500">
              <div className="flex items-center gap-4 bg-yellow-50 p-6 rounded-3xl border-2 border-yellow-200">
                <Volume2 size={40} className="text-yellow-600 animate-pulse" />
                <p className="text-2xl font-bold text-gray-800 leading-tight">
                  {feedback}
                </p>
              </div>
              
              <button
                onClick={isSuccess ? nextExercise : () => setState("WAITING")}
                className={`
                  px-10 py-5 font-black text-2xl rounded-full shadow-lg transition-all hover:scale-105 active:scale-95
                  ${isSuccess 
                    ? "bg-green-500 text-white hover:bg-green-600" 
                    : "bg-orange-500 text-white hover:bg-orange-600"
                  }
                `}
              >
                {isSuccess ? "¡Siguienteaventura! ➡️" : "¡Lo intento de nuevo! 🔄"}
              </button>
            </div>
          )}

          {state === "INSTRUCTING" && (
            <div className="flex flex-col items-center gap-6 animate-pulse">
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center">
                 <Volume2 size={48} className="text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-indigo-800">Escucha al tutor...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
