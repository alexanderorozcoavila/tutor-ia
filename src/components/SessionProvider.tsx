"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { updateStudentXP } from "@/actions/studentActions";

interface SessionContextType {
  timeRemaining: number;
  xp: number;
  addXP: (amount: number) => void;
  isSessionActive: boolean;
  endSession: () => void;
  studentId: string | null;
  setStudentId: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// 15 minutos exactos para evitar fatiga cognitiva
const MAX_SESSION_TIME = 15 * 60; 

export function SessionProvider({ children }: { children: ReactNode }) {
  const [timeRemaining, setTimeRemaining] = useState(MAX_SESSION_TIME);
  const [xp, setXp] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSessionActive && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining <= 0) {
      endSession();
    }
    return () => clearInterval(timer);
  }, [isSessionActive, timeRemaining]);

  const addXP = async (amount: number) => {
    setXp((prev) => prev + amount);
    if (studentId) {
      // Async server action without blocking UI
      updateStudentXP(studentId, amount).catch(console.error);
    }
  };

  const startSession = () => setIsSessionActive(true);
  
  const endSession = () => {
    setIsSessionActive(false);
    // Mostrar premio final
    alert(`¡Has completado tu sesión hoy! Ganaste ${xp} XP. ¡Eres increíble!`);
  };

  return (
    <SessionContext.Provider value={{ timeRemaining, xp, addXP, isSessionActive, endSession, studentId, setStudentId }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
};
