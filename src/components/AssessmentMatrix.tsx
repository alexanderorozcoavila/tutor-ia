"use client";

import { useState, useEffect } from "react";
import { userService, User } from "@/lib/userService";
import { planService, TareaPlanificada } from "@/lib/planService";
import { lmsService, Subject, Objective, AssessmentTemplate } from "@/lib/lmsService";
import { useAuth } from "@/lib/AuthContext";
import { 
  Loader2, FileText, Download, Filter, 
  Search, BookA, GraduationCap, Calendar, Star 
} from "lucide-react";

export function AssessmentMatrix() {
  const { user: tutor } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [allAssessments, setAllAssessments] = useState<TareaPlanificada[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");

  useEffect(() => {
    if (tutor) loadData();
  }, [tutor]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Cargar Alumnos
      const studs = await userService.getStudentsForTutor(tutor!.id);
      setStudents(studs);

      // 2. Cargar Estructura Académica (Materias, Objetivos, Templates)
      const subs = await lmsService.getTutorSubjects(tutor!.id);
      setSubjects(subs);
      
      const allObjs: Objective[] = [];
      const allTemps: AssessmentTemplate[] = [];

      for (const s of subs) {
        const objs = await lmsService.getObjectives(s.id);
        allObjs.push(...objs);
        for (const o of objs) {
          const temps = await lmsService.getAssessmentTemplates(o.id);
          allTemps.push(...temps);
        }
      }
      setObjectives(allObjs);
      setTemplates(allTemps);

      // 3. Cargar todas las evaluaciones de los planes de estos alumnos
      const assessments: TareaPlanificada[] = [];
      for (const stud of studs) {
        const evalu = await planService.getTareasPlanificadasAlumno(stud.id, 'assessment');
        assessments.push(...evalu);
      }
      setAllAssessments(assessments);

    } catch (err) {
      console.error("Error cargando matriz de notas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSubjectName = (templateId: string) => {
    const temp = templates.find(t => t.id === templateId);
    if (!temp) return "N/A";
    const obj = objectives.find(o => o.id === temp.objective_id);
    if (!obj) return "N/A";
    const sub = subjects.find(s => s.id === obj.subject_id);
    return sub?.name || "N/A";
  };

  const getTemplateTitle = (templateId: string) => {
    return templates.find(t => t.id === templateId)?.title || "Evaluación";
  };

  const filteredData = allAssessments.filter(a => {
    const passStudent = filterStudent === "all" || a.alumno_id === filterStudent;
    if (!passStudent) return false;
    
    if (filterSubject !== "all") {
      const temp = templates.find(t => t.id === a.modulo_id);
      const obj = objectives.find(o => o.id === temp?.objective_id);
      return obj?.subject_id === filterSubject;
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
        <p className="text-gray-400 font-bold">Generando matriz de notas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Filtros (Oculto en impresión) */}
      <div className="print:hidden bg-white p-6 rounded-[2rem] border-2 border-emerald-50 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800">Matriz de Rendimiento</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reporte consolidado de evaluaciones</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <GraduationCap size={16} className="text-gray-400" />
            <select 
              value={filterStudent}
              onChange={(e) => setFilterStudent(e.target.value)}
              className="bg-transparent text-xs font-black outline-none text-gray-700"
            >
              <option value="all">Todos los Alumnos</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <BookA size={16} className="text-gray-400" />
            <select 
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-transparent text-xs font-black outline-none text-gray-700"
            >
              <option value="all">Todas las Materias</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-emerald-700 transition-all hover:scale-105"
          >
            <Download size={16} /> Descargar PDF
          </button>
        </div>
      </div>

      {/* Tabla de Matriz */}
      <div className="bg-white rounded-[2rem] border-2 border-gray-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-100">
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Alumno</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Materia</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Evaluación</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Estado</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Puntaje</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Nota Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-gray-400 font-bold italic">
                    No se encontraron evaluaciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredData.map(evalu => {
                  const stud = students.find(s => s.id === evalu.alumno_id);
                  const isCompletada = evalu.estado === 'completada';
                  const scoreLatam = evalu.metadata?.assessment_score_latam;

                  return (
                    <tr key={evalu.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                            {stud?.username[0].toUpperCase()}
                          </div>
                          <span className="font-black text-gray-800">{stud?.username}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-bold text-[10px] uppercase">
                          {getSubjectName(evalu.modulo_id)}
                        </span>
                      </td>
                      <td className="p-6">
                        <div>
                          <p className="font-black text-gray-700 text-sm">{getTemplateTitle(evalu.modulo_id)}</p>
                          <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                            <Calendar size={10} /> 
                            {evalu.fecha_completado ? new Date(evalu.fecha_completado).toLocaleDateString() : 'Pendiente'}
                          </p>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          isCompletada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isCompletada ? 'Realizada' : 'Asignada'}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <span className="font-black text-gray-600">
                          {isCompletada ? `${evalu.puntos_valor} pts` : '-'}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        {isCompletada ? (
                          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl font-black text-lg shadow-sm border-2 ${
                            scoreLatam >= 6.0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                            scoreLatam >= 4.0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 
                            'bg-red-50 border-red-200 text-red-600'
                          }`}>
                            {scoreLatam?.toFixed(1)}
                          </div>
                        ) : (
                          <span className="text-gray-300 font-black italic">---</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estilos para impresión */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .shadow-xl, .shadow-sm { box-shadow: none !important; }
          .rounded-\\[2rem\\], .rounded-[2.5rem] { border-radius: 0 !important; }
          table { border: 1px solid #eee !important; width: 100% !important; }
          th, td { border-bottom: 1px solid #eee !important; }
          @page { margin: 20mm; }
        }
      `}</style>
    </div>
  );
}
