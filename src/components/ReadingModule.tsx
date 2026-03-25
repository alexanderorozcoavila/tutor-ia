"use client";

import { useState, useEffect, useRef } from "react";
import { Task, taskService } from "@/lib/taskService";
import { useTTS } from "@/hooks/useTTS";
import { useSession } from "@/components/SessionProvider";
import { ProgressBar } from "@/components/ProgressBar";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAlert } from "@/lib/AlertContext";
import { Loader2, Mic, Volume2, Star, CheckCircle2, BookOpen } from "lucide-react";

interface Props {
  task: Task;
  onFinish: () => void;
}

export function ReadingModule({ task, onFinish }: Props) {
  const { showAlert } = useAlert();
  const { speak, isSpeaking } = useTTS();
  const { addXP } = useSession();
  const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecorder();

  const [state, setState] = useState<"INSTRUCTING" | "WAITING_PRESS" | "RECORDING" | "PROCESSING" | "FEEDBACK">("INSTRUCTING");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);

  const textToRead = task.metadata.reading_text || "Texto no configurado";

  // Prevent multiple calls to instruction
  const hasInstructed = useRef(false);

  useEffect(() => {
    if (!hasInstructed.current) {
      hasInstructed.current = true;
      speak("¡A leer! Mantén presionado el botón gigante azul mientras lees el texto de la pantalla. Suéltalo cuando termines.");
    }
  }, [speak]);

  useEffect(() => {
    if (state === "INSTRUCTING" && !isSpeaking) {
      setState("WAITING_PRESS");
    }
  }, [state, isSpeaking]);

  useEffect(() => {
    const processAudio = async (blob: Blob) => {
      setState("PROCESSING");
      try {
        // 1. Transcribir Audio
        const formData = new FormData();
        formData.append("file", blob);
        
        const resTranscribe = await fetch("/api/transcribe", { method: "POST", body: formData });
        const { text, error } = await resTranscribe.json();
        
        if (error) throw new Error(error);

        if (!text || text.trim().length === 0) {
          throw new Error("No pude escuchar nada, ¡intenta leer un poco más fuerte!");
        }

        // 2. Validar con IA (Gemini)
        const resValidate = await fetch("/api/validate-reading", {
          method: "POST",
          body: JSON.stringify({ targetText: textToRead, transcribedText: text }),
        });
        const evalData = await resValidate.json();

        if (evalData.error) throw new Error(evalData.error);

        setFeedback(evalData.message);
        setScore(evalData.score);
        setState("FEEDBACK");
        speak(evalData.message);
        
        if (evalData.score >= 50) {
          addXP(20); // 20 XP por esfuerzo lector
          await taskService.updateTask(task.id, { status: "completed", score: evalData.score, reason_not_done: "Lectura evaluada por IA" });
        } else {
          await taskService.updateTask(task.id, { status: "failed", score: evalData.score, reason_not_done: "La lectura tuvo muchos errores." });
        }

      } catch (err: any) {
        console.error(err);
        const limitMessage = err.message || "Vaya, se me tapó un oído mágico. ¡Intentémoslo de nuevo!";
        setFeedback(limitMessage);
        setState("FEEDBACK");
        speak(limitMessage);
        await taskService.updateTask(task.id, { status: "failed", reason_not_done: limitMessage });
      }
    };

    if (audioBlob && state === "RECORDING") {
      processAudio(audioBlob);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob]);


  const handlePressStart = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (state !== "WAITING_PRESS" && state !== "FEEDBACK") return; // Permitir reintento
    setState("RECORDING");
    startRecording();
  };

  const handlePressEnd = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (state === "RECORDING") {
      stopRecording();
      // El useEffect detectará el audioBlob y pasará a PROCESSING
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 md:gap-8 max-w-4xl mx-auto py-4 md:py-12 px-2 md:px-4 select-none touch-none overflow-hidden h-full">
      <ProgressBar />
      
      <div className="bg-white/90 backdrop-blur-md p-4 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border-4 border-amber-50 flex flex-col items-center gap-4 md:gap-10 w-full flex-grow md:min-h-[500px]">
        
        {/* Etiqueta y Título */}
        <div className="flex flex-col items-center gap-2 w-full shrink-0">
          <div className="px-4 py-1.5 md:px-6 md:py-2 bg-amber-100 text-amber-600 rounded-full font-bold text-[10px] md:text-sm uppercase tracking-widest flex items-center gap-2">
            <BookOpen size={14} /> ¡A Leer!
          </div>
          <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight text-center truncate w-full">
            {task.title}
          </h2>
        </div>

        {/* Zona del Texto Gigante */}
        <div className="w-full bg-amber-50/50 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 border-amber-100 shadow-inner flex shrink-0 items-center justify-center h-[20vh] md:min-h-[150px] overflow-y-auto">
          <p 
            className="font-black text-center text-gray-800 leading-tight md:leading-relaxed mx-auto w-full break-words"
            style={{ fontFamily: "'Comic Neue', 'Arial Rounded MT Bold', sans-serif", fontSize: 'clamp(1.2rem, 4vh, 2.5rem)' }}
          >
            {textToRead}
          </p>
        </div>

        {/* Zona de Interacción Central */}
        <div className="w-full flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 shrink-0 h-[30vh]">
          
          {state === "PROCESSING" && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
              <Loader2 size={64} className="text-amber-500 animate-spin" />
              <p className="text-2xl font-black text-amber-600">Escuchando atentamente...</p>
            </div>
          )}

          {(state === "WAITING_PRESS" || state === "RECORDING") && (
            <div className="flex flex-col items-center gap-4 animate-in pt-4">
              <div className="relative">
                {state === "RECORDING" && (
                  <div className="absolute inset-0 bg-red-400 rounded-[3rem] animate-ping opacity-30" />
                )}
                <button
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  disabled={state !== "WAITING_PRESS" && state !== "RECORDING"}
                  className={`
                    relative w-40 h-24 md:w-64 md:h-40 rounded-[2rem] md:rounded-[3rem] shadow-[0_8px_0_0_rgba(0,0,0,0.1)] transition-all flex flex-col items-center justify-center gap-1 md:gap-2 select-none mx-auto
                    ${state === "RECORDING" 
                      ? "bg-red-500 hover:bg-red-600 text-white translate-y-2 shadow-[0_2px_0_0_rgba(0,0,0,0.1)] scale-95" 
                      : "bg-blue-500 hover:bg-blue-600 text-white hover:translate-y-1 hover:shadow-[0_6px_0_0_rgba(0,0,0,0.1)] active:translate-y-2 active:shadow-[0_2px_0_0_rgba(0,0,0,0.1)] cursor-pointer"
                    }
                  `}
                >
                  <Mic size={36} className={`md:w-12 md:h-12 ${state === "RECORDING" ? "animate-pulse" : ""}`} />
                  <span className="font-black text-sm md:text-xl uppercase tracking-wider text-center px-4 leading-tight">
                    {state === "RECORDING" ? "¡Habla!" : "Pulsar y Leer"}
                  </span>
                </button>
              </div>
              <p className="text-gray-400 font-bold max-w-[250px] text-center mt-2 text-xs md:text-base leading-tight">
                {state === "RECORDING" 
                  ? "Suelta el botón cuando termines la lectura." 
                  : "Mantén tu dedo sobre el botón mientras lees."}
              </p>
            </div>
          )}

          {state === "FEEDBACK" && (
            <div className="flex flex-col items-center gap-4 md:gap-8 w-full animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 md:gap-6 bg-emerald-50 w-full p-4 md:p-8 rounded-[2rem] border-4 border-emerald-200 shadow-xl max-h-[160px] overflow-y-auto">
                <div className="p-3 bg-white rounded-2xl shadow-sm relative shrink-0 hidden md:block">
                  <Volume2 size={32} className="text-emerald-500 animate-pulse" />
                  {score >= 80 && <Star size={20} className="text-yellow-400 absolute -top-3 -right-3 fill-yellow-400 animate-bounce" />}
                </div>
                <div className="w-full">
                  <p className="text-lg md:text-3xl font-black text-gray-800 leading-tight md:leading-tight mb-2">
                    {feedback}
                  </p>
                  <div className="flex items-center gap-2">
                     <div className="flex-1 h-2 md:h-3 bg-gray-200 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: `${score}%` }} />
                     </div>
                     <span className="text-emerald-600 font-black text-xs md:text-sm">{score}%</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-row md:gap-4 gap-2 w-full justify-center mt-2 shrink-0">
                {score < 80 && (
                  <button
                    onClick={() => setState("WAITING_PRESS")}
                    className="flex-1 max-w-[160px] py-3 md:px-8 md:py-5 font-black text-sm md:text-xl rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200"
                  >
                    Reintentar
                  </button>
                )}
                <button
                  onClick={onFinish}
                  className="flex-1 max-w-[200px] py-3 md:px-10 md:py-5 font-black text-base md:text-2xl rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-2"
                >
                  Siguiente ➡️
                </button>
              </div>
            </div>
          )}

          {state === "INSTRUCTING" && (
            <div className="flex flex-col items-center gap-6 animate-pulse pt-4">
              <div className="w-24 h-24 bg-amber-100 rounded-[2rem] flex items-center justify-center shadow-inner">
                 <Volume2 size={48} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-amber-600 text-center px-4">El tutor te está explicando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
