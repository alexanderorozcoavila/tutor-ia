/**
 * logic_dictation.ts
 * Implementación para Módulo de Dictado Adaptativo y UX
 */

// 1. SEGMENTACIÓN DE TEXTO ESPECIALIZADA (Micro-learning)
export function segmentTextForDictation(text: string): string[] {
  // Limpiamos espacios redundantes
  const cleanText = text.trim().replace(/\s+/g, ' ');
  
  // Pausas gramaticales reconocidas (.,;:\n)
  // Utilizamos Regex con Lookbehind/Lookahead u opcionales para mantener el signo unido a su texto.
  const grammarTokens = cleanText.split(/(?<=[.,;:!?”])\s+|\n+/);

  const finalPhrases: string[] = [];

  grammarTokens.forEach((token) => {
    const trimmed = token.trim();
    if (!trimmed) return;

    const words = trimmed.split(' ');

    // Si la oración supera las 8 palabras, la forzamos a dividir lógicamente
    if (words.length > 8) {
      let currentChunk: string[] = [];

      words.forEach((word) => {
        currentChunk.push(word);
        if (currentChunk.length === 8) {
          finalPhrases.push(currentChunk.join(' '));
          currentChunk = [];
        }
      });

      if (currentChunk.length > 0) {
        finalPhrases.push(currentChunk.join(' '));
      }
    } else {
      finalPhrases.push(trimmed);
    }
  });

  return finalPhrases;
}

// ---------------------------------------------------------------------------------
// 2. CONTROL DE REPRODUCCIÓN Y BLOQUEO ANTIRREBOTE (Anti-scroll)
// Ejemplo de React Hook para administrar de forma segura el estado de lectura temporal
// ---------------------------------------------------------------------------------
import { useState, useRef, useCallback, useEffect } from 'react';

interface TTSPlaybackProps {
  onIndexChange: (newIndex: number) => void;
  cooldownMs?: number; // Tolerancia post-audio (defecto: 2000ms)
}

export function useTTSPlayback({ onIndexChange, cooldownMs = 2000 }: TTSPlaybackProps) {
  const [isPlayingOrLocked, setIsPlayingOrLocked] = useState(false);
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpieza en demontaje
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  const playPhrase = useCallback((phrase: string, index: number) => {
    if (isPlayingOrLocked) return; // Bloqueo estricto: evita spam de la tecla espacio/siguiente

    setIsPlayingOrLocked(true);
    
    // El motor TTS nativo en los navegadores
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'es-ES'; // O el idioma adecuado para la región
    
    // Evento al finalizar el dictado del fragmento
    utterance.onend = () => {
      // Inicia el "Cooldown" (Tiempo de gracia Anti-scroll y Anti-frustración)
      lockTimerRef.current = setTimeout(() => {
        setIsPlayingOrLocked(false);
        // Avanzar el índice de la vista solo tras el periodo de gracia
        // También aquí se guarda en BD para la "Persistencia de Sesión"
        onIndexChange(index + 1); 
      }, cooldownMs);
    };

    // Evento de fallback de emergencia (por si SpeechSynthesis falla en Safari/iOS)
    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      setIsPlayingOrLocked(false);
    };

    window.speechSynthesis.speak(utterance);
    
  }, [isPlayingOrLocked, cooldownMs, onIndexChange]);

  // Bugfix: Para inicializar la instancia en el ciclo de vida seguro del DOM
  const initEngine = useCallback(() => {
    const silentUtterance = new SpeechSynthesisUtterance('');
    silentUtterance.volume = 0;
    window.speechSynthesis.speak(silentUtterance);
  }, []);

  return {
    playPhrase,
    isPlayingOrLocked,
    initEngine
  };
}
