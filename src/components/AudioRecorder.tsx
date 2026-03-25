"use client";

import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Mic, Square, Loader2 } from "lucide-react";
import { useEffect } from "react";

interface Props {
  onAudioReady: (blob: Blob) => void;
  isProcessing?: boolean;
}

export function AudioRecorder({ onAudioReady, isProcessing }: Props) {
  const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecorder();

  // Cuando el audioBlob está listo, notificamos al padre
  useEffect(() => {
    if (audioBlob) {
      onAudioReady(audioBlob);
    }
  }, [audioBlob, onAudioReady]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {/* Efecto de pulso cuando graba */}
        {isRecording && (
          <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-25" />
        )}
        
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`
            relative flex items-center justify-center w-32 h-32 rounded-full shadow-2xl transition-all active:scale-95 disabled:opacity-50
            ${isRecording 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-blue-500 hover:bg-blue-600 text-white"
            }
          `}
        >
          {isProcessing ? (
            <Loader2 size={48} className="animate-spin" />
          ) : isRecording ? (
            <Square size={48} fill="currentColor" />
          ) : (
            <Mic size={48} fill="currentColor" />
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold text-gray-700">
          {isProcessing 
            ? "El tutor está pensando..." 
            : isRecording 
              ? "¡Te escucho! Habla ahora..." 
              : "Presiona para hablar"}
        </p>
        <p className="text-blue-500 font-medium mt-1">
          {!isRecording && !isProcessing && "¡Di la palabra en voz alta!"}
        </p>
      </div>
    </div>
  );
}
