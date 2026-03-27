"use client";
import { useEffect, useRef, useState } from "react";
import { BellRing, Eye } from "lucide-react";

interface Props {
  phrase: string;
  phraseIndex: number;
  total: number;
  isSpeaking: boolean;
  isHidden?: boolean;
}

export function PhraseToast({ phrase, phraseIndex, total, isSpeaking, isHidden }: Props) {
  const [visible, setVisible] = useState(true);
  // key fuerza re-mount completo del div de animación al cambiar de frase
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setVisible(true);
    setAnimKey(k => k + 1); // reinicia la animación de la barra
    const timer = setTimeout(() => setVisible(false), 10_000);
    return () => clearTimeout(timer);
  }, [phraseIndex]);

  if (!visible) return null;

  return (
    <div
      key={animKey}
      role="status"
      aria-live="polite"
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-[200]
        max-w-xl w-[90vw] px-5 py-3
        rounded-2xl shadow-xl border-2
        animate-in slide-in-from-top-3 duration-300
        ${isSpeaking
          ? "bg-blue-500 border-blue-300 text-white"
          : "bg-white border-green-300 text-gray-900"
        }
      `}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[9px] font-black uppercase tracking-wider truncate ${isSpeaking ? "text-blue-100" : "text-gray-400"}`}>
          {isSpeaking
            ? <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Escuchando...</span>
            : <span className="flex items-center gap-1"><Eye size={10} /> Frase {phraseIndex + 1} / {total}</span>
          }
        </p>
        <button
          onClick={() => setVisible(false)}
          className={`shrink-0 text-xs font-bold opacity-40 hover:opacity-100 transition-opacity ${isSpeaking ? "text-white" : "text-gray-500"}`}
          aria-label="Cerrar"
        >✕</button>
      </div>

      {/* Texto de la frase */}
      {isHidden ? (
        <span className="flex items-center gap-2 italic text-base opacity-70 mt-1">
          <BellRing size={16} className="animate-bounce" /> Escucha con atención...
        </span>
      ) : (
        <p className={`text-base md:text-lg font-black leading-snug mt-1 ${isSpeaking ? "text-white" : "text-gray-900"}`}>
          {phrase}
        </p>
      )}

      {/* Barra de progreso 10s */}
      <div className={`mt-2 h-1 rounded-full overflow-hidden ${isSpeaking ? "bg-blue-300/40" : "bg-gray-100"}`}>
        <div
          className={`h-full rounded-full ${isSpeaking ? "bg-white/70" : "bg-green-400"}`}
          style={{ animation: "phrase-toast-shrink 10s linear forwards" }}
        />
      </div>
    </div>
  );
}
