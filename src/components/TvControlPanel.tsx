'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getTvConfigByStudent, upsertTvConfig } from '@/actions/tvConfigActions';
import type { TvConfig } from '@/lib/settingsService';
import { Tv, Power, Clock, Wifi, CheckCircle, AlertCircle, Loader2, Bell } from 'lucide-react';

interface TvControlPanelProps {
  studentId: string;
  studentName: string;
}

const DEFAULT_CONFIG: Omit<TvConfig, 'id' | 'updated_at' | 'updated_by'> = {
  student_id: '',
  device_ip: '192.168.1.100',
  force_power_off: false,
  restricted_start_time: null,
  restricted_end_time: null,
  is_active: true,
  warning_message: '¡Atención! La TV se apagará pronto por horario de estudio. 📚',
  warning_minutes_before: 5,
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function TvControlPanel({ studentId, studentName }: TvControlPanelProps) {
  const [config, setConfig] = useState<TvConfig>({ ...DEFAULT_CONFIG, student_id: studentId });
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar config del alumno al montar
  useEffect(() => {
    getTvConfigByStudent(studentId)
      .then((data) => {
        if (data) setConfig(data);
        else setConfig({ ...DEFAULT_CONFIG, student_id: studentId });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [studentId]);

  // Guardar con debounce de 800ms
  const persistConfig = useCallback((updated: TvConfig) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        await upsertTvConfig({ ...updated, student_id: studentId });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2500);
      } catch (err) {
        console.error(err);
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 3000);
      }
    }, 800);
  }, [studentId]);

  const handleChange = <K extends keyof TvConfig>(key: K, value: TvConfig[K]) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    persistConfig(updated);
  };

  // Detecta si la hora actual está dentro del rango de bloqueo (incluyendo cruce de medianoche)
  const isInBlockedRange = (): boolean => {
    if (!config.restricted_start_time || !config.restricted_end_time) return false;
    const now = new Date();
    const [sh, sm] = config.restricted_start_time.split(':').map(Number);
    const [eh, em] = config.restricted_end_time.split(':').map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    const nowM = now.getHours() * 60 + now.getMinutes();
    return startM < endM
      ? nowM >= startM && nowM <= endM
      : nowM >= startM || nowM <= endM;
  };

  const blocked = config.is_active && (config.force_power_off || isInBlockedRange());

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-6 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando configuración de TV...</span>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            <Tv size={18} />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">Control Smart TV</p>
            <p className="text-xs text-gray-400">{studentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Estado del guardado */}
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Guardando…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle size={12} /> Guardado
            </span>
          )}
          {saveState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle size={12} /> Error al guardar
            </span>
          )}

          {/* Badge de estado actual */}
          {blocked ? (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
              🔴 TV BLOQUEADA
            </span>
          ) : config.is_active ? (
            <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
              🟢 Activo
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
              ⚪ Inactivo
            </span>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Master Switch */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Sistema activo</p>
            <p className="text-xs text-gray-400 mt-0.5">Activa o desactiva el control parental</p>
          </div>
          <button
            id={`tv-master-switch-${studentId}`}
            onClick={() => handleChange('is_active', !config.is_active)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 ${
              config.is_active ? 'bg-indigo-500' : 'bg-gray-300'
            }`}
            aria-label={config.is_active ? 'Desactivar sistema' : 'Activar sistema'}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                config.is_active ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Apagado manual */}
        <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
          config.force_power_off
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex items-start gap-3">
            <Power size={16} className={`mt-0.5 flex-shrink-0 ${config.force_power_off ? 'text-red-500' : 'text-gray-400'}`} />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Apagar TV ahora</p>
              <p className="text-xs text-gray-400 mt-0.5">Máxima prioridad — anula el horario</p>
            </div>
          </div>
          <button
            id={`tv-force-off-${studentId}`}
            onClick={() => handleChange('force_power_off', !config.force_power_off)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 ${
              config.force_power_off ? 'bg-red-500' : 'bg-gray-300'
            }`}
            aria-label={config.force_power_off ? 'Desactivar apagado manual' : 'Activar apagado manual'}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                config.force_power_off ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Horario de bloqueo */}
        <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-gray-500" />
            <p className="font-semibold text-gray-800 text-sm">Horario de bloqueo</p>
            {config.restricted_start_time && config.restricted_end_time && (
              <span className="ml-auto text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                {config.restricted_start_time.slice(0, 5)} → {config.restricted_end_time.slice(0, 5)}
                {config.restricted_start_time > config.restricted_end_time && ' · cruza medianoche'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`tv-start-${studentId}`} className="block text-xs text-gray-500 mb-1 font-medium">
                Inicio del bloqueo
              </label>
              <input
                id={`tv-start-${studentId}`}
                type="time"
                value={config.restricted_start_time?.slice(0, 5) ?? ''}
                onChange={(e) =>
                  handleChange('restricted_start_time', e.target.value ? `${e.target.value}:00` : null)
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
            <div>
              <label htmlFor={`tv-end-${studentId}`} className="block text-xs text-gray-500 mb-1 font-medium">
                Fin del bloqueo
              </label>
              <input
                id={`tv-end-${studentId}`}
                type="time"
                value={config.restricted_end_time?.slice(0, 5) ?? ''}
                onChange={(e) =>
                  handleChange('restricted_end_time', e.target.value ? `${e.target.value}:00` : null)
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Si la hora de inicio es mayor que la hora de fin, el bloqueo cruza la medianoche (ej. 22:00 → 08:00).
          </p>
        </div>
        {/* Alerta previa al apagado */}
        <div className="md:col-span-2 p-4 bg-amber-50 rounded-xl border border-amber-100">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={15} className="text-amber-500" />
            <p className="font-semibold text-gray-800 text-sm">Alerta previa al apagado</p>
            {config.warning_minutes_before > 0 ? (
              <span className="ml-auto text-xs text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded-full">
                {config.warning_minutes_before} min antes
              </span>
            ) : (
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Desactivada
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor={`tv-warn-min-${studentId}`} className="block text-xs text-gray-500 mb-1 font-medium">
                Minutos de anticipación <span className="text-gray-400">(0 = sin alerta)</span>
              </label>
              <input
                id={`tv-warn-min-${studentId}`}
                type="number"
                min={0}
                max={30}
                value={config.warning_minutes_before}
                onChange={(e) => handleChange('warning_minutes_before', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>
            <div>
              <label htmlFor={`tv-warn-msg-${studentId}`} className="block text-xs text-gray-500 mb-1 font-medium">
                Mensaje que aparece en la TV
              </label>
              <input
                id={`tv-warn-msg-${studentId}`}
                type="text"
                value={config.warning_message}
                onChange={(e) => handleChange('warning_message', e.target.value)}
                maxLength={120}
                placeholder="¡Atención! La TV se apagará pronto..."
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">
                Aparece como Toast en la Samsung TV {config.warning_minutes_before > 0 ? `${config.warning_minutes_before} minuto(s) antes del corte` : '(desactivado)'}.
              </p>
            </div>
          </div>
        </div>

        {/* IP del dispositivo */}
        <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={15} className="text-gray-500" />
            <p className="font-semibold text-gray-800 text-sm">Dirección IP del televisor</p>
          </div>
          <input
            id={`tv-ip-${studentId}`}
            type="text"
            value={config.device_ip}
            onChange={(e) => handleChange('device_ip', e.target.value)}
            placeholder="192.168.1.100"
            pattern="\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-mono"
          />
          <p className="text-xs text-gray-400 mt-2">
            IP local del Samsung TV en la red doméstica. El script Python envía el comando por WebSocket al puerto 8002.
          </p>
        </div>

      </div>
    </div>
  );
}
