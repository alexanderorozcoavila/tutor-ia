"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { Login } from "@/components/Login";
import { AdminPanel } from "@/components/AdminPanel";
import { TutorDashboard } from "@/components/TutorDashboard";
import { TaskDashboard } from "@/components/TaskDashboard";
import { DictationModule } from "@/components/DictationModule";
import { DomesticTaskModule } from "@/components/DomesticTaskModule";
import { ReadingModule } from "@/components/ReadingModule";
import { AssessmentModule } from "@/components/AssessmentModule";
import { FullScreenWrapper } from "@/components/FullScreenWrapper";
import { MinecraftModuleWrapper } from "@/components/MinecraftModuleWrapper";
import { Task } from "@/lib/taskService";
import { LogOut, Sparkles } from "lucide-react";

function AppContent() {
  const { user, logout, isLoading } = useAuth();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Bug fix: limpiar la tarea activa cuando cambia el usuario (logout/login)
  // Sin esto, al cambiar de rol queda activa la vista del módulo anterior
  useEffect(() => {
    setActiveTask(null);
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50/50 p-4">
        <Login />
      </div>
    );
  }

  const renderRolePanel = () => {
    const isMinecraft = user?.role === "student" && user?.theme?.slug === "minecraft";

    if (activeTask) {
      let moduleContent: React.ReactNode;
      let moduleTitle = "Misión";

      if (activeTask.type === "dictation") {
        moduleTitle = "Dictado";
        moduleContent = (
          <DictationModule 
            taskId={activeTask.id} 
            initialText={activeTask.metadata.dictation_text} 
            initialConfig={activeTask.metadata.config}
            onFinish={() => setActiveTask(null)} 
            theme={isMinecraft ? "minecraft" : undefined}
          />
        );
      } else if (activeTask.type === "reading") {
        moduleTitle = "Lectura";
        moduleContent = (
          <ReadingModule 
            task={activeTask}
            onFinish={() => setActiveTask(null)}
            theme={isMinecraft ? "minecraft" : undefined}
          />
        );
      } else if (activeTask.type === "assessment") {
        moduleTitle = "Evaluación";
        moduleContent = (
          <AssessmentModule 
            task={activeTask}
            onFinish={() => setActiveTask(null)}
            theme={isMinecraft ? "minecraft" : undefined}
          />
        );
      } else {
        moduleContent = <DomesticTaskModule task={activeTask} onBack={() => setActiveTask(null)} />;
      }

      if (isMinecraft) {
        return (
          <MinecraftModuleWrapper moduleTitle={moduleTitle} onBack={() => setActiveTask(null)}>
            {moduleContent}
          </MinecraftModuleWrapper>
        );
      }
      return moduleContent;
    }

    switch (user.role) {
      case "admin": return <AdminPanel />;
      case "tutor": return <TutorDashboard />;
      case "student": return <TaskDashboard onStartTask={(task) => setActiveTask(task)} />;
      default: return <div>Rol no reconocido</div>;
    }
  };

  const isMinecraftStudent = user?.role === "student" && user?.theme?.slug === "minecraft";

  return (
    <div className={isMinecraftStudent ? "w-full min-h-screen flex flex-col" : "w-full min-h-screen flex flex-col bg-gray-50/50"}>
      {/* Navbar Global - Solo visible si hay usuario y NO es el tema minecraft de alumno */}
      {!isMinecraftStudent && (
        <header className="w-full bg-white/80 backdrop-blur-md border-b-2 border-indigo-50 px-8 py-4 flex justify-between items-center sticky top-0 z-[100] shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-2xl">
            <Sparkles className="animate-pulse" size={28} /> IA Tutor
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2 bg-indigo-50/50 px-4 py-1 rounded-2xl border border-indigo-100">
              <span className="text-sm font-black text-indigo-900">{user.username}</span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-tight">{user.role}</span>
            </div>
            <button 
              onClick={logout}
              className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all flex items-center gap-2 font-black text-sm shadow-sm active:scale-95"
              title="Cerrar Sesión"
            >
              <LogOut size={18} /> <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </header>
      )}

      <main className={isMinecraftStudent ? "flex-1 flex flex-col" : "flex-1 flex flex-col items-center p-4"}>
        {renderRolePanel()}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <FullScreenWrapper>
      <AppContent />
    </FullScreenWrapper>
  );
}
