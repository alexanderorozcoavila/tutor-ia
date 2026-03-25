"use client";

import { useState, useRef, useCallback } from "react";
import { useAlert } from "@/lib/AlertContext";

export function useAudioRecorder() {
  const { showAlert } = useAlert();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setAudioBlob(null);

      // En Safari iOS, audio/webm a menudo falla. Vamos a dejar que el navegador elija su formato óptimo (mp4, ogg, etc.)
      const options = MediaRecorder.isTypeSupported('audio/webm') 
        ? { mimeType: 'audio/webm' } 
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = options?.mimeType || mediaRecorder.mimeType || 'audio/mp4'; // Fallback heurístico para envíos
        const audioBlob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (error) {
      console.error("Error al acceder al micrófono:", error);
      setIsRecording(false);
      showAlert("Por favor habilita el acceso al micrófono para que el tutor te escuche.", { type: "info" });
    }
  }, [showAlert]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return { isRecording, startRecording, stopRecording, audioBlob };
}
