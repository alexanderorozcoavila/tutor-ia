"use client";

import { useState, useEffect } from "react";
import { User, userService } from "@/lib/userService";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { TaskCreator } from "./TaskCreator";
import { Modal } from "./Modal";
import { 
  Users, UserPlus, BookOpen, Home, 
  ChevronRight, Plus, Calendar, GraduationCap,
  Clock, Bell, Settings2, Loader2, X, Trash2, AlertTriangle, 
  Star, DatabaseZap, CheckCircle2, Image as ImageIcon
} from "lucide-react";
import { useAlert } from "@/lib/AlertContext";

const AsyncImageWithSkeleton = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative bg-gray-100 overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-indigo-50 flex items-center justify-center">
          <ImageIcon className="text-indigo-200" size={24} />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

export function TutorDashboard() {
  const { showAlert } = useAlert();
  const { user: tutor } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [showUserCreator, setShowUserCreator] = useState(false);
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [studentTasks, setStudentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);

  // Estados para revisión de tareas
  const [taskToReview, setTaskToReview] = useState<Task | null>(null);
  const [reviewScore, setReviewScore] = useState(100);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState(false);

  // Estados para modales de gestión
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Estados para creación/asignación de alumno
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"create" | "assign">("create");

  const loadData = async () => {
    if (!tutor) return;
    setIsLoading(true);
    try {
      const data = await userService.getStudentsForTutor(tutor.id);
      setStudents(data);
      const available = await userService.getAvailableStudents(tutor.id);
      setAvailableStudents(available);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudentTasks = async (studentId: string) => {
    try {
      const allTasks = await taskService.getTasks();
      setStudentTasks(allTasks.filter(t => t.assigned_to === studentId));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [tutor]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentTasks(selectedStudent.id);
    }
  }, [selectedStudent]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !tutor) return;
    try {
      await userService.createUser({
        username: newUsername,
        password: newPassword,
        role: "student",
        created_by: tutor.id
      });
      setNewUsername("");
      setNewPassword("");
      setShowUserCreator(false);
      loadData();
      showAlert("Alumno registrado correctamente", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    }
  };

  const handleAssignStudent = async (studentId: string) => {
    if (!tutor) return;
    try {
      await userService.assignStudentToTutor(tutor.id, studentId);
      setShowUserCreator(false);
      loadData();
      showAlert("Alumno vinculado con éxito", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    }
  };

  const handleDeleteStudent = (user: User) => {
    setUserToEdit(user);
    setIsDeleteModalOpen(true);
  };

  const handleChangePassword = (user: User) => {
    setUserToEdit(user);
    setEditPassword("");
    setIsPasswordModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToEdit) return;
    setIsActionLoading(true);
    try {
      await userService.deleteUser(userToEdit.id);
      setIsDeleteModalOpen(false);
      setUserToEdit(null);
      setSelectedStudent(null);
      loadData();
      showAlert("Alumno eliminado con éxito", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmPasswordChange = async () => {
    if (!userToEdit || !editPassword) return;
    setIsActionLoading(true);
    try {
      await userService.updateUserPassword(userToEdit.id, editPassword);
      setIsPasswordModalOpen(false);
      setUserToEdit(null);
      setEditPassword("");
      showAlert("Contraseña actualizada con éxito", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReviewTask = async (task: Task, status: "approved" | "rejected" | "pending", score?: number) => {
    setIsActionLoading(true);
    try {
      await taskService.updateTask(task.id, { 
        status, 
        score: score !== undefined ? score : task.score 
      });
      if (selectedStudent) loadStudentTasks(selectedStudent.id);
      setShowScoreModal(false);
      setTaskToReview(null);
      showAlert(
        status === "approved" ? "Tarea aprobada con éxito" : 
        status === "rejected" ? "Tarea rechazada" : "Tarea reabierta para el alumno",
        { type: "success" }
      );
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsActionLoading(true);
    try {
      await taskService.deleteTask(taskToDelete.id);
      setShowDeleteTaskModal(false);
      setTaskToDelete(null);
      if (selectedStudent) loadStudentTasks(selectedStudent.id);
      showAlert("Tarea eliminada", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="text-indigo-500 animate-spin" size={48} />
        <p className="text-gray-400 font-bold">Cargando tus alumnos...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center shadow-lg">
            <GraduationCap size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900">Panel de Tutor</h1>
            <p className="text-gray-500 font-bold">Gestionando {students.length} alumnos activos</p>
          </div>
        </div>
        <button 
          onClick={() => setShowUserCreator(true)}
          className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all hover:scale-105"
        >
          <UserPlus size={24} /> Registrar Alumno
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de Alumnos */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-gray-400 uppercase tracking-widest ml-4">Mis Alumnos</h2>
          {students.length === 0 ? (
            <div className="bg-gray-50 border-4 border-dashed border-gray-100 p-8 rounded-3xl text-center">
              <p className="text-gray-400 font-bold italic">Aún no tienes alumnos registrados.</p>
            </div>
          ) : (
            students.map(s => (
              <div 
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className={`flex items-center justify-between p-6 rounded-3xl border-4 cursor-pointer transition-all ${
                  selectedStudent?.id === s.id ? "bg-white border-indigo-200 shadow-lg scale-[1.02]" : "bg-gray-50 border-transparent hover:bg-gray-100 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500 font-black">
                    {s.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-800 leading-tight">{s.username}</p>
                    {selectedStudent?.id === s.id && (
                    <div className="flex gap-3 mt-2 animate-in fade-in zoom-in-50 duration-300">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleChangePassword(s); }}
                          className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-600"
                        >
                          <Settings2 size={14} className="inline mr-1" /> Clave
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteStudent(s); }}
                          className="text-[10px] font-black uppercase text-red-300 hover:text-red-500"
                        >
                          <Trash2 size={14} className="inline mr-1" /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className={selectedStudent?.id === s.id ? "text-indigo-500" : "text-gray-300"} />
              </div>
            ))
          )}
        </div>

        {/* Detalle del Alumno Seleccionado */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStudent ? (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 mb-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <Users className="text-indigo-500" /> Actividades de {selectedStudent.username}
                  </h3>
                  <button 
                    onClick={() => setShowTaskCreator(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-black shadow-md hover:bg-emerald-600 transition-all active:scale-95"
                  >
                    <Plus size={20} /> Asignar Tarea
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Actividades Actuales */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                       <Clock size={16} /> Actividades Actuales
                    </h4>
                    {studentTasks.filter(t => !['approved', 'rejected'].includes(t.status)).length === 0 ? (
                      <p className="text-gray-400 font-bold italic text-center py-6 bg-gray-50 rounded-2xl">No hay tareas activas.</p>
                    ) : (
                      studentTasks.filter(t => !['approved', 'rejected'].includes(t.status)).map(t => (
                        <div key={t.id} className="flex flex-col gap-4 p-5 bg-white rounded-2xl border-4 border-indigo-50 hover:border-indigo-100 transition-all shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${t.type === 'dictation' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {t.type === 'dictation' ? <BookOpen size={20} /> : <Home size={20} />}
                              </div>
                              <div>
                                <p className="font-black text-gray-800">{t.title}</p>
                                <p className="text-xs font-bold text-gray-400">Asignada el {new Date(t.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {t.status === 'completed' || t.status === 'failed' ? (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                                  <button 
                                    onClick={() => { setTaskToReview(t); setReviewScore(100); setShowScoreModal(true); }}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md hover:bg-emerald-600 transition-all"
                                  >
                                    Aprobar
                                  </button>
                                  <button 
                                    onClick={() => handleReviewTask(t, "rejected")}
                                    className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-black text-xs hover:bg-red-200 transition-all"
                                  >
                                    Rechazar
                                  </button>
                                  <button 
                                    onClick={() => handleReviewTask(t, "pending")}
                                    className="px-4 py-2 bg-amber-100 text-amber-600 rounded-xl font-black text-xs hover:bg-amber-200 transition-all"
                                  >
                                    Reabrir
                                  </button>
                                </div>
                              ) : (
                                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-black uppercase">
                                  En Progreso
                                </span>
                              )}
                              <button
                                onClick={() => { setTaskToDelete(t); setShowDeleteTaskModal(true); }}
                                title="Eliminar tarea"
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {(t.reason_not_done || t.metadata?.evidence) && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                              {t.status === 'failed' && t.reason_not_done && (
                                <div className="flex gap-2 items-start text-sm">
                                  <AlertTriangle size={16} className="text-orange-500 mt-1 shrink-0" />
                                  <p className="text-gray-600 italic font-bold">" {t.reason_not_done} "</p>
                                </div>
                              )}
                              {t.metadata?.evidence && (
                                <div className="mt-2">
                                  <div 
                                    onClick={() => setSelectedEvidence(t.metadata.evidence)}
                                    className="relative w-32 aspect-video rounded-lg overflow-hidden border-2 border-white cursor-zoom-in shadow-sm"
                                  >
                                    <AsyncImageWithSkeleton src={t.metadata.evidence} alt="Evidencia" className="w-full h-full" />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Historial */}
                  <div className="space-y-4 pt-4 border-t-2 border-indigo-50">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                       <DatabaseZap size={16} /> Historial
                    </h4>
                    {studentTasks.filter(t => ['approved', 'rejected'].includes(t.status)).length === 0 ? (
                      <p className="text-gray-300 font-bold italic text-center py-4">No hay tareas en el historial.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 opacity-60 hover:opacity-100 transition-opacity">
                        {studentTasks.filter(t => ['approved', 'rejected'].includes(t.status)).map(t => (
                          <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${t.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                {t.status === 'approved' ? <CheckCircle2 size={16} /> : <X size={16} />}
                              </div>
                              <div>
                                <p className="font-bold text-gray-700 text-sm">{t.title}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase">{t.status === 'approved' ? `Aprobada • ${t.score} pts` : 'Rechazada'}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleReviewTask(t, "pending")}
                              className="text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase"
                            >
                              Reactivar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-indigo-50/30 border-4 border-dashed border-indigo-100/50 p-20 rounded-[3rem] text-center flex flex-col items-center justify-center gap-4 h-full min-h-[400px]">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-200">
                <Users size={40} />
              </div>
              <h3 className="text-2xl font-black text-indigo-900/30">Selecciona un alumno</h3>
              <p className="text-indigo-400/50 font-bold">Toca el nombre de un alumno a la izquierda para ver su progreso.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {showUserCreator && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-inner animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-3xl font-black text-gray-900 mb-6">Agregar Alumno</h2>
            
            {/* Tabs */}
            <div className="flex bg-gray-100 p-2 rounded-2xl mb-8">
              <button 
                onClick={() => setActiveTab("create")}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${activeTab === "create" ? "bg-white shadow-md text-indigo-600" : "text-gray-400"}`}
              >
                Registrar Nuevo
              </button>
              <button 
                onClick={() => setActiveTab("assign")}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${activeTab === "assign" ? "bg-white shadow-md text-indigo-600" : "text-gray-400"}`}
              >
                Vincular Existente
              </button>
            </div>

            {activeTab === "create" ? (
              <form onSubmit={handleCreateStudent} className="space-y-6">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Nombre del alumno"
                  className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
                />
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contraseña sugerida"
                  className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
                />
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowUserCreator(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-black"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700"
                  >
                    Registrar
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {availableStudents.length === 0 ? (
                    <p className="text-gray-400 font-bold italic text-center py-4">No hay otros alumnos disponibles en el sistema.</p>
                  ) : (
                    availableStudents.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all group">
                        <span className="font-black text-gray-700">{s.username}</span>
                        <button 
                          onClick={() => handleAssignStudent(s.id)}
                          className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          Vincular
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <button 
                  onClick={() => setShowUserCreator(false)}
                  className="w-full py-4 bg-gray-100 text-gray-500 rounded-xl font-black"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showScoreModal && (
        <Modal
          isOpen={showScoreModal}
          onClose={() => setShowScoreModal(false)}
          title="Calificar Tarea"
        >
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Star size={40} fill="currentColor" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">¿Qué puntaje le darías?</p>
              <p className="text-gray-500 font-bold">Evalúa el esfuerzo de <span className="text-emerald-600">{selectedStudent?.username}</span></p>
            </div>
            
            <div className="space-y-4">
              <div className="text-4xl font-black text-indigo-600">{reviewScore} pts</div>
              <input 
                type="range" min="0" max="100" step="5" value={reviewScore} 
                onChange={(e) => setReviewScore(parseInt(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowScoreModal(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-black"
              >
                Cancelar
              </button>
              <button 
                onClick={() => taskToReview && handleReviewTask(taskToReview, "approved", reviewScore)}
                disabled={isActionLoading}
                className="flex-[2] py-4 bg-emerald-500 text-white rounded-xl font-black shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50"
              >
                Confirmar y Aprobar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showTaskCreator && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex justify-center p-4 overflow-y-auto pt-8">
          <div className="relative h-fit mb-12 animate-in slide-in-from-top-4 duration-500">
            <TaskCreator 
              studentId={selectedStudent.id}
              onTaskCreated={() => {
                setShowTaskCreator(false);
                loadStudentTasks(selectedStudent.id);
              }}
              onCancel={() => setShowTaskCreator(false)}
            />
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar tarea */}
      <Modal
        isOpen={showDeleteTaskModal}
        onClose={() => { setShowDeleteTaskModal(false); setTaskToDelete(null); }}
        title="Eliminar Tarea"
      >
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Trash2 size={40} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">¿Eliminar esta tarea?</p>
            <p className="text-gray-500 font-bold mt-1">Se eliminará <span className="text-red-600">«{taskToDelete?.title}»</span> y no podrá recuperarse.</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => { setShowDeleteTaskModal(false); setTaskToDelete(null); }}
              className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteTask}
              disabled={isActionLoading}
              className="flex-1 py-4 bg-red-500 text-white rounded-xl font-black shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isActionLoading ? <Loader2 className="animate-spin" /> : "Sí, Eliminar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modales de Gestión de Alumno */}
      <Modal 
        isOpen={isPasswordModalOpen} 
        onClose={() => {
          setIsPasswordModalOpen(false);
          setUserToEdit(null);
        }}
        title="Cambiar Contraseña Alumno"
      >
        <div className="space-y-6">
          <p className="text-gray-500 font-bold">Escribe la nueva contraseña para el alumno <span className="text-indigo-600">@{userToEdit?.username}</span></p>
          <input 
            type="text"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
          />
          <button 
            onClick={confirmPasswordChange}
            disabled={isActionLoading || !editPassword}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isActionLoading ? <Loader2 className="animate-spin" /> : "Actualizar Contraseña"}
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToEdit(null);
        }}
        title="Eliminar Alumno"
      >
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={40} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">¿Estás seguro?</p>
            <p className="text-gray-500 font-bold">Estás a punto de eliminar al alumno <span className="text-red-600">@{userToEdit?.username}</span>. Se perderá todo su progreso y tareas.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-black transition-all hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button 
              onClick={confirmDelete}
              disabled={isActionLoading}
              className="flex-1 py-4 bg-red-500 text-white rounded-xl font-black shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isActionLoading ? <Loader2 className="animate-spin" /> : "Sí, Eliminar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Visor de Evidencia */}
      {selectedEvidence && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[500] flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setSelectedEvidence(null)}
        >
          <button className="absolute top-8 right-8 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={40} />
          </button>
          <img 
            src={selectedEvidence} 
            alt="Evidencia Ampliada" 
            className="max-w-full max-h-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
