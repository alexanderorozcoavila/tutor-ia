"use client";

import { useState, useCallback, useEffect } from "react";

interface TTSOptions {
  pitch?: number;
  rate?: number;
  lang?: string;
}

export function useTTS(options: TTSOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load voices securely
  useEffect(() => {
    const handleVoicesChanged = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    
    // Initial fetch
    setVoices(window.speechSynthesis.getVoices());
    
    // Fallback for async voices loaded (e.g., Chrome)
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        console.warn("La síntesis de voz no está soportada en este navegador.");
        return;
      }

      // window.speechSynthesis.cancel(); // Solo cancelar si es estrictamente necesario o usar un flag

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Intentar obtener voces actualizadas si el estado local está vacío
      let currentVoices = voices;
      if (currentVoices.length === 0) {
        currentVoices = window.speechSynthesis.getVoices();
      }

      // Select Spanish voice
      const spanishVoices = currentVoices.filter(v => v.lang.startsWith("es"));
      const selectedVoice = spanishVoices.find(v => v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Mónica") || v.name.includes("Helena")) || spanishVoices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.pitch = options.pitch ?? 1.1;
      utterance.rate = options.rate ?? 0.85;
      utterance.lang = options.lang ?? "es-ES";

      const handleEnd = () => setIsSpeaking(false);
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = handleEnd;
      utterance.onerror = (e) => {
        console.error("Error en TTS:", e);
        setIsSpeaking(false);
        // Si el error es 'interrupted', a veces es normal por cancel()
      };

      // Algunas versiones de Chrome necesitan esto para no pausarse en frases largas
      const resumeInfinity = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(resumeInfinity);
        }
      }, 10000);

      window.speechSynthesis.speak(utterance);
    },
    [voices, options.pitch, options.rate, options.lang]
  );

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stop, isSpeaking };
}
