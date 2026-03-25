"use client";

import { useState, ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export function FullScreenWrapper({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error("Error al intentar pantalla completa:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listener para cuando el usuario minimiza con ESC
  if (typeof document !== "undefined") {
    document.addEventListener("fullscreenchange", () => {
      setIsFullscreen(!!document.fullscreenElement);
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleFullscreen}
          className="p-3 bg-white/80 hover:bg-white rounded-full shadow-md text-gray-700 transition"
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Entrar a pantalla completa"}
        >
          {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
        </button>
      </div>
      
      {children}
    </div>
  );
}
