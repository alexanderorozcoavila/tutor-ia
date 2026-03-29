"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, userService } from "./userService";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const saved = localStorage.getItem("ia_tutor_session");
      if (saved) {
        const savedUser = JSON.parse(saved);
        setUser(savedUser);
        
        // Refresco en segundo plano para obtener el tema más reciente
        try {
          const freshProfile = await userService.getUserProfile(savedUser.id);
          if (freshProfile) {
            setUser(freshProfile);
            localStorage.setItem("ia_tutor_session", JSON.stringify(freshProfile));
          }
        } catch (err) {
          console.error("Error refrescando perfil:", err);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const authenticatedUser = await userService.login(username, password);
    if (authenticatedUser) {
      setUser(authenticatedUser);
      localStorage.setItem("ia_tutor_session", JSON.stringify(authenticatedUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ia_tutor_session");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
