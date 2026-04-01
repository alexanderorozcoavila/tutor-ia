"use client";

/**
 * useTTS — Hook de Text-to-Speech compatible con todos los sistemas operativos.
 *
 * Estrategia de máxima compatibilidad:
 *  - NO selecciona voz por nombre (los nombres varían por OS: "Paulina" en Mac,
 *    "Helena" en Windows, "espeak-ng" en Linux). Esto causaba silencio en Linux.
 *  - Solo fija `utterance.lang = "es"` y deja que el navegador/SO elija la voz.
 *  - NO usa keep-alive con pause/resume (rompe espeak-ng en Linux).
 *  - Reintentos automáticos de carga de voces (Linux las carga tarde).
 *  - Expone `diagnostic` con estado legible para mostrar en la UI.
 *
 * Compatible con: Chrome, Chromium, Firefox, Edge, Safari, Chromium en Lubuntu.
 */

import { useState, useCallback, useEffect, useRef } from "react";

interface TTSOptions {
  pitch?: number;
  rate?: number;
  lang?: string;
  cooldownMs?: number;
}

export type TTSStatus =
  | "checking"    // Evaluando
  | "ok"          // Funcionando
  | "no-api"      // Navegador sin Web Speech API
  | "no-voices"   // API disponible, cero voces en el sistema
  | "no-spanish"  // Hay voces pero ninguna en español
  | "error";      // Error al intentar hablar

export interface TTSDiagnostic {
  status: TTSStatus;
  totalVoices: number;
  spanishVoices: number;
  selectedVoice: string | null;
  message: string;
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

  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Carga de voces + diagnóstico automático ─────────────────────────────────
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setDiagnostic({
        status: "no-api",
        totalVoices: 0,
        spanishVoices: 0,
        selectedVoice: null,
        message: "Este navegador no soporta síntesis de voz. Usa Chromium, Chrome, Firefox o Edge.",
      });
      return;
    }

    const analyze = (voiceList: SpeechSynthesisVoice[]) => {
      if (voiceList.length === 0) return; // Aún cargando

      const esVoices = voiceList.filter(v =>
        v.lang.toLowerCase().startsWith("es") ||
        v.name.toLowerCase().includes("spanish") ||
        v.name.toLowerCase().includes("español")
      );

      setVoices(voiceList);

      if (esVoices.length === 0) {
        setDiagnostic({
          status: "no-spanish",
          totalVoices: voiceList.length,
          spanishVoices: 0,
          selectedVoice: null,
          message: `Hay ${voiceList.length} voz(ces) pero ninguna en español. Instala espeak-ng-data o agrega el idioma español en el sistema.`,
        });
        return;
      }

      // La voz que finalmente usará el navegador: la primera en español
      // (no forzamos ningún nombre — el navegador elige la mejor disponible)
      const voice = esVoices[0];
      setDiagnostic({
        status: "ok",
        totalVoices: voiceList.length,
        spanishVoices: esVoices.length,
        selectedVoice: voice.name,
        message: `Voz activa: "${voice.name}" (${voice.lang}) · ${esVoices.length} voces en español disponibles`,
      });
    };

    const load = () => {
      const v = window.speechSynthesis.getVoices();
      analyze(v);
    };

    load();
    window.speechSynthesis.onvoiceschanged = load;

    // Linux: reintentos porque las voces tardan en registrarse
    const t1 = setTimeout(load, 600);
    const t2 = setTimeout(load, 1500);

    // Timeout definitivo: si a los 3s siguen en 0, reportar
    const t3 = setTimeout(() => {
      if (window.speechSynthesis.getVoices().length === 0) {
        setDiagnostic({
          status: "no-voices",
          totalVoices: 0,
          spanishVoices: 0,
          selectedVoice: null,
          message: "No hay voces instaladas en el sistema. En Linux: sudo apt install speech-dispatcher espeak-ng espeak-ng-data",
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

  // ── unlock: desbloquear motor con gesto de usuario ──────────────────────────
  const unlock = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  // ── speak: síntesis de voz genérica ────────────────────────────────────────
  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      if (!text?.trim()) return;

      // Limpiar cooldown anterior
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // ── CLAVE DE COMPATIBILIDAD: solo fijamos el idioma, nunca el nombre de voz ──
      // Esto permite que cada OS use la voz española que tenga disponible:
      //   macOS  → Mónica / Paulina
      //   Windows → Helena / Sabina
      //   Linux  → espeak-ng es / Google es
      //   Android → Google español
      utterance.lang = options.lang ?? "es";
      utterance.pitch = options.pitch ?? 1.0;
      utterance.rate = options.rate ?? 0.85;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsLocked(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        const cooldown = options.cooldownMs ?? 2000;
        cooldownTimerRef.current = setTimeout(() => setIsLocked(false), cooldown);
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        setIsLocked(false);
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("[TTS] Error:", e.error);
          setDiagnostic(prev => ({
            ...prev,
            status: "error",
            message: `Error al reproducir voz: "${e.error}". Verifica que speech-dispatcher esté activo (Linux) o que el volumen del sistema no esté en 0.`,
          }));
        }
      };

      // Pequeño delay (50ms) para que cancel() libere el motor antes de speak()
      // Necesario en algunos motores de Linux y Firefox
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    },
    [options.lang, options.pitch, options.rate, options.cooldownMs]
  );

  // ── stop ────────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsLocked(false);
  }, []);

  return { speak, stop, isSpeaking, isLocked, unlock, diagnostic };
}
