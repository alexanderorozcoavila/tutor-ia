"use client";

import { useState, useEffect, useRef } from "react";
import { Monitor, X, Loader2, CheckCircle2, AlertTriangle, ChevronUp } from "lucide-react";
import { systemMenuService, MenuAccion } from "@/lib/systemMenuService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";

/**
 * SystemMenu — Menú flotante de acciones del sistema.
 * Solo visible en PC (hidden en móvil via CSS).
 * Se posiciona en la esquina inferior derecha de la pantalla.
 */
export function SystemMenu() {
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MenuAccion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // ID esperando confirmación
  const menuRef = useRef<HTMLDivElement>(null);

  // Cargar ítems cuando el usuario está disponible
  useEffect(() => {
    if (!user?.role) return;
    systemMenuService.getMenuItems(user.role)
      .then(setItems)
      .catch(() => {}); // Silencioso — el menú simplemente no aparece
  }, [user?.role]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // No renderizar si no hay ítems o no hay usuario
  if (!user || items.length === 0) return null;

  const handleAction = async (item: MenuAccion) => {
    // Acciones críticas (apagar/reiniciar): pedir confirmación
    const esCritica = item.nombre.toLowerCase().includes("apagar") ||
                      item.nombre.toLowerCase().includes("reiniciar");

    if (esCritica && confirming !== item.id) {
      setConfirming(item.id);
      return;
    }

    setConfirming(null);
    setExecutingId(item.id);
    try {
      const result = await systemMenuService.ejecutarAccion(item.id);
      if (result.ok) {
        showAlert(`✅ ${result.accion || item.nombre} ejecutado`, { type: "success" });
        setOpen(false);
      } else {
        showAlert(result.error || "Error al ejecutar la acción", { type: "error" });
      }
    } catch {
      showAlert("El agente de menú no está disponible. ¿Está corriendo action_agent.py?", { type: "error" });
    } finally {
      setExecutingId(null);
    }
  };

  return (
    // hidden en móvil (md:block) — solo visible en PC
    <div ref={menuRef} className="hidden md:block fixed bottom-6 right-6 z-40 select-none">

      {/* Lista de ítems (aparece encima del botón) */}
      {open && (
        <div className="mb-3 w-56 bg-white rounded-[1.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center gap-2">
            <Monitor size={14} className="text-gray-400" />
            <span className="text-xs font-black text-gray-300 uppercase tracking-widest">Sistema</span>
          </div>

          {/* Items */}
          <div className="py-2">
            {items.map((item) => {
              const isExec    = executingId === item.id;
              const isConfirm = confirming === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleAction(item)}
                  disabled={!!executingId}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all disabled:opacity-50
                    ${isConfirm
                      ? "bg-red-50 hover:bg-red-100"
                      : "hover:bg-gray-50"
                    }`}
                >
                  <span className="text-xl flex-shrink-0">
                    {isExec ? <Loader2 size={20} className="animate-spin text-gray-400" /> : item.icono_emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold leading-tight ${isConfirm ? "text-red-700" : "text-gray-800"}`}>
                      {isConfirm ? `¿Confirmar ${item.nombre.toLowerCase()}?` : item.nombre}
                    </p>
                    {isConfirm && (
                      <p className="text-[10px] text-red-500 font-bold">Haz click de nuevo para confirmar</p>
                    )}
                    {!isConfirm && item.descripcion && (
                      <p className="text-[10px] text-gray-400 truncate">{item.descripcion}</p>
                    )}
                  </div>
                  {isConfirm && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Botón flotante principal */}
      <button
        onClick={() => { setOpen(v => !v); setConfirming(null); }}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90
          ${open
            ? "bg-gray-800 text-white rotate-0 shadow-gray-800/40"
            : "bg-white text-gray-700 hover:bg-gray-800 hover:text-white shadow-gray-300/60"
          }`}
        title="Menú del sistema"
      >
        {open
          ? <X size={22} />
          : <Monitor size={22} />
        }
      </button>
    </div>
  );
}
