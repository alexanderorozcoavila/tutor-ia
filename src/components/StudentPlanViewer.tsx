"use client";

import { useOptimistic, useState, useEffect, useCallback, startTransition } from "react";
import { planService, PlanSemanal, TareaPlanificada } from "@/lib/planService";
import { rewardService, RecompensaDiaria, Recompensa } from "@/lib/rewardService";
import { supabase } from "@/lib/supabase";
import { taskService, Task } from "@/lib/taskService";
import { useAuth } from "@/lib/AuthContext";
import { useAlert } from "@/lib/AlertContext";
import { CheckCircle2, Star, Gift, Loader2, Sparkles, Clock, Trophy, Medal, ClipboardSignature, Zap, Lock } from "lucide-react";
import parse from "html-react-parser";
import { useStudentPlan } from "@/hooks/useStudentPlan";

interface Props {
  plan: PlanSemanal;
  onRefreshFallback: () => void;
  onStartModule: (task: Task) => void;
}

// ─── Etiqueta de nivel ────────────────────────────────────────────────────────
const NIVEL_CONFIG = [
  { nivel: 1, label: "80%",  emoji: "🥈", color: "from-slate-300 to-slate-400",   border: "border-slate-300",   text: "text-slate-600",  bg: "bg-slate-50",  unlockBg: "bg-slate-100" },
  { nivel: 2, label: "90%",  emoji: "🥇", color: "from-amber-400 to-yellow-400",  border: "border-amber-300",   text: "text-amber-700",  bg: "bg-amber-50",  unlockBg: "bg-amber-100" },
  { nivel: 3, label: "100%", emoji: "🏆", color: "from-emerald-400 to-teal-500",  border: "border-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50", unlockBg: "bg-emerald-100" },
];

// ─── Componente tarjeta de recompensa ─────────────────────────────────────────
interface RewardCardProps {
  rd: RecompensaDiaria & { recompensa?: Recompensa };
  // currentLevel removed; unlocking now driven by jornadas (mañana/tarde/noche)
  isUnlocked?: boolean;
  isActivated: boolean;
  isActivating: boolean;
  onActivar: (rd: RecompensaDiaria & { recompensa?: Recompensa }) => void;
  newlyUnlocked: boolean;
}

function RewardCard({ rd, isUnlocked, isActivated, isActivating, onActivar, newlyUnlocked }: RewardCardProps & { isUnlocked: boolean }) {
  const rInfo = (rd as any).recompensa as Recompensa | undefined;
  const cfg = NIVEL_CONFIG.find(n => n.nivel === rd.nivel_requerido) || NIVEL_CONFIG[0];

  return (
    <div
      className={`relative rounded-[1.75rem] border-2 overflow-hidden transition-all duration-700 ease-out
        ${isUnlocked
          ? `${cfg.border} shadow-lg ${newlyUnlocked ? "animate-in zoom-in-95 scale-[1.02] shadow-amber-200" : ""}`
          : "border-gray-200 shadow-sm opacity-75"
        }
      `}
    >
      {/* Barra de color superior */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.color}`} />

      <div className={`p-4 flex items-center gap-4 transition-all duration-700 ${isUnlocked ? cfg.bg : "bg-gray-50"}`}>
        {/* Imagen / emoji / lock */}
        <div className="relative flex-shrink-0">
          {rInfo?.imagen_url ? (
            <img
              src={rInfo.imagen_url}
              alt={rInfo.nombre}
              className={`w-16 h-16 rounded-2xl object-cover shadow-md transition-all duration-700 ${!isUnlocked ? "grayscale blur-[2px] brightness-50" : ""}`}
              onError={e => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-inner transition-all duration-700
              ${isUnlocked ? `${cfg.unlockBg}` : "bg-gray-200 grayscale"}`}
            >
              {isUnlocked ? (rInfo?.icono_emoji || "🎁") : "🎁"}
            </div>
          )}

          {/* Candado superpuesto cuando bloqueado */}
          {!isUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[1px]">
              <Lock size={24} className="text-white drop-shadow" />
            </div>
          )}

          {/* Badge de nivel */}
          <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center text-sm shadow-md`}>
            {cfg.emoji}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
            {isUnlocked ? (
            <>
              <p className={`font-black text-base leading-tight ${cfg.text}`}>{rInfo?.nombre || "Recompensa"}</p>
              <p className="text-xs font-bold text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock size={10} /> {rd.minutos_disponibles} min
              </p>
            </>
          ) : (
            <>
              <p className="font-black text-base text-gray-300">Bloqueada</p>
              <p className="text-xs font-bold text-gray-300 mt-0.5">Completa la jornada para desbloquear</p>
            </>
          )}

          {/* Indicador de nivel requerido */}
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider
            ${isUnlocked ? `${cfg.unlockBg} ${cfg.text}` : "bg-gray-100 text-gray-400"}`}
          >
            {isUnlocked ? "✓" : "🔒"} {cfg.label} del día
          </div>
        </div>

        {/* Botón o estado */}
            {isUnlocked && (
          isActivated ? (
            <div className="flex-shrink-0 flex flex-col items-center gap-1 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Usada hoy</p>
            </div>
                  ) : (
            <button
              onClick={() => onActivar(rd)}
              disabled={isActivating}
              className={`flex-shrink-0 flex flex-col items-center gap-1 w-14 h-14 rounded-full text-white font-black shadow-lg transition-all active:scale-90 disabled:opacity-50
                bg-gradient-to-br ${cfg.color} hover:shadow-amber-300 hover:scale-105
                ${newlyUnlocked ? "animate-bounce" : ""}`}
            >
              {isActivating ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
              <span className="text-[8px] leading-none">{isActivating ? "..." : "¡Usar!"}</span>
            </button>
          )
        )}
      </div>

      {/* Brillo de desbloqueo */}
      {newlyUnlocked && isUnlocked && (
        <div className="absolute inset-0 pointer-events-none rounded-[1.75rem] ring-4 ring-amber-400/60 animate-ping" />
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function StudentPlanViewer({ plan, onRefreshFallback, onStartModule }: Props) {
  const {
    tareasCompletas,
    tareasEnRevision,
    tareasPendientes,
    evaluacionesSemanales,
    dbTasksCache,
    jornadasMedals,
    activeJornada,
    isSyncingGamification,
    recompensasDelDia,
    activatingRecompensaId,
    activatedRecompensas,
    newlyUnlockedNivel,
    optimisticPoints,
    progressPercent,
    hasRecompensasHoy,
    handleActivarRecompensa,
    handleCardClick,
  } = useStudentPlan(plan, onStartModule);

  // Compat: mapear nivel_requerido a jornada (1=mañana,2=tarde,3=noche)
  const nivelToJornada = (n: number) => (n === 1 ? 'manana' : n === 2 ? 'tarde' : 'noche');
  const unlockedCount = recompensasDelDia.filter((rd: any) => rd.recompensa_id && (jornadasMedals as any)[nivelToJornada(rd.nivel_requerido)]).length;

  const [onlyPending, setOnlyPending] = useState(false);



  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

      {/* ── HEADER: Progreso + Medallas ──────────────────────────────────────── */}
      <div className="theme-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex justify-between items-start relative z-10 flex-col md:flex-row gap-6">
          <div>
            <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest mb-4 inline-block">
              Plan de la Semana
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">¡Cumple tu Meta!</h1>
            <p className="text-gray-500 font-bold text-lg flex items-center gap-2">
              <Gift size={20} className="text-amber-500" />
              <span className="text-amber-600 font-extrabold">{plan.recompensa_nombre}</span>
            </p>
          </div>

          <div className="bg-emerald-50 p-6 rounded-[2rem] border-2 border-emerald-100 text-center min-w-[200px] relative">
            {isSyncingGamification && (
              <div className="absolute -top-3 -left-3 bg-white rounded-full p-2 shadow-sm animate-spin">
                <Loader2 size={16} className="text-emerald-500" />
              </div>
            )}
            <div className="text-4xl font-black text-emerald-600 mb-1">
              {optimisticPoints} <span className="text-lg text-emerald-400">/ {plan.meta_puntos_total}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3">Puntos Aprobados</p>

            <div className="flex justify-center gap-4 border-t border-emerald-200/50 pt-3 relative">
              <div className="flex flex-col items-center gap-1">
                <Medal size={28} className={`transition-all duration-500 ${jornadasMedals.manana ? "text-amber-500 drop-shadow-md scale-110" : "text-emerald-200 opacity-20"}`} />
                <span className="text-[8px] font-black uppercase text-emerald-600">Mañana</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Medal size={28} className={`transition-all duration-500 ${jornadasMedals.tarde ? "text-amber-500 drop-shadow-md scale-110" : "text-emerald-200 opacity-20"}`} />
                <span className="text-[8px] font-black uppercase text-emerald-600">Tarde</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Trophy size={28} className={`transition-all duration-500 ${jornadasMedals.noche ? "text-amber-600 drop-shadow-md scale-110" : "text-emerald-200 opacity-20"}`} />
                <span className="text-[8px] font-black uppercase text-emerald-600">Noche</span>
              </div>

              <div className="absolute -top-2 right-0 bg-white shadow-sm border border-emerald-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Clock size={10} className="text-emerald-500" />
                <span className="text-[8px] font-black uppercase text-emerald-600">{activeJornada}</span>
              </div>
            </div>
            
            {(jornadasMedals.manana || jornadasMedals.tarde || jornadasMedals.noche) && (
              <p className="text-[10px] font-black text-emerald-600 mt-2 animate-pulse uppercase tracking-wider">
                ¡Medalla lograda! 🎖️
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 relative z-10">
          <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-2"
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent > 20 && <span className="text-[10px] font-black text-white mix-blend-overlay">{progressPercent}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── RECOMPENSAS DEL DÍA (siempre visibles si hay) ─────────────────────── */}
      {hasRecompensasHoy && (
        <div className="space-y-4">
          {/* Título con indicador de estado */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-2"
              style={{ color: unlockedCount > 0 ? "#d97706" : "#9ca3af" }}>
              <Gift size={20} />
              Recompensas de Hoy
            </h3>
            {unlockedCount === 0 && (
              <span className="text-xs font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full flex items-center gap-1">
                <Lock size={10} /> Completa tareas para desbloquear
              </span>
            )}
            {unlockedCount > 0 && (
              <span className="text-xs font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full animate-pulse">
                ¡{unlockedCount} desbloqueadas!
              </span>
            )}
          </div>

          {/* Tarjetas de recompensa por nivel */}
          <div className="grid grid-cols-1 gap-4">
            {recompensasDelDia
              .filter((rd: any) => rd.recompensa_id) // solo las asignadas
              .sort((a: any, b: any) => a.nivel_requerido - b.nivel_requerido)
              .map((rd: any) => {
                const jornadaKey = nivelToJornada(rd.nivel_requerido);
                const isUnlocked = (jornadasMedals as any)[jornadaKey];
                const newly = !!(newlyUnlockedNivel && newlyUnlockedNivel.id === jornadaKey && !activatedRecompensas.has(rd.id));
                return (
                  <RewardCard
                    key={rd.id}
                    rd={rd}
                    isUnlocked={isUnlocked}
                    isActivated={activatedRecompensas.has(rd.id)}
                    isActivating={activatingRecompensaId === rd.id}
                    onActivar={handleActivarRecompensa}
                    newlyUnlocked={newly}
                  />
                );
              })}
          </div>

          {/* Barra de progreso hacia siguiente recompensa */}
          {dailyLevel < 3 && (() => {
            const nextReward = recompensasDelDia
              .filter((rd: any) => rd.recompensa_id && rd.nivel_requerido > dailyLevel)
              .sort((a: any, b: any) => a.nivel_requerido - b.nivel_requerido)[0];
            if (!nextReward) return null;
            const cfg = NIVEL_CONFIG.find(n => n.nivel === nextReward.nivel_requerido);
            const target = nextReward.nivel_requerido === 1 ? 0.8 : nextReward.nivel_requerido === 2 ? 0.9 : 1.0;
            const currentPct = progressPercent / 100;
            const progress = Math.min(100, Math.round((currentPct / target) * 100));
            return (
              <div className="bg-white rounded-[1.5rem] border-2 border-gray-100 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-gray-500">Progreso hacia siguiente recompensa ({cfg?.label})</span>
                  <span className={`text-xs font-black ${cfg?.text}`}>{progress}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${cfg?.color} rounded-full transition-all duration-700`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── EVALUACIONES SEMANALES ───────────────────────────────────────────── */}
      {evaluacionesSemanales.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xl font-black text-purple-400 uppercase tracking-widest">Retos de la Semana</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluacionesSemanales
              .filter((evalu: any) => !onlyPending || evalu.estado !== "completada")
              .map((evalu: any) => {
                const isCompletada = evalu.estado === "completada";
                return (
                  <div
                    key={evalu.id}
                    onClick={() => !isCompletada && handleCardClick(evalu)}
                    className={`group p-6 theme-card transition-all flex items-center justify-between ${
                      isCompletada ? "opacity-70 grayscale" : "cursor-pointer active:scale-[0.98]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isCompletada ? "bg-purple-200 text-white" : "bg-purple-50 text-purple-500"}`}>
                        <ClipboardSignature size={28} />
                      </div>
                      <div>
                        <h4 className={`text-xl font-extrabold ${isCompletada ? "text-purple-900 line-through" : "text-gray-800"}`}>
                          {isCompletada ? "Evaluación Realizada" : "Evaluación Semanal"}
                        </h4>
                        <p className="text-purple-500 font-bold text-xs uppercase">+{evalu.puntos_valor} puntos</p>
                      </div>
                    </div>
                    {isCompletada && <CheckCircle2 className="text-purple-500" size={24} />}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── TAREAS DEL DÍA ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">Aventuras de Hoy</h3>
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${onlyPending ? 'bg-emerald-500' : 'bg-gray-300'}`}
              onClick={() => setOnlyPending(!onlyPending)}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${onlyPending ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-xs font-black text-gray-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
              Solo Pendientes
            </span>
          </label>
        </div>

        {tareasPendientes.length === 0 && tareasCompletas.length === 0 && tareasEnRevision.length === 0 ? (
          <div className="bg-gray-50/50 border-4 border-dashed border-gray-200 p-12 rounded-[3rem] text-center flex flex-col items-center gap-4">
            <Sparkles className="text-amber-400 mb-2" size={48} />
            <h3 className="text-2xl font-black text-gray-600">¡Día Libre!</h3>
            <p className="text-gray-400 font-bold max-w-sm">Tu tutor no te asignó tareas para hoy en el Plan Semanal. ¡Disfruta tu día!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tareasPendientes.map((tarea: any) => {
              const baseTask = dbTasksCache[tarea.modulo_id];
              return (
                <div
                  key={tarea.id}
                  onClick={() => handleCardClick(tarea)}
                  className="group cursor-pointer theme-card p-6 transition-all active:scale-[0.98] flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner group-hover:scale-110 transition-transform">
                      {tarea.tipo_modulo === "dictation" || tarea.tipo_modulo === "reading" ? <Loader2 size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <div>
                      <h4 className="text-2xl font-extrabold text-gray-800">{baseTask ? baseTask.title : "Rutina de Hoy"}</h4>
                      <p className="text-emerald-500 font-bold text-sm uppercase tracking-wider">+{tarea.puntos_valor} puntos</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gray-50 border-4 border-gray-100 rounded-full flex items-center justify-center group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors" />
                </div>
              );
            })}

            {tareasEnRevision
              .filter(() => !onlyPending)
              .map((tarea: any) => {
                const baseTask = dbTasksCache[tarea.modulo_id];
                const esReanudable = tarea.tipo_modulo === "dictation" || tarea.tipo_modulo === "reading";
                return (
                  <div
                    key={tarea.id}
                    onClick={() => esReanudable && handleCardClick(tarea)}
                    className={`bg-amber-50/50 p-6 rounded-[2rem] border-4 border-amber-100 flex items-center justify-between
                      ${esReanudable ? "cursor-pointer hover:bg-amber-100/60 active:scale-[0.98] transition-all" : "opacity-90"}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner animate-pulse">
                        <Clock size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-amber-900">{baseTask ? baseTask.title : "Actividad Enviada"}</h4>
                        <p className="text-amber-600 font-bold text-sm">
                          {esReanudable ? "Toca para retomar donde lo dejaste ▶" : "El tutor la está revisando ⏳"}
                        </p>
                      </div>
                    </div>
                    {esReanudable && (
                      <div className="w-14 h-14 bg-amber-400 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                        <span className="text-xl">▶</span>
                      </div>
                    )}
                  </div>
                );
              })}

            {tareasCompletas
              .filter(() => !onlyPending)
              .map((tarea: any) => {
                const baseTask = dbTasksCache[tarea.modulo_id];
                return (
                  <div
                    key={tarea.id}
                    className="bg-emerald-50/50 p-6 rounded-[2rem] border-4 border-emerald-100 opacity-70 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-emerald-400 rounded-2xl flex items-center justify-center text-white shadow-md">
                        <CheckCircle2 size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-emerald-900 line-through">{baseTask ? baseTask.title : "Rutina Terminada"}</h4>
                        <p className="text-emerald-500 font-bold text-sm">¡Completado!</p>
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-inner">
                      <CheckCircle2 size={24} />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
