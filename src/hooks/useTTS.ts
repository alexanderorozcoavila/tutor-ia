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
  // Guardamos el utterance pendiente para poder cancelarlo limpiamente
  const pendingUtterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Cargar voces — el evento onvoiceschanged es necesario en Chrome
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  /**
   * unlock() — debe llamarse desde un handler de click del usuario.
   * Ejecuta un cancel() para "despertar" el motor de síntesis sin encolar
   * ningún utterance que pueda interferir con la primera frase real.
   * No usa speak() silencioso porque eso crea una race condition.
   */
  const unlock = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    // Un cancel() desde un gesto de usuario desbloquea el motor en Chrome/Safari
    // sin necesidad de encolar nada extra.
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        console.warn("La síntesis de voz no está soportada en este navegador.");
        return;
      }

      // Detener keep-alive previo
      if (resumeIntervalRef.current) {
        clearInterval(resumeIntervalRef.current);
        resumeIntervalRef.current = null;
      }

      // Cancelar cualquier audio en curso
      window.speechSynthesis.cancel();

      // Si no hay texto real, salir (evita encolar utterances vacíos)
      if (!text || !text.trim()) return;

      const utterance = new SpeechSynthesisUtterance(text);
      pendingUtterRef.current = utterance;

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

  return { speak, stop, isSpeaking, unlock };
}
