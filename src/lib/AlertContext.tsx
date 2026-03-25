"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal } from "@/components/Modal";
import { Info, AlertCircle, CheckCircle2 } from "lucide-react";

type AlertType = "info" | "error" | "success";

interface AlertOptions {
  title?: string;
  type?: AlertType;
}

interface AlertContextType {
  showAlert: (message: string, options?: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("Aviso");
  const [type, setType] = useState<AlertType>("info");

  const showAlert = useCallback((msg: string, options?: AlertOptions) => {
    setMessage(msg);
    setTitle(options?.title || (options?.type === "error" ? "Error" : options?.type === "success" ? "¡Éxito!" : "Aviso"));
    setType(options?.type || "info");
    setIsOpen(true);
  }, []);

  const closeAlert = () => setIsOpen(false);

  const getIcon = () => {
    switch (type) {
      case "error": return <AlertCircle className="text-red-500" size={48} />;
      case "success": return <CheckCircle2 className="text-emerald-500" size={48} />;
      default: return <Info className="text-indigo-500" size={48} />;
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal isOpen={isOpen} onClose={closeAlert} title={title}>
        <div className="flex flex-col items-center text-center space-y-6 py-4">
          <div className="p-4 bg-gray-50 rounded-full animate-in zoom-in-50 duration-500">
            {getIcon()}
          </div>
          <p className="text-gray-600 font-bold text-lg leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
          <button 
            onClick={closeAlert}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all active:scale-95"
          >
            Aceptar
          </button>
        </div>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error("useAlert debe usarse dentro de un AlertProvider");
  }
  return context;
}
