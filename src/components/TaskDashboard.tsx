"use client";

import { useState, useEffect, useRef } from "react";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { TaskCreator } from "./TaskCreator";
import { 
  CheckCircle2, Clock, BookOpen, 
  Home, Star, Settings, Plus,
  ChevronRight, AlertCircle, Loader2, DatabaseZap,
  Laptop, Tablet, Smartphone, MonitorX, Camera, ImageIcon
} from "lucide-react";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { planService, PlanSemanal, evalEstadoLMS } from "@/lib/planService";
import { StudentPlanViewer } from "./StudentPlanViewer";
import { MinecraftStudentViewer } from "./MinecraftStudentViewer";
import { MinecraftLoader } from "./MinecraftLoader";

interface Props {
  onStartTask: (task: Task) => void;
}

export function TaskDashboard({ onStartTask }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const currentDevice = useDeviceDetect();

  const [activePlan, setActivePlan] = useState<PlanSemanal | null>(null);

  const isLocalMode = typeof window !== 'undefined' && 
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('TU_PROJECT_ID'));

  const loadTasks = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Intentar cargar el Plan Semanal
      const plan = await planService.getPlanSemanalActivo(user.id).catch(() => null);
      if (plan) {
         if (evalEstadoLMS(plan.fecha_inicio) === 'active') {
           setActivePlan(plan);
         } else {
           setActivePlan(null);
         }
      }

      // 2. Cargar tareas (ya sea para fallback o para baseTasks del Plan)
      const data = await taskService.getTasks();
      setTasks(data.filter(t => t.assigned_to === user.id));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, taskId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTaskId(taskId);
    try {
      // Leer como base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Comprimir vía API
      let finalBase64 = base64;
      try {
        const res = await fetch("/api/compress-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image: base64 }),
        });
        if (res.ok) {
          const { compressedImage } = await res.json();
          if (compressedImage) finalBase64 = compressedImage;
        }
      } catch {
        // si falla la compresión, usar original
      }

      // Actualizar preview local
      setPreviewMap(prev => ({ ...prev, [taskId]: finalBase64 }));

      // Persistir en DB
      await taskService.updateTask(taskId, {
        image_url: finalBase64.split(",")[1] || finalBase64,
        metadata: {
          evidence: finalBase64,
        },
      });
    } catch (err) {
      console.error("Error subiendo la foto:", err);
    } finally {
      setUploadingTaskId(null);
      // limpiar valor del input para permitir re-seleccionar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    if (user?.theme?.slug === "minecraft") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
          <MinecraftLoader />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="text-indigo-500 animate-spin" size={48} />
        <p className="text-gray-400 font-bold">Cargando tus aventuras...</p>
      </div>
    );
  }

  const isMinecraft = user?.theme?.slug === "minecraft";

  // BIFURCACIÓN LÓGICA (Modo Plan vs Modo Libre)
  if (activePlan) {
    if (isMinecraft) {
      return (
        <MinecraftStudentViewer
          plan={activePlan}
          onRefreshFallback={() => loadTasks()}
          onStartModule={onStartTask}
        />
      );
    }
    
    return (
      <StudentPlanViewer 
        plan={activePlan}
        onRefreshFallback={() => loadTasks()}
        onStartModule={onStartTask}
      />
    );
  }

  if (isMinecraft) {
    return (
      <MinecraftStudentViewer
        plan={null as any} // Handle null plan in the component
        onRefreshFallback={() => loadTasks()}
        onStartModule={onStartTask}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Input de archivo oculto compartido */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => activeUploadId && handlePhotoSelect(e, activeUploadId)}
      />

      {/* Header */}
      <div className="theme-card flex flex-col md:flex-row items-center justify-between gap-6 p-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center text-white shadow-lg">
            <Star size={40} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">¡Hola, Pequeño Aventurero!</h1>
            <p className="text-gray-500 font-bold text-lg">Tienes {tasks.filter(t => t.status === "pending").length} tareas pendientes hoy.</p>
            {isLocalMode && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full mt-2">
                <DatabaseZap size={12} /> MODO LOCAL
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 gap-4">
        {tasks.filter(t => !['approved', 'rejected'].includes(t.status)).length === 0 ? (
          <div className="bg-indigo-50/50 border-4 border-dashed border-indigo-100 p-16 rounded-[3rem] text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-400">
              <Clock size={40} />
            </div>
            <h3 className="text-2xl font-extrabold text-indigo-900">¡Todo al día!</h3>
            <p className="text-indigo-400 font-bold">No tienes aventuras pendientes por ahora.</p>
          </div>
        ) : (
          tasks.filter(t => !['approved', 'rejected'].includes(t.status)).map((task) => {
            const isSupported = !task.supported_devices || task.supported_devices.includes(currentDevice);
            const isUploading = uploadingTaskId === task.id;
            const canAttachPhoto = task.status !== 'pending' && !['approved', 'rejected'].includes(task.status);
            const previewUrl = previewMap[task.id] || (task.metadata?.evidence ? `data:image/jpeg;base64,${task.metadata.evidence}` : null);

            return (
              <div key={task.id} className={`
                group relative flex flex-col gap-0 transition-all overflow-hidden theme-card
                ${task.status === "completed" || task.status === "failed"
                  ? "bg-amber-50 opacity-90 border-amber-200" 
                  : !isSupported
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : ""
                }
              `}>
                {/* Fila principal de la tarea */}
                <div
                  onClick={() => task.status === "pending" && isSupported && onStartTask(task)}
                  className={`flex items-center justify-between p-6 ${task.status === "pending" && isSupported ? "cursor-pointer active:scale-[0.98]" : "cursor-default"}`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`
                      w-16 h-16 rounded-2xl flex items-center justify-center 
                      ${!isSupported ? "bg-gray-200 text-gray-400" : task.type === "dictation" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}
                    `}>
                      {task.type === "dictation" ? <BookOpen size={32} /> : <Home size={32} />}
                    </div>
                    <div>
                      <h3 className={`text-xl font-extrabold ${task.status === "completed" ? "text-amber-700" : !isSupported ? "text-gray-500" : "text-gray-900"}`}>
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm font-bold mt-1 text-gray-400">
                        <span className="uppercase tracking-widest">{task.type === "dictation" ? "Dictado" : "Hogar"}</span>
                        {!isSupported && (
                          <span className="flex items-center gap-1 text-red-500 bg-red-50 px-3 py-1 rounded-full text-[10px] uppercase">
                            <MonitorX size={12} /> Bloqueado aquí
                          </span>
                        )}
                        {(task.status === "completed" || task.status === "failed") && (
                          <span className="flex items-center gap-1 text-amber-500 bg-amber-100 px-3 py-1 rounded-full text-xs">
                            <Clock size={12} /> ESPERANDO REVISIÓN
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-2 opacity-50" title="Dispositivos compatibles">
                          {(!task.supported_devices || task.supported_devices.includes('desktop')) && <Laptop size={14} />}
                          {(!task.supported_devices || task.supported_devices.includes('tablet')) && <Tablet size={14} />}
                          {(!task.supported_devices || task.supported_devices.includes('mobile')) && <Smartphone size={14} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {task.status === "pending" ? (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${!isSupported ? "bg-gray-100 text-gray-300" : "bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white"}`}>
                        <ChevronRight size={28} />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center">
                        <AlertCircle size={24} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección de foto de evidencia (solo en tareas completadas/failed, no aprobadas/rechazadas) */}
                {canAttachPhoto && (
                  <div className="px-6 pb-6 border-t-2 border-amber-100 pt-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <ImageIcon size={12} /> Foto de evidencia
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Minuatura de la foto si existe */}
                      {previewUrl && (
                        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0">
                          <img src={previewUrl} alt="Evidencia" className="w-full h-full object-cover" />
                        </div>
                      )}
                      {/* Botón de cámara */}
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => {
                          setActiveUploadId(task.id);
                          // Pequeño timeout para que el state se actualice antes del click
                          setTimeout(() => fileInputRef.current?.click(), 0);
                        }}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                          previewUrl
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md"
                        }`}
                      >
                        {isUploading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Camera size={18} />
                        )}
                        {isUploading ? "Subiendo..." : previewUrl ? "Cambiar foto" : "Agregar foto"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mis Logros (Historial del Alumno) */}
      {tasks.filter(t => t.status === 'approved').length > 0 && (
        <div className="pt-8 space-y-6">
          <h2 className="text-2xl font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" /> Mis Logros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.filter(t => t.status === 'approved').map(task => (
              <div key={task.id} className="theme-card p-6 flex items-center justify-between border-emerald-100 bg-emerald-50/20 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Star size={24} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800">{task.title}</h4>
                    <p className="text-xs font-bold text-emerald-500">¡GANASTE {task.score} PUNTOS!</p>
                  </div>
                </div>
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
