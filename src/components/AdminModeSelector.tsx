'use client';

import { useRouter } from 'next/navigation';
import { Tv, LayoutDashboard, Shield, Sparkles } from 'lucide-react';

export function AdminModeSelector({ onSelectNormal }: { onSelectNormal: () => void }) {
  const router = useRouter();

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-8 animate-in fade-in duration-500">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Shield size={32} className="text-indigo-600" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Bienvenido, Admin</h1>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          Selecciona cómo deseas acceder al sistema.
        </p>
      </div>

      <div className="w-full space-y-4">
        {/* Opción 1: Acceso normal */}
        <button
          onClick={onSelectNormal}
          className="group w-full flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all active:scale-[0.98]"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <LayoutDashboard size={24} />
          </div>
          <div className="text-left flex-1">
            <p className="font-black text-gray-900 text-base">Acceso Normal</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Panel de administración completo.
            </p>
          </div>
          <Sparkles size={16} className="text-indigo-300 group-hover:text-indigo-500 transition-colors" />
        </button>

        {/* Opción 2: Control TV */}
        <button
          onClick={() => router.push('/tv-control')}
          className="group w-full flex items-center gap-4 p-5 bg-gray-900 rounded-2xl border-2 border-gray-800 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-[0.98]"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
            <Tv size={24} />
          </div>
          <div className="text-left flex-1">
            <p className="font-black text-white text-base">Control TV</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Vista móvil (modo TV).
            </p>
          </div>
          <Sparkles size={16} className="text-gray-600 group-hover:text-amber-400 transition-colors" />
        </button>
      </div>
    </div>
  );
}
