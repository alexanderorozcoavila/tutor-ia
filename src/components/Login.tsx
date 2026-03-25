"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Sparkles, User, Lock, Loader2, ArrowRight } from "lucide-react";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsError(false);
    setIsLogging(true);
    
    const success = await login(username, password);
    if (!success) {
      setIsError(true);
      setIsLogging(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-indigo-50 animate-in zoom-in-95 duration-500">
      <div className="flex flex-col items-center mb-10">
        <div className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl mb-6">
          <Sparkles size={50} />
        </div>
        <h1 className="text-4xl font-black text-gray-900">IA Tutor</h1>
        <p className="text-gray-400 font-bold mt-2 italic">Aventuras de Aprendizaje</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-black text-gray-400 uppercase tracking-wider ml-4">Usuario</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:bg-white outline-none transition-all font-bold"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-black text-gray-400 uppercase tracking-wider ml-4">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:bg-white outline-none transition-all font-bold"
              required
            />
          </div>
        </div>

        {isError && (
          <div className="p-4 bg-red-50 text-red-500 rounded-xl text-center font-bold animate-pulse">
            Usuario o contraseña incorrectos
          </div>
        )}

        <button
          type="submit"
          disabled={isLogging}
          className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black text-xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {isLogging ? <Loader2 className="animate-spin" /> : <><ArrowRight /> Entrar a mi Clase</>}
        </button>
      </form>

      <div className="mt-8 text-center text-gray-400 text-sm font-medium">
        ¿Eres un nuevo alumno? Pídele a tu tutor que te registre.
      </div>
    </div>
  );
}
