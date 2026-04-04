"use client";

import React from "react";
import { PlanSemanal } from "@/lib/planService";
import { Task } from "@/lib/taskService";
import { useStudentPlan } from "@/hooks/useStudentPlan";
import { useAuth } from "@/lib/AuthContext";
import { 
  Gift, ClipboardSignature, Clock, CheckCircle2, 
  MessageSquare, Phone, Medal, Trophy, LogOut, User, Home, Sword, Sparkles,
  AlertTriangle, Loader2 as Spinner
} from "lucide-react";
import { systemMenuService, MenuAccion } from "@/lib/systemMenuService";
import { useAlert } from "@/lib/AlertContext";
import styles from "./MinecraftStudentViewer.module.css";

interface Props {
  plan: PlanSemanal;
  onRefreshFallback: () => void;
  onStartModule: (task: Task) => void;
}

export function MinecraftStudentViewer({ plan, onRefreshFallback, onStartModule }: Props) {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const {
    tareasCompletas,
    tareasEnRevision,
    tareasPendientes,
    evaluacionesSemanales,
    dbTasksCache,
    jornadasMedals,
    isSyncingGamification,
    recompensasDelDia,
    activatingRecompensaId,
    activatedRecompensas,
    optimisticPoints,
    progressPercent,
    hasRecompensasHoy,
    handleActivarRecompensa,
    handleCardClick,
  } = useStudentPlan(plan, onStartModule);

  // Derivar dailyLevel a partir del conteo de medallas de jornada (0 a 3)
  const dailyLevel = (jornadasMedals.manana ? 1 : 0) + (jornadasMedals.tarde ? 1 : 0) + (jornadasMedals.noche ? 1 : 0);

  const [menuItems, setMenuItems] = React.useState<MenuAccion[]>([]);
  const [executingId, setExecutingId] = React.useState<string | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [onlyPending, setOnlyPending] = React.useState(false);

  React.useEffect(() => {
    if (user?.role) {
      systemMenuService.getMenuItems(user.role).then(setMenuItems).catch(console.error);
    }
  }, [user?.role]);

  const handleSystemAction = async (item: MenuAccion) => {
    const isCritical = item.nombre.toLowerCase().includes("apagar") || 
                       item.nombre.toLowerCase().includes("reiniciar");
    
    if (isCritical && confirmingId !== item.id) {
      setConfirmingId(item.id);
      return;
    }

    setConfirmingId(null);
    setExecutingId(item.id);
    try {
      const res = await systemMenuService.ejecutarAccion(item.id);
      if (res.ok) {
        showAlert(`✅ ${item.nombre} ejecutado`, { type: "success" });
      } else {
        showAlert(res.error || "Error al ejecutar", { type: "error" });
      }
    } catch (err) {
      showAlert("El agente de sistema no responde.", { type: "error" });
    } finally {
      setExecutingId(null);
    }
  };

  // Ocultar SystemMenu global mediante CSS inyectado
  React.useEffect(() => {
    const styleId = "hide-global-menu";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = ".md\\:block.fixed.bottom-6.right-6.z-40 { display: none !important; }";
      document.head.appendChild(style);
    }
    return () => {
      const s = document.getElementById(styleId);
      if (s) s.remove();
    };
  }, []);

  return (
    <div className={styles.mcPageWrapper}>
      {/* ── HEADER ────────────────────────────────────────── */}
      <header className={styles.mcHeader}>
        <div className={styles.headerLogoArea}>
          <div className={styles.mcLogo}>
            {[...Array(16)].map((_, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? "#ff4444" : "#ffffff", border: "1px solid rgba(0,0,0,0.1)" }}></div>
            ))}
          </div>
          <h1 className={styles.appTitle}>IA TUTOR</h1>
        </div>

        <nav className={styles.navLinks}>
          <button className={`${styles.navLink} ${styles.navLinkActive}`}><Home size={14} className="inline mr-2" /> DASHBOARD</button>
          <button className={styles.navLink}><Sword size={14} className="inline mr-2" /> MISIONES</button>
          <button className={styles.navLink}><Gift size={14} className="inline mr-2" /> RECOMPENSAS</button>
          <button className={styles.navLink}><User size={14} className="inline mr-2" /> PERFIL</button>
        </nav>

        <div className={styles.headerProfile}>
          <div style={{ textAlign: "right", marginRight: "1rem" }}>
            <p style={{ fontStyle: "italic", fontSize: "16px", marginBottom: "0" }}>Jugador</p>
            <p style={{ fontFamily: "var(--font-pixel)", fontSize: "10px", color: "var(--mc-yellow)", marginTop: "2px" }}>
              {user?.username || "Steve"}
            </p>
          </div>
          <button onClick={() => logout()} className={styles.navLink} style={{ padding: "0.5rem" }} title="Salir">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* ── MAIN GRID ───────────────────────────────────── */}
      <main className={styles.mainGrid}>
        
        {/* Columna Principal (Izquierda) */}
        <section className={styles.primaryColumn}>
          
          {/* Plan Card */}
          <div className={styles.planCard}>
            <div className={styles.skyTexture}></div>
            <div className={styles.goalInfo}>
              <span className={styles.goalLabel}>OBJETIVO SEMANAL</span>
              <h2 className={styles.rewardDisplay}>
                <Gift size={48} className="text-amber-400" />
                <span>{plan ? `Mision: ${plan.recompensa_nombre}` : "¡Día de Descanso!"}</span>
              </h2>
            </div>

            {plan ? (
              <div className={styles.xpSection}>
                <div className={styles.xpHeader}>
                  <span className={styles.xpPoints}>PUNTOS DE APRENDIZAJE (XP)</span>
                  <span className={styles.xpPoints} style={{ color: "white" }}>{optimisticPoints} / {plan.meta_puntos_total}</span>
                </div>
                <div className={styles.xpBarContainer}>
                  <div className={styles.xpBarFill} style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p style={{ marginTop: "0.75rem", opacity: 0.7, fontSize: "18px" }}>
                  ¡Sigue completando misiones para ganar el bloque de recompensa!
                </p>
              </div>
            ) : (
              <div className={styles.xpSection} style={{ textAlign: "center", padding: "1rem" }}>
                <Sparkles className="text-amber-400 mx-auto mb-4" size={48} />
                <p style={{ fontSize: "22px", fontFamily: "var(--font-pixel)", color: "var(--mc-yellow)" }}>¡BIENVENIDO AL MUNDO LIBRE!</p>
                <p style={{ marginTop: "0.5rem", opacity: 0.9 }}>
                  No tienes misiones asignadas para hoy. ¡Aprovecha para explorar y divertirte!
                </p>
              </div>
            )}
          </div>

          {/* Misiones de Hoy */}
          <div>
            <div className="flex items-center justify-between border-b-4 border-[var(--mc-brown-light)] mb-4 pb-2">
              <h3 className={styles.sectionTitle} style={{ borderBottom: "none", margin: 0, padding: 0 }}>Misiones del Día</h3>
              <label className={styles.mcCheckboxWrapper}>
                <input 
                  type="checkbox" 
                  checked={onlyPending} 
                  onChange={(e) => setOnlyPending(e.target.checked)} 
                  className={styles.mcCheckboxHidden}
                />
                <span className={`${styles.mcCheckboxCustom} ${onlyPending ? styles.mcCheckboxChecked : ""}`}></span>
                <span className={styles.mcCheckboxLabel}>SOLO PENDIENTES</span>
              </label>
            </div>
            <div className={styles.horizontalGrid}>
              
              {/* Pendientes */}
              {tareasPendientes.map((tarea: any) => (
                <div key={tarea.id} className={styles.taskCard} onClick={() => handleCardClick(tarea)}>
                  <div className={styles.cardIconBox}><Sword size={24} className="text-emerald-400" /></div>
                  <div className={styles.cardContent}>
                    <p className={styles.cardTitle}>{dbTasksCache[tarea.modulo_id]?.title || "Mision"}</p>
                    <p className={styles.cardMeta}>Por hacer · +{tarea.puntos_valor} XP</p>
                  </div>
                </div>
              ))}

              {/* En Revisión / Reanudables */}
              {!onlyPending && tareasEnRevision.map((tarea: any) => {
                const esReanudable = tarea.tipo_modulo === "dictation" || tarea.tipo_modulo === "reading";
                return (
                  <div key={tarea.id} className={`${styles.taskCard} ${styles.taskBlock_urgent}`} onClick={() => esReanudable && handleCardClick(tarea)}>
                    <div className={styles.cardIconBox}><Clock size={24} className="text-amber-400 animate-pulse" /></div>
                    <div className={styles.cardContent}>
                      <p className={styles.cardTitle}>{dbTasksCache[tarea.modulo_id]?.title || "Actividad"}</p>
                      <p className={styles.cardMeta} style={{ color: "#ffaaaa" }}>
                        {esReanudable ? "Retomar aventura ▶" : "Tutor revisando..."}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Completadas */}
              {!onlyPending && tareasCompletas.map((tarea: any) => (
                <div key={tarea.id} className={`${styles.taskCard} ${styles.taskBlock_completed}`}>
                  <div className={styles.cardIconBox} style={{ background: "#1a3a0d" }}><CheckCircle2 size={24} className="text-emerald-600" /></div>
                  <div className={styles.cardContent}>
                    <p className={styles.cardTitle} style={{ textDecoration: "line-through", opacity: 0.5 }}>{dbTasksCache[tarea.modulo_id]?.title || "Terminada"}</p>
                    <p className={styles.cardMeta}>¡Completada!</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retos Semanales */}
          {evaluacionesSemanales.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle}>Retos de la Semana</h3>
              <div className={styles.horizontalGrid}>
                {evaluacionesSemanales
                  .filter((evalu: any) => !onlyPending || evalu.estado !== "completada")
                  .map((evalu: any) => {
                    const done = evalu.estado === "completada";
                    return (
                      <div key={evalu.id} className={styles.taskCard} style={{ background: "var(--mc-purple)", borderColor: "var(--mc-purple-light)" }} onClick={() => !done && handleCardClick(evalu)}>
                        <div className={styles.cardIconBox} style={{ background: "#2a0d3a" }}><ClipboardSignature size={24} className="text-purple-300" /></div>
                        <div className={styles.cardContent}>
                          <p className={styles.cardTitle} style={{ color: "#d2b8e3" }}>{done ? "Reto Superado" : "Evaluación"}</p>
                          <p className={styles.cardMeta}>{done ? "¡Excelente trabajo!" : `Gana +${evalu.puntos_valor} XP extras`}</p>
                        </div>
                        {done && <CheckCircle2 size={24} className="text-purple-400" />}
                      </div>
                    );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Columna Lateral (Derecha) */}
        <aside className={styles.sidebarPanel}>
          
          <div className={styles.sidebarBox}>
            {isSyncingGamification && (
              <div style={{ textAlign: "center", marginBottom: "0.5rem" }}><Sparkles size={16} className="animate-spin text-amber-500 inline mr-2" /> Syncing...</div>
            )}
            <span className={styles.sidebarTitle}>ESTADO DEL DÍA</span>
            <div className={styles.trophyRack}>
              <Medal className={`${styles.trophyItem} ${dailyLevel >= 1 ? styles.trophyActive : ""} text-slate-300`} size={40} />
              <Medal className={`${styles.trophyItem} ${dailyLevel >= 2 ? styles.trophyActive : ""} text-amber-500`} size={40} />
              <Trophy className={`${styles.trophyItem} ${dailyLevel >= 3 ? styles.trophyActive : ""} text-amber-600`} size={48} />
            </div>
            <p style={{ textAlign: "center", fontStyle: "italic", marginTop: "1rem", color: "#8888cc" }}>
              {dailyLevel === 3 ? "¡Nivel Máximo Alcaizado!" : dailyLevel === 2 ? "¡Oro desbloqueado!" : dailyLevel === 1 ? "¡Ya tienes la Plata!" : "Sigue esforzándote..."}
            </p>
          </div>

          {/* Seccion de Recompensas de Hoy */}
          {hasRecompensasHoy && (
            <div className={styles.sidebarBox} style={{ background: "#2c3e50" }}>
              <span className={styles.sidebarTitle}>MIS PREMIOS</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {recompensasDelDia
                  .filter(rd => rd.recompensa_id)
                  .map(rd => {
                    const ok = dailyLevel >= rd.nivel_requerido;
                    const used = activatedRecompensas.has(rd.id);
                    return (
                      <button 
                        key={rd.id}
                        onClick={() => ok && !used && handleActivarRecompensa(rd)}
                        disabled={!ok || used || activatingRecompensaId === rd.id}
                        className={styles.sidebarBtn}
                        style={{ 
                          background: used ? "#2d3436" : ok ? "#27ae60" : "#34495e",
                          borderColor: used ? "#636e72" : ok ? "#2ecc71" : "#2c3e50",
                          color: ok ? "white" : "#95a5a6",
                          opacity: (activatingRecompensaId === rd.id) ? 0.7 : 1
                        }}
                      >
                        {used ? "RECUPERADO ✓" : ok ? "¡CANJEAR AHORA!" : `Bloqueado (Nivel ${rd.nivel_requerido})`}
                      </button>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* Ayuda del Tutor */}
          <div className={styles.sidebarBox} style={{ borderStyle: "dashed", borderColor: "#555" }}>
            <span className={styles.sidebarTitle}>¿NECESITAS AYUDA?</span>
            <button className={`${styles.sidebarBtn} ${styles.btnCall}`} onClick={() => window.open(`tel:${user?.created_by}`)}>
              <Phone size={14} className="inline mr-2" /> LLAMAR AL PROFESOR
            </button>
            <button className={`${styles.sidebarBtn} ${styles.btnWhatsapp}`} onClick={() => window.open(`https://wa.me/${user?.created_by}`)}>
              <MessageSquare size={14} className="inline mr-2" /> WHATSAPP
            </button>
          </div>

          {/* Acciones de Sistema */}
          {menuItems.length > 0 && (
            <div className={styles.sidebarBox} style={{ borderColor: "#444" }}>
              <span className={styles.sidebarTitle}>SISTEMA</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {menuItems.map((item) => {
                  const isConfirm = confirmingId === item.id;
                  const isExec = executingId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSystemAction(item)}
                      disabled={!!executingId}
                      className={styles.sidebarBtn}
                      style={{ 
                        background: isConfirm ? "#c0392b" : "#2c3e50",
                        borderColor: isConfirm ? "#e74c3c" : "#34495e",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        justifyContent: "center",
                        fontSize: isConfirm ? "7px" : "8px"
                      }}
                    >
                      {isExec ? (
                        <Spinner size={14} className="animate-spin" />
                      ) : (
                        <span>{item.icono_emoji}</span>
                      )}
                      <span>{isConfirm ? `¿CONFIRMAR ${item.nombre.toUpperCase()}?` : item.nombre.toUpperCase()}</span>
                      {isConfirm && <AlertTriangle size={12} className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

      </main>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className={styles.mcFooter}>
        <div className={styles.footerContent}>
          <p className={styles.footerLogo}>EDU CRAFT - IA TUTOR PLATFORM</p>
          <p style={{ fontStyle: "italic", fontSize: "16px" }}>Mecánica Educativa Gamificada diseñada para el crecimiento personal.</p>
          <p style={{ marginTop: "1rem" }}>© 2026 Inteligencia Artificial Tutorial</p>
        </div>
      </footer>
    </div>
  );
}
