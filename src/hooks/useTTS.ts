"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface TTSOptions {
  pitch?: number;
  rate?: number;
  lang?: string;
  cooldownMs?: number;
}

export function useTTS(options: TTSOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const resumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Carga de voces — compatible con todos los motores (Chrome, Firefox, Chromium Linux)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };

    load();
    window.speechSynthesis.onvoiceschanged = load;

    // En algunos navegadores Linux las voces tardan más en cargar
    const retryTimer = setTimeout(load, 1000);
    return () => {
      clearTimeout(retryTimer);
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const unlock = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  /**
   * Selecciona la mejor voz española disponible en el sistema.
   * Lubuntu/Linux usa voces con nombres como "Spanish", "es_ES", "espeak" etc.
   * — diferente a Chrome/Mac que usa "Google español", "Paulina", etc.
   * Estrategia: primero busca por lang, luego por nombre, luego fallback a cualquier española.
   */
  const selectVoice = useCallback((voiceList: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (voiceList.length === 0) return null;

    const targetLang = options.lang ?? "es-ES";

    // 1. Voces que coinciden exactamente con el idioma objetivo
    const exactMatch = voiceList.filter(v => v.lang === targetLang);

    // 2. Voces que empiezan con "es" (es-ES, es-MX, es_ES, es_CL…)
    const spanishVoices = voiceList.filter(v =>
      v.lang.toLowerCase().startsWith("es") ||
      v.name.toLowerCase().includes("spanish") ||
      v.name.toLowerCase().includes("español") ||
      v.name.toLowerCase().includes("espeak") // Linux espeak-ng
    );

    const pool = exactMatch.length > 0 ? exactMatch : spanishVoices;
    if (pool.length === 0) return null;

    // Preferir voces de red/premium si están disponibles
    const premium = pool.find(v =>
      v.name.includes("Premium") || v.name.includes("Network") ||
      v.name.includes("Natural") || v.name.includes("Google") ||
      v.name.includes("Microsoft")
    );
    return premium ?? pool[0];
  }, [options.lang]);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        console.warn("La síntesis de voz no está soportada en este navegador.");
        return;
      }

      // Limpiar timers previos
      if (resumeIntervalRef.current) {
        clearInterval(resumeIntervalRef.current);
        resumeIntervalRef.current = null;
      }
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }

      window.speechSynthesis.cancel();

      if (!text || !text.trim()) {
        setIsLocked(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Obtener voces frescas (importante en Linux donde pueden cargarse tarde)
      const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const selectedVoice = selectVoice(currentVoices);
      if (selectedVoice) utterance.voice = selectedVoice;

      // Siempre fijar lang aunque no haya voz (el motor usa lang como hint)
      utterance.lang = options.lang ?? "es-ES";
      utterance.pitch = options.pitch ?? 1.0;
      utterance.rate = options.rate ?? 0.85;

      const clearKeepAlive = () => {
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsLocked(true);
      };

      utterance.onend = () => {
        clearKeepAlive();
        setIsSpeaking(false);
        const cooldown = options.cooldownMs ?? 2000;
        cooldownTimerRef.current = setTimeout(() => setIsLocked(false), cooldown);
      };

      utterance.onerror = (e) => {
        clearKeepAlive();
        setIsSpeaking(false);
        setIsLocked(false);
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("Error en TTS:", e.error);
        }
      };

      // Keep-alive SOLO para Chrome/Chromium desktop (evita pausas en frases largas).
      // En Lubuntu el pause/resume puede causar problemas en espeak-ng,
      // por eso solo lo activamos si el motor no es espeak.
      const isEspeak = selectedVoice?.name.toLowerCase().includes("espeak") ?? false;
      if (!isEspeak) {
        resumeIntervalRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearKeepAlive();
          }
        }, 10000);
      }

      // Pequeño delay antes de hablar — necesario en algunos motores Linux
      // para que speechSynthesis.cancel() haya terminado de limpiar la cola.
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    },
    [voices, selectVoice, options.pitch, options.rate, options.lang, options.cooldownMs]
  );

  const stop = useCallback(() => {
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsLocked(false);
    }
  }, []);

  return { speak, stop, isSpeaking, isLocked, unlock };
}
