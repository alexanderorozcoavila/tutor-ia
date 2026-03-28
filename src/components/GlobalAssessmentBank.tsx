"use client";

import { useState, useEffect } from "react";
import { lmsService, Subject, Objective, AssessmentTemplate } from "@/lib/lmsService";
import { planService, PlanSemanal } from "@/lib/planService";
import { useAuth } from "@/lib/AuthContext";
import { BookA, Target, ClipboardSignature, Plus, ArrowLeft, Loader2, Play, Users, Search } from "lucide-react";
import { useAlert } from "@/lib/AlertContext";
import { AssessmentCreator } from "./AssessmentCreator";
import { Modal } from "./Modal";
import { User, userService } from "@/lib/userService";
import { taskService, AssessmentQuestion } from "@/lib/taskService";

export function GlobalAssessmentBank() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activeObjective, setActiveObjective] = useState<Objective | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [newObjectiveName, setNewObjectiveName] = useState("");

  // Nivel de Asignación
  const [templateToAssign, setTemplateToAssign] = useState<AssessmentTemplate | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [studentPlans, setStudentPlans] = useState<Record<string, PlanSemanal[]>>({});
  const [targetPlans, setTargetPlans] = useState<Record<string, string>>({}); // studentId -> planId
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  useEffect(() => {
    if (user) loadSubjects();
  }, [user]);

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      const data = await lmsService.getTutorSubjects(user!.id);
      setSubjects(data);
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadObjectives = async (subject: Subject) => {
    setActiveSubject(subject);
    setActiveObjective(null);
    setTemplates([]);
    try {
      const data = await lmsService.getObjectives(subject.id);
      setObjectives(data);
    } catch(err: any){
      showAlert(err.message, { type: "error" });
    }
  };

  const loadTemplates = async (objective: Objective) => {
    setActiveObjective(objective);
    try {
      const data = await lmsService.getAssessmentTemplates(objective.id);
      setTemplates(data);
    } catch(err: any){
      showAlert(err.message, { type: "error" });
    }
  };

  const handleCreateObjective = async () => {
    if (!activeSubject || !newObjectiveName.trim()) return;
    try {
      await lmsService.createObjective({
        subject_id: activeSubject.id,
        name: newObjectiveName
      });
      setNewObjectiveName("");
      setIsObjectiveModalOpen(false);
      loadObjectives(activeSubject);
    } catch(err: any) {
      showAlert(err.message, { type: "error" });
    }
  };

  const startAssignment = async (template: AssessmentTemplate) => {
    setTemplateToAssign(template);
    setSelectedStudents([]);
    try {
      const studs = await userService.getStudentsForTutor(user!.id);
      setStudents(studs);
      setIsAssignModalOpen(true);
      
      // Cargar planes de una vez
      setIsLoadingPlans(true);
      const plansMap: Record<string, PlanSemanal[]> = {};
      const targetMap: Record<string, string> = {};
      
      for (const s of studs) {
        const p = await planService.getAllPlanesAlumno(s.id);
        plansMap[s.id] = p;
        if (p.length > 0) targetMap[s.id] = p[0].id; // Default al más reciente/activo
      }
      setStudentPlans(plansMap);
      setTargetPlans(targetMap);
      setIsLoadingPlans(false);

    } catch(err: any) {
      showAlert(err.message, { type: "error" });
    }
  };

  const handleAssignToStudents = async () => {
    if (!templateToAssign || selectedStudents.length === 0) return;
    setIsAssigning(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const studentId of selectedStudents) {
        const selectedPlanId = targetPlans[studentId];
        
        if (selectedPlanId) {
          // Caso ÉXITO: Asignar al plan semanal (LMS Nuevo)
          await planService.assignAssessmentToPlan(
            selectedPlanId, 
            templateToAssign.id, 
            studentId,
            20 // Puntos base para exámenes
          );
          successCount++;
        } else {
          failCount++;
        }
      }

      setIsAssignModalOpen(false);
      if (failCount === 0) {
        showAlert(`Evaluación asignada a ${successCount} planes semanales.`, { type: "success" });
      } else if (successCount > 0) {
        showAlert(`Asignada a ${successCount} alumnos. ${failCount} alumnos no tienen un plan semanal activo.`, { type: "info" });
      } else {
        showAlert("No se pudo asignar. Los alumnos seleccionados no tienen un plan semanal activo.", { type: "error" });
      }
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsAssigning(false);
    }
  };

  if (isCreatorOpen && activeObjective) {
    return (
      <AssessmentCreator 
        objective={activeObjective} 
        onCancel={() => setIsCreatorOpen(false)}
        onSaved={() => {
          setIsCreatorOpen(false);
          loadTemplates(activeObjective);
        }}
      />
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-500">
      
      {/* Nivel 1: Materias */}
      {!activeSubject && (
        <div className="space-y-6">
          <div className="bg-gradient-to-tr from-indigo-900 to-purple-800 rounded-[2rem] p-8 shadow-xl text-white">
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3"><BookA /> Tus Materias Asignadas</h2>
            <p className="text-indigo-200 font-bold">Selecciona una materia para gestionar sus evaluaciones.</p>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40}/></div>
          ) : subjects.length === 0 ? (
            <div className="p-12 text-center border-4 border-dashed border-gray-200 rounded-[2rem]">
              <p className="font-bold text-gray-500">No tienes materias asignadas por el administrador.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map(s => (
                <button 
                  key={s.id}
                  onClick={() => loadObjectives(s)}
                  className="bg-white p-8 rounded-[2rem] border-4 border-purple-50 hover:border-purple-200 hover:shadow-xl transition-all text-left group"
                >
                  <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <BookA size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-800">{s.name}</h3>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nivel 2: Objetivos */}
      {activeSubject && !activeObjective && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveSubject(null)} className="flex items-center gap-2 text-purple-600 font-bold hover:underline mb-2">
            <ArrowLeft size={16} /> Volver a Materias
          </button>
          
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm">
            <div>
              <h2 className="text-3xl font-black text-gray-800">{activeSubject.name}</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">Objetivos de la Materia</p>
            </div>
            <button 
              onClick={() => setIsObjectiveModalOpen(true)}
              className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <Plus size={18} /> Crear Objetivo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {objectives.length === 0 && <p className="col-span-full p-8 text-center text-gray-400 font-bold">No hay objetivos creados. Crea uno para poder alojar evaluaciones.</p>}
            {objectives.map(o => (
              <button 
                key={o.id}
                onClick={() => loadTemplates(o)}
                className="bg-white p-6 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:shadow-md transition-all text-left flex items-start gap-4"
              >
                <div className="bg-gray-50 text-gray-400 p-3 rounded-xl"><Target size={24} /></div>
                <div>
                  <h3 className="font-black text-lg text-gray-800">{o.name}</h3>
                  {o.description && <p className="text-sm text-gray-500 mt-1">{o.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nivel 3: Evaluaciones del Objetivo */}
      {activeObjective && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <button onClick={() => setActiveObjective(null)} className="flex items-center gap-2 text-purple-600 font-bold hover:underline mb-2">
            <ArrowLeft size={16} /> Volver a Objetivos
          </button>
          
          <div className="flex justify-between items-center bg-purple-900 p-8 rounded-[2.5rem] shadow-lg text-white">
            <div>
              <p className="text-purple-300 font-bold uppercase tracking-widest text-xs mb-2">Evaluaciones del Objetivo</p>
              <h2 className="text-3xl font-black">{activeObjective.name}</h2>
            </div>
            <button 
              onClick={() => setIsCreatorOpen(true)}
              className="bg-purple-500 hover:bg-purple-400 text-white px-6 py-4 rounded-xl font-black flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
            >
              <Plus size={20} /> Crear Nueva Evaluación
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.length === 0 && <p className="col-span-full p-12 text-center text-gray-400 font-bold bg-white rounded-3xl border-2 border-dashed">No hay plantillas de evaluación aquí.</p>}
            {templates.map(t => (
              <div key={t.id} className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-gray-50 flex flex-col justify-between gap-6">
                <div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                    <ClipboardSignature size={24} />
                  </div>
                  <h3 className="font-black text-xl text-gray-900">{t.title}</h3>
                  <div className="flex gap-4 mt-3">
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{t.questions.length} preguntas</span>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{t.time_limit_seconds > 0 ? `${t.time_limit_seconds / 60} mins` : 'Libre'}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => startAssignment(t)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Asignar a Alumno
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para Crear Objetivo */}
      <Modal isOpen={isObjectiveModalOpen} onClose={() => setIsObjectiveModalOpen(false)} title="Nuevo Objetivo">
        <div className="space-y-4">
          <input 
            type="text" 
            value={newObjectiveName}
            onChange={(e) => setNewObjectiveName(e.target.value)}
            placeholder="Ej: Comprensión Lectora de Leyendas"
            className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none font-bold focus:border-purple-300"
          />
          <button 
            onClick={handleCreateObjective}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-black shadow-md active:scale-95"
          >
            Guardar Objetivo
          </button>
        </div>
      </Modal>

      {/* Modal para Asignar */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Asignar Cuestionario">
        <div className="space-y-4 max-h-[70vh] flex flex-col">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <h3 className="font-black text-emerald-800">{templateToAssign?.title}</h3>
            <p className="text-xs text-emerald-600 font-bold mt-1">Selecciona uno o más alumnos para asignar.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 border-y py-4">
            {students.length === 0 && <p className="text-center font-bold text-gray-400">No tienes alumnos.</p>}
            {students.map(s => {
              const isSelected = selectedStudents.includes(s.id);
              const plans = studentPlans[s.id] || [];
              
              return (
                <div key={s.id} className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white opacity-60'}`}>
                  <div 
                    className="flex items-center justify-between mb-3 cursor-pointer"
                    onClick={() => {
                      if (isSelected) setSelectedStudents(prev => prev.filter(id => id !== s.id));
                      else setSelectedStudents(prev => [...prev, s.id]);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`} />
                      <span className="font-bold text-gray-800 uppercase text-xs">{s.username}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest pl-1">Semana del Examen</label>
                      {isLoadingPlans ? (
                        <div className="text-[10px] text-gray-400 font-bold italic py-1">Cargando planes...</div>
                      ) : plans.length === 0 ? (
                        <div className="text-[10px] text-red-500 font-bold italic py-1">⚠️ Sin planes disponibles</div>
                      ) : (
                        <select 
                          value={targetPlans[s.id] || ""}
                          onChange={(e) => setTargetPlans({ ...targetPlans, [s.id]: e.target.value })}
                          className="w-full p-2 rounded-lg bg-white border-2 border-purple-100 text-[10px] font-black text-gray-700 outline-none focus:border-purple-400 transition-colors"
                        >
                          {plans.map(p => (
                            <option key={p.id} value={p.id}>
                              Plan del {new Date(p.fecha_inicio).toLocaleDateString()}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button 
            onClick={handleAssignToStudents}
            disabled={isAssigning || selectedStudents.length === 0}
            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAssigning ? <Loader2 className="animate-spin" /> : <><Users size={20} /> Distribuir Tareas</>}
          </button>
        </div>
      </Modal>
    </div>
  );
}
