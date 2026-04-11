"use client";

import { useSession } from "@/components/SessionProvider";
import { getTutorDashboardData } from "@/actions/studentActions";
import { useEffect, useState } from "react";
import { User, Trophy, Clock, AlertCircle, Tv } from "lucide-react";
import TvControlPanel from "@/components/TvControlPanel";

export default function DashboardPage() {
  const { xp, user } = useSession();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const isAdmin = (user as any)?.role === 'admin';

  const toggleTvPanel = (studentId: string) => {
    setExpandedStudentId(prev => (prev === studentId ? null : studentId));
  };

  useEffect(() => {
    getTutorDashboardData()
      .then(setStudents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-8 pt-12">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-gray-900 mb-2 font-sans">Panel del Tutor</h1>
        <p className="text-gray-500 text-lg">Monitorea el progreso y los logros de tus alumnos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Stats Cards */}
        <div className="theme-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-gray-500 font-medium font-sans uppercase text-[10px] tracking-widest">XP Total Acumulada</p>
            <p className="text-2xl font-black text-gray-900">{xp} puntos</p>
          </div>
        </div>

        <div className="theme-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-gray-500 font-medium font-sans uppercase text-[10px] tracking-widest">Tiempo de Práctica</p>
            <p className="text-2xl font-black text-gray-900">15 min hoy</p>
          </div>
        </div>

        <div className="theme-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-gray-500 font-medium font-sans uppercase text-[10px] tracking-widest">Estado de Alerta</p>
            <p className="text-2xl font-black text-green-600">Todo bien 👍</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <User className="text-blue-500" />
          Mis Alumnos
        </h2>
        
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
             <thead className="bg-gray-50 border-b border-gray-100">
               <tr>
                 <th className="px-8 py-4 text-gray-500 font-medium italic">Nombre</th>
                 <th className="px-8 py-4 text-gray-500 font-medium italic">Preferencia</th>
                 <th className="px-8 py-4 text-gray-500 font-medium italic">XP</th>
                 <th className="px-8 py-4 text-gray-200 font-medium italic">{isAdmin ? 'TV' : '...'}</th>
               </tr>
             </thead>
             <tbody>
               {loading ? (
                 <tr>
                   <td colSpan={4} className="px-8 py-12 text-center text-gray-400">Cargando datos...</td>
                 </tr>
               ) : students.length > 0 ? (
                 students.map(s => (
                   <>
                     <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                       <td className="px-8 py-5 font-bold text-gray-800">{s.name || s.username}</td>
                       <td className="px-8 py-5 text-gray-600">{s.theme_preference || '—'}</td>
                       <td className="px-8 py-5 text-indigo-600 font-black">{s.xp_points ?? 0} XP</td>
                       <td className="px-8 py-5">
                         {isAdmin ? (
                           <button
                             id={`btn-tv-config-${s.id}`}
                             onClick={() => toggleTvPanel(s.id)}
                             className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                               expandedStudentId === s.id
                                 ? 'bg-indigo-600 text-white'
                                 : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                             }`}
                           >
                             <Tv size={13} />
                             {expandedStudentId === s.id ? 'Cerrar' : 'Config TV'}
                           </button>
                         ) : (
                           <span className="text-gray-400">Ver más</span>
                         )}
                       </td>
                     </tr>
                     {isAdmin && expandedStudentId === s.id && (
                       <tr key={`${s.id}-tv`}>
                         <td colSpan={4} className="px-8 pb-6">
                           <TvControlPanel
                             studentId={s.id}
                             studentName={s.name || s.username}
                           />
                         </td>
                       </tr>
                     )}
                   </>
                 ))
               ) : (
                 <tr>
                   <td colSpan={4} className="px-8 py-12 text-center text-gray-400">
                     Aún no tienes alumnos registrados en Supabase.
                   </td>
                 </tr>
               )}
             </tbody>
          </table>
        </div>
      </section>
    </div>

  );
}
