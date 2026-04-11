'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { userService } from '@/lib/userService';
import { getTvConfigByStudent, upsertTvConfig } from '@/actions/tvConfigActions';
import type { TvConfig } from '@/lib/settingsService';
import {
  Tv,
  Power,
  Clock,
  Wifi,
  CheckCircle,
  AlertCircle,
  Loader2,
  Bell,
  ArrowLeft,
  User,
  ChevronRight,
  Shield,
} from 'lucide-react';

interface StudentWithConfig {
  id: string;
  name: string;
  config: TvConfig | null;
  loading: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const DEFAULT_CONFIG: Omit<TvConfig, 'id' | 'updated_at' | 'updated_by'> = {
  student_id: '',
  device_ip: '192.168.1.100',
  force_power_off: false,
  restricted_start_time: null,
  restricted_end_time: null,
  is_active: true,
  warning_message: '¡Atención! La TV se apagará pronto.',
  warning_minutes_before: 5,
};

export default function TvControlMobilePage() {
  const { user, logout } = useAuth();
  const [students, setStudents] = useState<StudentWithConfig[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithConfig | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allUsers = await userService.getAllUsers();
        // Filtrar usuarios alumno
        const studentUsers = allUsers.filter((u) => u.role === 'student');
        const mapped: StudentWithConfig[] = studentUsers.map((s) => ({
          id: s.id,
          name: s.username,
          config: null,
          loading: false,
        }));
        setStudents(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStudents(false);
      }
    }
    load();
  }, []);

  const selectStudent = async (student: StudentWithConfig) => {
    setSelectedStudent({ ...student, loading: true });
    try {
      const data = await getTvConfigByStudent(student.id);
      setSelectedStudent({
        ...student,
        config: data || { ...DEFAULT_CONFIG, student_id: student.id } as TvConfig,
        loading: false,
      });
    } catch (err) {
      console.error(err);
      setSelectedStudent({
        ...student,
        config: { ...DEFAULT_CONFIG, student_id: student.id } as TvConfig,
        loading: false,
      });
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <p>Solo disponible para administradores.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans w-full max-w-md mx-auto relative shadow-2xl">
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        {selectedStudent ? (
          <button
            onClick={() => setSelectedStudent(null)}
            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-400"
          >
            <ArrowLeft size={18} />
            Atrás
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-indigo-400" />
            <span className="font-black text-sm">Control TV (Mobile)</span>
          </div>
        )}
        <button
          onClick={logout}
          className="text-xs font-semibold text-red-400 bg-red-400/10 px-3 py-1.5 rounded-lg"
        >
          Salir
        </button>
      </header>

      <main className="pb-8 overflow-y-auto">
        {!selectedStudent ? (
          <StudentList
            students={students}
            loading={loadingStudents}
            onSelect={selectStudent}
          />
        ) : selectedStudent.loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        ) : (
          <StudentTvConfig
            student={selectedStudent}
            onConfigChange={(updated) =>
              setSelectedStudent({ ...selectedStudent, config: updated })
            }
          />
        )}
      </main>
    </div>
  );
}

function StudentList({
  students,
  loading,
  onSelect,
}: {
  students: StudentWithConfig[];
  loading: boolean;
  onSelect: (s: StudentWithConfig) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-indigo-400" size={28} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-black mb-1">Alumnos</h1>
      <p className="text-sm text-gray-400 mb-6">
        Selecciona un alumno para configurar su televisor.
      </p>
      {students.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Sin alumnos registrados.</div>
      ) : (
        <div className="space-y-3">
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="w-full flex items-center gap-3 bg-white/5 active:bg-white/10 rounded-2xl p-4 transition text-left border border-white/5"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <User size={18} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{s.name}</p>
                <p className="text-xs text-gray-500">Toca para configurar</p>
              </div>
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentTvConfig({
  student,
  onConfigChange,
}: {
  student: StudentWithConfig;
  onConfigChange: (c: TvConfig) => void;
}) {
  const config = student.config!;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (updated: TvConfig) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveState('saving');
      debounceRef.current = setTimeout(async () => {
        try {
          await upsertTvConfig({ ...updated, student_id: student.id });
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        } catch {
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 3000);
        }
      }, 700);
    },
    [student.id],
  );

  const handleChange = <K extends keyof TvConfig>(key: K, value: TvConfig[K]) => {
    const updated = { ...config, [key]: value };
    onConfigChange(updated);
    persist(updated);
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">{student.name}</h2>
          <p className="text-xs text-gray-500">Control parental Smart TV</p>
        </div>
        <div>
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Guardando
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle size={12} /> Guardado
            </span>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-2xl p-4 text-center text-sm font-bold border border-gray-700">
        {config.is_active ? '🟢 Servicio de bloqueo Activo' : '⚪ Bloqueo Inactivo'}
      </div>

      <ToggleCard
        icon={<Tv size={18} />}
        label="Sistema activo"
        sublabel="Habilita rutinas automáticas"
        value={config.is_active}
        onChange={(v) => handleChange('is_active', v)}
        accent="indigo"
      />

      <ToggleCard
        icon={<Power size={18} />}
        label="Apagar TV ahora"
        sublabel="Sobrescribe cualquier horario"
        value={config.force_power_off}
        onChange={(v) => handleChange('force_power_off', v)}
        accent="red"
      />

      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <label className="text-sm font-bold mb-3 flex items-center gap-2">
          <Clock size={16} className="text-indigo-400" />
          Horario Restringido
        </label>
        <div className="flex gap-3">
          <input
            type="time"
            value={config.restricted_start_time?.slice(0, 5) ?? ''}
            onChange={(e) => handleChange('restricted_start_time', e.target.value ? `${e.target.value}:00` : null)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
          />
          <span className="self-center">hasta</span>
          <input
            type="time"
            value={config.restricted_end_time?.slice(0, 5) ?? ''}
            onChange={(e) => handleChange('restricted_end_time', e.target.value ? `${e.target.value}:00` : null)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <label className="text-sm font-bold mb-2 flex items-center gap-2">
          <Bell size={16} className="text-amber-400" /> Alerta en TV
        </label>
        <input
          type="number"
          placeholder="Minutos antes (ej: 5)"
          value={config.warning_minutes_before}
          onChange={(e) => handleChange('warning_minutes_before', Number(e.target.value))}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm mb-2"
        />
        <input
          type="text"
          placeholder="Mensaje de aviso"
          value={config.warning_message}
          onChange={(e) => handleChange('warning_message', e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function ToggleCard({
  icon, label, sublabel, value, onChange, accent,
}: {
  icon: React.ReactNode; label: string; sublabel: string; value: boolean; onChange: (v: boolean) => void; accent: 'indigo'|'red'
}) {
  const bg = value ? (accent === 'red' ? 'bg-red-500/10 border-red-500' : 'bg-indigo-500/10 border-indigo-500') : 'bg-white/5 border-transparent';
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${bg}`} onClick={() => onChange(!value)}>
      <div className="flex gap-3 items-center">
        {icon}
        <div>
          <p className="font-bold text-sm">{label}</p>
          <p className="text-xs text-gray-500">{sublabel}</p>
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full cursor-pointer relative ${value ? (accent==='red'?'bg-red-500':'bg-indigo-500') : 'bg-gray-700'}`}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${value ? 'left-7' : 'left-1'}`} />
      </div>
    </div>
  );
}
