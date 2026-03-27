"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface TTSOptions {
  pitch?: number;
  rate?: number;
  lang?: string;
}

export function useTTS(options: TTSOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const resumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpiar interval de keep-alive al desmontar
  useEffect(() => {
    return () => {
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
    };
  }, []);

  // Cargar voces
  useEffect(() => {
    const handleVoicesChanged = () => setVoices(window.speechSynthesis.getVoices());
    setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        console.warn("La síntesis de voz no está soportada en este navegador.");
        return;
      }

      // Limpiar interval previo y cancelar audio en curso
      if (resumeIntervalRef.current) {
        clearInterval(resumeIntervalRef.current);
        resumeIntervalRef.current = null;
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      let currentVoices = voices;
      if (currentVoices.length === 0) currentVoices = window.speechSynthesis.getVoices();

      const spanishVoices = currentVoices.filter(v => v.lang.startsWith("es"));

      const premiumVoice = spanishVoices.find(v =>
        v.name.includes("Premium") || v.name.includes("Network") ||
        v.name.includes("Natural") || v.name.includes("Google español (Estados Unidos)") ||
        v.name.includes("Paulina")
      );

      const defaultVoice = spanishVoices.find(v =>
        v.name.includes("Google") || v.name.includes("Microsoft") ||
        v.name.includes("Mónica") || v.name.includes("Helena")
      ) || spanishVoices[0];

      const selectedVoice = premiumVoice || defaultVoice;
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.pitch = options.pitch ?? (premiumVoice ? 1.0 : 1.1);
      utterance.rate = options.rate ?? 0.85;
      utterance.lang = options.lang ?? "es-ES";

      const clearKeepAlive = () => {
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
      };

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { clearKeepAlive(); setIsSpeaking(false); };
      utterance.onerror = (e) => {
        clearKeepAlive();
        // 'interrupted' y 'canceled' son esperados cuando llamamos cancel() intencionalmente
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("Error en TTS:", e.error);
        }
        setIsSpeaking(false);
      };

      // Keep-alive para Chrome (evita pausas automáticas en frases largas)
      resumeIntervalRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearKeepAlive();
        }
      }, 10000);

      window.speechSynthesis.speak(utterance);
    },
    [voices, options.pitch, options.rate, options.lang]
  );

  const stop = useCallback(() => {
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stop, isSpeaking };
}
