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

      window.speechSynthesis.cancel(); // Detener si algo más está hablando

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Select Spanish voice, preferably friendly or native
      const spanishVoices = voices.filter(v => v.lang.startsWith("es"));
      const selectedVoice = spanishVoices.find(v => v.name.includes("Google") || v.name.includes("Microsoft")) || spanishVoices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.pitch = options.pitch ?? 1.1; // Ligeramente agudo para ser "amigable"
      utterance.rate = options.rate ?? 0.85; // Ligeramente más lento para TDA/TEA
      utterance.lang = options.lang ?? "es-ES";

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error("Error en TTS:", e);
        setIsSpeaking(false);
      };

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
