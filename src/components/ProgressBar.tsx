"use client";

import { useSession } from "./SessionProvider";

export function ProgressBar() {
  const { timeRemaining, xp } = useSession();
  
  const MAX_TIME = 15 * 60;
  const progressPercentage = ((MAX_TIME - timeRemaining) / MAX_TIME) * 100;
  
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2 p-4 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 mb-8 mt-4">
      <div className="flex justify-between items-center px-2">
        <span className="text-xl font-bold text-blue-600">
          Tiempo: {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
        <span className="text-xl font-bold text-amber-500">
          🌟 {xp} XP
        </span>
      </div>
      
      {/* Barra visual de ancho completo, colores pastel amigables */}
      <div className="h-6 w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}
