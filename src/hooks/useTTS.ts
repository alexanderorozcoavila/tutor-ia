"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface TTSOptions {
  pitch?: number;
  rate?: number;
  lang?: string;
  cooldownMs?: number;
}

export type TTSStatus =
  | "checking"       // Aún evaluando
  | "ok"             // Todo funciona
  | "no-api"         // El navegador no soporta Web Speech API
  | "no-voices"      // API disponible pero sin voces instaladas
  | "no-spanish"     // Hay voces pero ninguna en español
  | "error";         // Falló al intentar hablar

export interface TTSDiagnostic {
  status: TTSStatus;
  totalVoices: number;
  spanishVoices: number;
  selectedVoice: string | null;
  message: string;    // Mensaje legible para mostrar al usuario/admin
}

export function useTTS(options: TTSOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [diagnostic, setDiagnostic] = useState<TTSDiagnostic>({
    status: "checking",
    totalVoices: 0,
    spanishVoices: 0,
    selectedVoice: null,
    message: "Verificando sistema de voz...",
  });

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

  // Carga de voces + diagnóstico
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setDiagnostic({
        status: "no-api",
        totalVoices: 0,
        spanishVoices: 0,
        selectedVoice: null,
        message: "Este navegador no soporta síntesis de voz. Usa Chromium o Firefox actualizado.",
      });
      return;
    }

    const runDiagnostic = (voiceList: SpeechSynthesisVoice[]) => {
      const total = voiceList.length;
      const spanish = voiceList.filter(v =>
        v.lang.toLowerCase().startsWith("es") ||
        v.name.toLowerCase().includes("spanish") ||
        v.name.toLowerCase().includes("español")
      );

      if (total === 0) {
        setDiagnostic({
          status: "no-voices",
          totalVoices: 0,
          spanishVoices: 0,
          selectedVoice: null,
          message: "No hay voces instaladas en el sistema. En Lubuntu ejecuta: sudo apt install speech-dispatcher espeak-ng",
        });
        return;
      }

      if (spanish.length === 0) {
        setDiagnostic({
          status: "no-spanish",
          totalVoices: total,
          spanishVoices: 0,
          selectedVoice: null,
          message: `Hay ${total} voz(ces) pero ninguna en español. Instala espeak-ng con idioma español: sudo apt install espeak-ng-data`,
        });
        return;
      }

      const best = spanish.find(v => v.name.includes("Google") || v.name.includes("Premium")) ?? spanish[0];
      setDiagnostic({
        status: "ok",
        totalVoices: total,
        spanishVoices: spanish.length,
        selectedVoice: best.name,
        message: `Voz activa: "${best.name}" (${best.lang})`,
      });
    };

    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
        runDiagnostic(v);
      }
    };

    load();
    window.speechSynthesis.onvoiceschanged = load;

    // Retry en Linux (voces tardan en cargarse)
    const t1 = setTimeout(load, 800);
    const t2 = setTimeout(load, 2000);

    // Timeout final: si tras 3s no hay voces, reportar el error
    const t3 = setTimeout(() => {
      const v = window.speechSynthesis.getVoices();
      if (v.length === 0) {
        setDiagnostic({
          status: "no-voices",
          totalVoices: 0,
          spanishVoices: 0,
          selectedVoice: null,
          message: "No hay voces instaladas en el sistema. En Lubuntu: sudo apt install speech-dispatcher espeak-ng espeak-ng-data",
        });
      }
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const unlock = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  const selectVoice = useCallback((voiceList: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (voiceList.length === 0) return null;
    const targetLang = options.lang ?? "es-ES";
    const exactMatch = voiceList.filter(v => v.lang === targetLang);
    const spanishVoices = voiceList.filter(v =>
      v.lang.toLowerCase().startsWith("es") ||
      v.name.toLowerCase().includes("spanish") ||
      v.name.toLowerCase().includes("español") ||
      v.name.toLowerCase().includes("espeak")
    );
    const pool = exactMatch.length > 0 ? exactMatch : spanishVoices;
    if (pool.length === 0) return null;
    const premium = pool.find(v =>
      v.name.includes("Premium") || v.name.includes("Network") ||
      v.name.includes("Natural") || v.name.includes("Google") ||
      v.name.includes("Microsoft")
    );
    return premium ?? pool[0];
  }, [options.lang]);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;

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
      const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const selectedVoice = selectVoice(currentVoices);
      if (selectedVoice) utterance.voice = selectedVoice;

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
        // Confirmar que el TTS está funcionando
        setDiagnostic(prev => prev.status !== "ok" ? {
          ...prev,
          status: "ok",
          message: `Voz activa: "${selectedVoice?.name ?? "sistema"}"`,
        } : prev);
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
          setDiagnostic(prev => ({
            ...prev,
            status: "error",
            message: `Error al reproducir voz: "${e.error}". Verifica que speech-dispatcher esté activo.`,
          }));
        }
      };

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

  return { speak, stop, isSpeaking, isLocked, unlock, diagnostic };
}
