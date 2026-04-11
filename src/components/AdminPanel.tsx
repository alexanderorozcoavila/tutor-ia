"use client";

import { useState, useEffect, useRef } from "react";
import { User, userService } from "@/lib/userService";
import { settingsService } from "@/lib/settingsService";
import { lmsService, Subject } from "@/lib/lmsService";
import { rewardService, Recompensa } from "@/lib/rewardService";

import { UserPlus, Settings, Database, Key, ShieldCheck, Loader2, Trash2, AlertTriangle, MessageSquare, Save, BookA, CheckSquare, X, Star, Plus, Pencil, Gift, Link, Terminal, Image as ImageIcon, Monitor, UserCheck, Clock, Info, Tv } from "lucide-react";
import { systemMenuService, MenuAccionCompleta } from "@/lib/systemMenuService";
import { Modal } from "./Modal";
import { AudioDiagnosticsPanel } from "./AudioDiagnosticsPanel";
import { useAlert } from "@/lib/AlertContext";
import TvControlPanel from "./TvControlPanel";

export function AdminPanel() {
  const { showAlert } = useAlert();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"tutor" | "admin">("tutor");
  const [isCreating, setIsCreating] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<"users" | "themes" | "rewards" | "menu" | "audio" | "jornadas" | "settings" | "smarttv">("users");
  const [expandedTvStudentId, setExpandedTvStudentId] = useState<string | null>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const [isThemesLoading, setIsThemesLoading] = useState(false);

  // Estados para modales
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState("");
  const [notificationSound, setNotificationSound] = useState<string>('/notification.mp3');
  const [attentionMaxMinutes, setAttentionMaxMinutes] = useState<number>(0);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeSlug, setNewThemeSlug] = useState("");
  const [newThemeConfig, setNewThemeConfig] = useState('{\n  "primary": "#6366f1",\n  "secondary": "#818cf8",\n  "background": "#ffffff",\n  "surface": "#ffffff",\n  "border": "2px",\n  "radius": "1rem",\n  "font": "var(--font-comic-neue)"\n}');
  const [isThemeCreating, setIsThemeCreating] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);

  // Estados LMS (Materias)
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [isSubjectActionLoading, setIsSubjectActionLoading] = useState(false);
  
  // Estados Recompensas
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [isRecompensasLoading, setIsRecompensasLoading] = useState(false);
  const [editingRecompensa, setEditingRecompensa] = useState<Recompensa | null>(null);
  const [isRecompensaCreating, setIsRecompensaCreating] = useState(false);
  const [rwNombre, setRwNombre] = useState("");
  const [rwDescripcion, setRwDescripcion] = useState("");
  const [rwEmoji, setRwEmoji] = useState("🎁");
  const [rwTipo, setRwTipo] = useState<"url" | "comando">("url");
  const [rwUrl, setRwUrl] = useState("");
  const [rwComando, setRwComando] = useState("");
  const [rwImagenUrl, setRwImagenUrl] = useState("");
  const rwImagenRef = useRef<HTMLInputElement>(null);

  // Configurar Dispositivo (Kiosco)
  const [deviceAlumnoId, setDeviceAlumnoId] = useState<string>("");
  const [currentDeviceAlumnoId, setCurrentDeviceAlumnoId] = useState<string | null>(null);
  const [isSavingDevice, setIsSavingDevice] = useState(false);
  const [isDeviceLoading, setIsDeviceLoading] = useState(false);

  // Menú del Sistema
  const [menuAcciones, setMenuAcciones] = useState<MenuAccionCompleta[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [editingAccion, setEditingAccion] = useState<MenuAccionCompleta | null>(null);
  const [menuForm, setMenuForm] = useState({
    nombre: "", descripcion: "", icono_emoji: "⚙️",
    comando: "", requiere_sudo: false, orden: 0, activo: true,
    roles: [] as string[]
  });
  const [isSavingAccion, setIsSavingAccion] = useState(false);

  // Modal de Asignación a Tutor
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTutorSubjects, setSelectedTutorSubjects] = useState<string[]>([]);

  // Configuración de Jornadas
  const [jornadaConfig, setJornadaConfig] = useState({
    rango_manana: "00:00-11:59",
    rango_tarde: "12:00-17:59",
    rango_noche: "18:00-23:59"
  });
  const [isJornadaSaving, setIsJornadaSaving] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const all = await userService.getAllUsers();
      setUsers(all);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await settingsService.getSettings();
      setAttentionMessage(settings.attention_message);
      setNotificationSound((settings as any).notification_sound || '/notification.mp3');
      setAttentionMaxMinutes(Number((settings as any).attention_max_minutes) || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubjects = async () => {
    try {
      const allSubjects = await lmsService.getAllSubjects();
      setSubjects(allSubjects);
    } catch (err) {
      console.error(err);
    }
  };

  const loadThemes = async () => {
    setIsThemesLoading(true);
    try {
      const all = await userService.getAvailableThemes();
      setThemes(all);
    } catch (err) {
      console.error(err);
    } finally {
      setIsThemesLoading(false);
    }
  };

  const loadRecompensas = async () => {
    setIsRecompensasLoading(true);
    try {
      const all = await rewardService.getAllRecompensas();
      setRecompensas(all);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecompensasLoading(false);
    }
  };

  const resetRecompensaForm = () => {
    setEditingRecompensa(null);
    setRwNombre("");
    setRwDescripcion("");
    setRwEmoji("🎁");
    setRwTipo("url");
    setRwUrl("");
    setRwComando("");
    setRwImagenUrl("");
  };

  const handleRecompensaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rwNombre.trim()) return showAlert("El nombre de la recompensa es obligatorio.", { type: "info" });
    if (rwTipo === 'url' && !rwUrl.trim()) return showAlert("Debes ingresar una URL para este tipo de recompensa.", { type: "info" });
    if (rwTipo === 'comando' && !rwComando.trim()) return showAlert("Debes ingresar un comando.", { type: "info" });

    setIsRecompensaCreating(true);
    try {
      const payload = {
        nombre: rwNombre.trim(),
        descripcion: rwDescripcion.trim(),
        icono_emoji: rwEmoji || "🎁",
        tipo: rwTipo,
        url: rwTipo === 'url' ? rwUrl.trim() : undefined,
        comando: rwTipo === 'comando' ? rwComando.trim() : undefined,
        imagen_url: rwImagenUrl.trim() || undefined,
      };
      if (editingRecompensa) {
        await rewardService.updateRecompensa(editingRecompensa.id, payload);
        showAlert("Recompensa actualizada", { type: "success" });
      } else {
        await rewardService.createRecompensa(payload as any);
        showAlert("Recompensa creada con éxito", { type: "success" });
      }
      resetRecompensaForm();
      loadRecompensas();
    } catch (err: any) {
      showAlert(err.message || "Error al guardar la recompensa", { type: "error" });
    } finally {
      setIsRecompensaCreating(false);
    }
  };

  const handleDeleteRecompensa = async (id: string) => {
    if (!confirm("¿Eliminar esta recompensa? Los planes que la tengan asignada perderán la referencia.")) return;
    try {
      await rewardService.deleteRecompensa(id);
      showAlert("Recompensa eliminada", { type: "info" });
      loadRecompensas();
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    }
  };

  const loadDeviceConfig = async () => {
    setIsDeviceLoading(true);
    try {
      const res = await fetch('/api/configure-device');
      const data = await res.json();
      setCurrentDeviceAlumnoId(data.alumnoId || null);
      setDeviceAlumnoId(data.alumnoId || "");
    } catch (e) {
      console.error('Error cargando config dispositivo:', e);
    } finally {
      setIsDeviceLoading(false);
    }
  };

  const loadJornadaConfig = async () => {
    try {
      const res = await fetch('/api/jornadas');
      if (!res.ok) throw new Error('Error al cargar jornadas');
      const data = await res.json();
      if (data) {
        setJornadaConfig({
          rango_manana: data.rango_manana,
          rango_tarde: data.rango_tarde,
          rango_noche: data.rango_noche
        });
      }
    } catch (e) {
      console.error("Error cargando jornadas:", e);
    }
  };

  const handleSaveJornadaConfig = async () => {
    setIsJornadaSaving(true);
    try {
      const res = await fetch('/api/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jornadaConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      showAlert("Configuración de jornadas actualizada", { type: "success" });
    } catch (err: any) {
      showAlert(err.message || "Error al guardar jornadas", { type: "error" });
    } finally {
      setIsJornadaSaving(false);
    }
  };

  const handleSaveDevice = async () => {
    if (!deviceAlumnoId) return showAlert("Selecciona un alumno.", { type: "info" });
    setIsSavingDevice(true);
    try {
      const res = await fetch('/api/configure-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId: deviceAlumnoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentDeviceAlumnoId(deviceAlumnoId);
      showAlert("✅ Equipo configurado. Reinicia el agente para aplicar.", { type: "success" });
    } catch (err: any) {
      showAlert(err.message || "Error al guardar la configuración", { type: "error" });
    } finally {
      setIsSavingDevice(false);
    }
  };

  // ── Menú del Sistema: funciones ─────────────────────────────────────────────
  const loadMenuAcciones = async () => {
    setIsMenuLoading(true);
    try {
      const data = await systemMenuService.getAllAcciones();
      setMenuAcciones(data);
    } catch (e) {
      console.error("Error cargando menu_acciones:", e);
    } finally {
      setIsMenuLoading(false);
    }
  };

  const handleSaveAccion = async () => {
    setIsSavingAccion(true);
    try {
      if (editingAccion) {
        await systemMenuService.updateAccion(editingAccion.id, menuForm);
        showAlert("Acción actualizada", { type: "success" });
      } else {
        await systemMenuService.createAccion(menuForm);
        showAlert("Acción creada", { type: "success" });
      }
      setEditingAccion(null);
      setMenuForm({ nombre: "", descripcion: "", icono_emoji: "⚙️", comando: "", requiere_sudo: false, orden: 0, activo: true, roles: [] });
      loadMenuAcciones();
    } catch (err: any) {
      showAlert(err.message || "Error guardando acción", { type: "error" });
    } finally {
      setIsSavingAccion(false);
    }
  };

  const handleEditAccion = (a: MenuAccionCompleta) => {
    setEditingAccion(a);
    setMenuForm({ nombre: a.nombre, descripcion: a.descripcion || "", icono_emoji: a.icono_emoji, comando: a.comando, requiere_sudo: a.requiere_sudo, orden: a.orden, activo: a.activo, roles: a.roles });
    setActiveMainTab("menu");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteAccion = async (id: string) => {
    if (!confirm("¿Eliminar esta acción del menú?")) return;
    try {
      await systemMenuService.deleteAccion(id);
      showAlert("Acción eliminada", { type: "success" });
      loadMenuAcciones();
    } catch (err: any) {
      showAlert(err.message || "Error eliminando acción", { type: "error" });
    }
  };

  useEffect(() => {
    loadUsers();
    loadSettings();
    loadSubjects();
    loadThemes();
    loadRecompensas();
    loadDeviceConfig();
    loadMenuAcciones();
    loadJornadaConfig();
  }, []);

  const handleUpdateSettings = async () => {
    setIsSettingsLoading(true);
    try {
      await settingsService.updateSettings({
        attention_message: attentionMessage,
        notification_sound: notificationSound,
        attention_max_minutes: Math.min(5, Math.max(0, Number(attentionMaxMinutes) || 0))
      });
      showAlert("Configuración global actualizada", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    setIsCreating(true);
    try {
      await userService.createUser({
        username: newUsername,
        password: newPassword,
        role: newRole
      });
      setNewUsername("");
      setNewPassword("");
      loadUsers();
      showAlert("Usuario registrado con éxito", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!userToEdit) return;
    setIsActionLoading(true);
    try {
      await userService.deleteUser(userToEdit.id);
      setIsDeleteModalOpen(false);
      setUserToEdit(null);
      setUserToEdit(null);
      loadUsers();
      showAlert("Usuario eliminado correctamente", { type: "success" });
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
      setUserToEdit(null);
      setEditPassword("");
      showAlert("Contraseña actualizada con éxito", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setIsSubjectActionLoading(true);
    try {
      await lmsService.createSubject(newSubjectName.trim());
      setNewSubjectName("");
      loadSubjects();
      showAlert("Materia global agregada", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsSubjectActionLoading(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta materia? Esto afectará los repositorios asociados.")) return;
    setIsSubjectActionLoading(true);
    try {
      await lmsService.deleteSubject(id);
      loadSubjects();
      showAlert("Materia eliminada", { type: "info" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsSubjectActionLoading(false);
    }
  };

  const openAssignModal = async (tutor: User) => {
    setUserToEdit(tutor);
    setSelectedTutorSubjects([]);
    setIsAssignModalOpen(true);
    setIsActionLoading(true);
    try {
      const tSubjects = await lmsService.getTutorSubjects(tutor.id);
      setSelectedTutorSubjects(tSubjects.map(s => s.id));
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const saveTutorSubjects = async () => {
    if (!userToEdit) return;
    setIsActionLoading(true);
    try {
      await lmsService.assignSubjectsToTutor(userToEdit.id, selectedTutorSubjects);
      setIsAssignModalOpen(false);
      setUserToEdit(null);
      showAlert("Materias asignadas correctamente", { type: "success" });
    } catch (err: any) {
      showAlert(err.message, { type: "error" });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl shadow-inner">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900">Panel Maestro</h1>
            <p className="text-gray-500 font-bold">Control total del sistema</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold">
            <Database size={20} /> Base de Datos Conectada
          </div>
        </div>
      </div>

      {/* Tabs de Navegación del Admin */}
      <div className="flex flex-wrap gap-2 bg-indigo-50/50 p-2 rounded-3xl border-2 border-indigo-100/50">
        <button 
          onClick={() => setActiveMainTab("users")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "users" ? "bg-white text-indigo-600 shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}
        >
          Usuarios
        </button>
        <button 
          onClick={() => setActiveMainTab("rewards")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "rewards" ? "bg-white text-amber-600 shadow-md" : "text-indigo-400 hover:text-amber-500"}`}
        >
          🎁 Recompensas
        </button>
        <button 
          onClick={() => setActiveMainTab("themes")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "themes" ? "bg-white text-indigo-600 shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}
        >
          Temas
        </button>
        <button
          onClick={() => setActiveMainTab("menu")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "menu" ? "bg-white text-cyan-600 shadow-md" : "text-indigo-400 hover:text-cyan-500"}`}
        >
          🖥️ Menú
        </button>
        <button
          onClick={() => setActiveMainTab("audio")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "audio" ? "bg-white text-violet-600 shadow-md" : "text-indigo-400 hover:text-violet-500"}`}
        >
          🔊 Audio
        </button>
        <button
          onClick={() => setActiveMainTab("jornadas")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "jornadas" ? "bg-white text-orange-600 shadow-md" : "text-indigo-400 hover:text-orange-500"}`}
        >
          🌅 Jornadas
        </button>
        <button 
          onClick={() => setActiveMainTab("settings")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "settings" ? "bg-white text-indigo-600 shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}
        >
          Configuración
        </button>
        <button
          onClick={() => setActiveMainTab("smarttv")}
          className={`flex-1 py-3 rounded-2xl font-black transition-all text-sm ${activeMainTab === "smarttv" ? "bg-white text-red-600 shadow-md" : "text-indigo-400 hover:text-red-500"}`}
        >
          📺 Smart TV
        </button>
      </div>

      {activeMainTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Gestión de Usuarios */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-gray-50">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <UserPlus className="text-indigo-500" /> Crear Nuevo Tutor / Admin
            </h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Nombre de usuario"
                className="p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
              />
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Contraseña"
                className="p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
              />
              <select 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
              >
                <option value="tutor">Tutor</option>
                <option value="admin">Administrador</option>
              </select>
              <button 
                type="submit"
                disabled={isCreating}
                className="p-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isCreating ? <Loader2 className="animate-spin" /> : <><UserPlus size={20}/> Registrar</>}
              </button>
            </form>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-gray-50 overflow-hidden">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
               Usuarios del Sistema
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 uppercase text-xs tracking-widest border-b">
                    <th className="px-4 pb-4">Usuario</th>
                    <th className="px-4 pb-4">Rol</th>
                    <th className="px-4 pb-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-black text-gray-700">{u.username}</td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 flex gap-2">
                        {u.role === 'tutor' && (
                          <button 
                            onClick={() => openAssignModal(u)}
                            className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                            title="Asignar materias"
                          >
                            <BookA size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setUserToEdit(u);
                            setEditPassword("");
                            setIsPasswordModalOpen(true);
                          }}
                          className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                          title="Cambiar contraseña"
                        >
                          <Key size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setUserToEdit(u);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        </div>
      )}

      {/* ──────── PESTAÑA RECOMPENSAS ──────── */}
      {activeMainTab === "rewards" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          {/* Formulario Crear/Editar */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-amber-100">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><Gift size={24} /></div>
              {editingRecompensa ? "Editar Recompensa" : "Crear Nueva Recompensa"}
            </h2>
            <form onSubmit={handleRecompensaSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Izquierda */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">Nombre *</label>
                  <input
                    type="text"
                    value={rwNombre}
                    onChange={e => setRwNombre(e.target.value)}
                    placeholder="Ej: YouTube Kids, Minecraft, Película"
                    className="w-full p-4 rounded-xl bg-amber-50 border-2 border-amber-100 focus:border-amber-400 outline-none font-bold text-gray-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">Descripción</label>
                  <textarea
                    value={rwDescripcion}
                    onChange={e => setRwDescripcion(e.target.value)}
                    placeholder="Descripción breve de la recompensa..."
                    rows={3}
                    className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-amber-200 outline-none font-bold text-gray-700 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">Emoji / Ícono</label>
                    <input
                      type="text"
                      value={rwEmoji}
                      onChange={e => setRwEmoji(e.target.value)}
                      maxLength={4}
                      className="w-full p-4 rounded-xl bg-amber-50 border-2 border-amber-100 focus:border-amber-400 outline-none font-bold text-3xl text-center"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">Tipo *</label>
                    <select
                      value={rwTipo}
                      onChange={e => setRwTipo(e.target.value as any)}
                      className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-amber-200 outline-none font-bold text-gray-700 h-[58px]"
                    >
                      <option value="url">🌐 URL / Web</option>
                      <option value="comando">⚙️ Comando</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Columna Derecha */}
              <div className="space-y-4">
                {rwTipo === 'url' ? (
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Link size={12} /> URL de la App / Sitio *</label>
                    <input
                      type="url"
                      value={rwUrl}
                      onChange={e => setRwUrl(e.target.value)}
                      placeholder="https://youtubekids.com"
                      className="w-full p-4 rounded-xl bg-blue-50 border-2 border-blue-100 focus:border-blue-400 outline-none font-bold text-gray-800 font-mono text-sm"
                    />
                    <p className="text-[10px] text-gray-400 font-bold mt-1">Se abrirá en Chromium en modo kiosco.</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Terminal size={12} /> Comando del Sistema *</label>
                    <input
                      type="text"
                      value={rwComando}
                      onChange={e => setRwComando(e.target.value)}
                      placeholder="minecraft-launcher --fullscreen"
                      className="w-full p-4 rounded-xl bg-gray-900 text-green-400 border-2 border-gray-700 focus:border-green-500 outline-none font-mono text-sm"
                    />
                    <p className="text-[10px] text-red-400 font-bold mt-1">⚠️ Solo para admins. Se ejecuta en el dispositivo kiosco.</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><ImageIcon size={12} /> URL de Imagen / Logo (opcional)</label>
                  <input
                    type="url"
                    value={rwImagenUrl}
                    onChange={e => setRwImagenUrl(e.target.value)}
                    placeholder="https://ejemplo.com/logo.png"
                    className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-amber-200 outline-none font-bold text-gray-700 text-sm"
                  />
                </div>

                {/* Preview */}
                {(rwNombre || rwEmoji) && (
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-100 flex items-center gap-4">
                    {rwImagenUrl ? (
                      <img src={rwImagenUrl} alt="preview" className="w-16 h-16 rounded-2xl object-cover shadow-md" onError={e => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      <div className="w-16 h-16 bg-amber-200 rounded-2xl flex items-center justify-center text-3xl shadow-inner">{rwEmoji || "🎁"}</div>
                    )}
                    <div>
                      <p className="font-black text-gray-800 text-lg">{rwNombre || "Nombre..."}</p>
                      <p className="text-xs font-bold text-amber-600 uppercase">{rwTipo === 'url' ? `🌐 ${rwUrl || 'sin URL'}` : `⚙️ Comando`}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isRecompensaCreating}
                    className="flex-1 p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRecompensaCreating ? <Loader2 className="animate-spin" /> : <>{editingRecompensa ? <Pencil size={18} /> : <Plus size={18} />} {editingRecompensa ? "Actualizar" : "Crear Recompensa"}</>}
                  </button>
                  {editingRecompensa && (
                    <button type="button" onClick={resetRecompensaForm} className="p-4 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200 transition-all">
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Lista de Recompensas */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-gray-50">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <Gift className="text-amber-500" size={24} /> Catálogo de Recompensas ({recompensas.length})
            </h2>
            {isRecompensasLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : recompensas.length === 0 ? (
              <div className="text-center p-12 bg-amber-50 rounded-[2rem] border-2 border-dashed border-amber-100">
                <div className="text-5xl mb-3">🎁</div>
                <p className="font-black text-amber-600">No hay recompensas creadas aún.</p>
                <p className="text-sm font-bold text-amber-400 mt-1">Usa el formulario de arriba para crear la primera.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recompensas.map(r => (
                  <div key={r.id} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-[2rem] border-2 border-amber-100 p-5 flex flex-col gap-4 hover:shadow-md hover:border-amber-300 transition-all group">
                    <div className="flex items-center gap-4">
                      {r.imagen_url ? (
                        <img src={r.imagen_url} alt={r.nombre} className="w-16 h-16 rounded-2xl object-cover shadow-md flex-shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <div className="w-16 h-16 bg-amber-200 rounded-2xl flex items-center justify-center text-3xl shadow-inner flex-shrink-0">{r.icono_emoji || "🎁"}</div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-black text-gray-800 text-lg leading-tight truncate">{r.nombre}</h4>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block ${
                          r.tipo === 'url' ? 'bg-blue-100 text-blue-600' : 'bg-gray-800 text-green-400'
                        }`}>
                          {r.tipo === 'url' ? '🌐 URL' : '⚙️ Comando'}
                        </span>
                      </div>
                    </div>

                    {r.descripcion && <p className="text-xs font-bold text-gray-500 line-clamp-2">{r.descripcion}</p>}

                    <div className="bg-white/70 rounded-xl p-3 font-mono text-xs text-gray-600 truncate border border-amber-100">
                      {r.tipo === 'url' ? r.url : r.comando}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => {
                          setEditingRecompensa(r);
                          setRwNombre(r.nombre);
                          setRwDescripcion(r.descripcion || "");
                          setRwEmoji(r.icono_emoji || "🎁");
                          setRwTipo(r.tipo);
                          setRwUrl(r.url || "");
                          setRwComando(r.comando || "");
                          setRwImagenUrl(r.imagen_url || "");
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex-1 py-2.5 bg-white text-amber-600 rounded-xl font-black text-xs border-2 border-amber-100 hover:bg-amber-50 transition-all flex items-center justify-center gap-1"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteRecompensa(r.id)}
                        className="p-2.5 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeMainTab === "themes" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-emerald-50">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Plus className="text-emerald-500" /> Crear Nuevo Tema
            </h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsThemeCreating(true);
              try {
                if (editingThemeId) {
                  await userService.updateTheme(editingThemeId, {
                    name: newThemeName,
                    slug: newThemeSlug,
                    config: JSON.parse(newThemeConfig)
                  });
                  showAlert("Tema actualizado con éxito", { type: "success" });
                } else {
                  await userService.createTheme({
                    name: newThemeName,
                    slug: newThemeSlug,
                    config: JSON.parse(newThemeConfig)
                  });
                  showAlert("Tema creado con éxito", { type: "success" });
                }
                setNewThemeName("");
                setNewThemeSlug("");
                setEditingThemeId(null);
                loadThemes();
              } catch (err: any) {
                showAlert("Error en el JSON o duplicado: " + err.message, { type: "error" });
              } finally {
                setIsThemeCreating(false);
              }
            }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="Nombre del tema (ej: Espacial)"
                  className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
                />
                <input
                  type="text"
                  value={newThemeSlug}
                  onChange={(e) => setNewThemeSlug(e.target.value)}
                  placeholder="Slug único (ej: espacial)"
                  className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
                />
                <button 
                  type="submit"
                  disabled={isThemeCreating}
                  className="w-full p-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  {isThemeCreating ? <Loader2 className="animate-spin" /> : <><Plus size={20}/> {editingThemeId ? 'Actualizar Tema' : 'Guardar Tema'}</>}
                </button>
                {editingThemeId && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingThemeId(null);
                      setNewThemeName("");
                      setNewThemeSlug("");
                    }}
                    className="w-full p-4 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={20}/> Cancelar Edición
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Configuración JSON</label>
                <textarea 
                  value={newThemeConfig}
                  onChange={(e) => setNewThemeConfig(e.target.value)}
                  className="w-full h-48 p-4 rounded-xl bg-gray-900 text-emerald-400 font-mono text-xs border-2 border-transparent focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </form>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Star className="text-emerald-500" /> Temas Disponibles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {themes.map(theme => (
                <div 
                  key={theme.id} 
                  className="p-6 rounded-[2rem] border-2 border-gray-100 bg-gray-50/50 flex flex-col gap-4 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vista Previa</span>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.config?.primary || '#6366f1' }}></div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.config?.secondary || '#818cf8' }}></div>
                    </div>
                  </div>

                  {/* Preview Card Mini */}
                  <div 
                    className="p-4 shadow-sm flex flex-col items-center justify-center gap-3 text-center min-h-[120px]"
                    style={{ 
                      backgroundColor: theme.config?.surface || '#fff', 
                      border: `${theme.config?.border || '1px'} solid ${theme.config?.primary || '#ccc'}`,
                      borderRadius: theme.config?.radius || '1rem'
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.config?.primary || '#6366f1'}20`, color: theme.config?.primary || '#6366f1' }}>
                      <Star size={24} fill={theme.config?.primary || 'none'} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-gray-800" style={{ fontFamily: theme.config?.font || 'inherit' }}>{theme.name}</h4>
                      <p className="text-[10px] opacity-60 font-bold uppercase tracking-tighter">Estilo Visual</p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>Identificador:</span>
                      <code className="bg-white px-2 py-0.5 rounded border text-[10px] font-mono">{theme.slug}</code>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>Borde:</span>
                      <span className="text-gray-900 px-2 py-0.5 bg-white rounded border">{theme.config?.border || '1px'}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2 border-t-2 border-gray-100/50 mt-auto">
                    <button 
                      onClick={() => {
                        setEditingThemeId(theme.id);
                        setNewThemeName(theme.name);
                        setNewThemeSlug(theme.slug);
                        setNewThemeConfig(JSON.stringify(theme.config, null, 2));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex-1 py-3 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase border-2 border-indigo-50 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm('¿Eliminar este tema?')) {
                          await userService.deleteTheme(theme.id);
                          loadThemes();
                          showAlert("Tema eliminado", { type: "info" });
                        }
                      }}
                      className="p-3 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border-2 border-indigo-100">
              <h3 className="font-black text-indigo-900 flex items-center gap-2 mb-2 italic">
                <AlertTriangle size={18} /> Nota Técnica
              </h3>
              <p className="text-sm text-indigo-700 font-bold">
                Para añadir un nuevo tema, crea una migración SQL en Supabase o inserta manualmente en la tabla <code className="bg-white/50 px-1 rounded">themes</code>. El sistema detectará automáticamente las variables CSS definidas en el JSON <code className="bg-white/50 px-1 rounded">config</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === "jornadas" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-orange-50">
            <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-xl text-orange-600"><Clock size={24} /></div>
              Configuración de Jornadas
            </h2>
            <p className="text-sm font-bold text-gray-500 mb-8">Define los rangos horarios para las actividades diarias. Formato: HH:MM-HH:MM</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'rango_manana', label: 'Mañana', emoji: '🌅', color: 'border-amber-100 bg-amber-50' },
                { key: 'rango_tarde', label: 'Tarde', emoji: '☀️', color: 'border-orange-100 bg-orange-50' },
                { key: 'rango_noche', label: 'Noche', emoji: '🌙', color: 'border-indigo-100 bg-indigo-50' },
              ].map((j) => (
                <div key={j.key} className={`p-6 rounded-[2rem] border-2 ${j.color} space-y-4`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{j.emoji}</span>
                    <span className="font-black text-gray-800 uppercase tracking-widest text-xs">{j.label}</span>
                  </div>
                  <input
                    type="text"
                    value={(jornadaConfig as any)[j.key]}
                    onChange={(e) => setJornadaConfig({ ...jornadaConfig, [j.key]: e.target.value })}
                    placeholder="00:00-00:00"
                    className="w-full p-4 rounded-2xl border-2 border-transparent focus:border-white bg-white/50 text-center font-black text-gray-700 outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSaveJornadaConfig}
                disabled={isJornadaSaving}
                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isJornadaSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                Guardar Configuración
              </button>
            </div>
          </div>

          <div className="p-6 bg-blue-50 border-2 border-dashed border-blue-100 rounded-[2rem] flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl text-blue-500 shadow-sm"><Info size={20} /></div>
            <div className="space-y-1">
              <p className="font-black text-blue-900 text-sm">Información Importante</p>
              <p className="text-xs font-bold text-blue-700/70 leading-relaxed">
                Los alumnos solo verán las actividades programadas dentro del rango horario actual. 
                Si una actividad está fuera de rango, no aparecerá en su lista de tareas.
                Las tareas marcadas como "Flexibles" seguirán apareciendo en cualquier horario.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === "settings" && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          {/* Configuración del Sistema (Mover aquí el bloque de ajustes) */}
          <div className="bg-gradient-to-br from-gray-900 to-indigo-900 p-8 rounded-[2.5rem] shadow-xl text-white">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <Settings className="text-indigo-400" /> Configuración Global
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-indigo-300 uppercase letter tracking-widest flex items-center gap-2">
                  <MessageSquare size={14} /> Mensaje Alerta Atención
                </label>
                <div className="flex flex-col gap-3">
                  <textarea 
                    value={attentionMessage}
                    onChange={(e) => setAttentionMessage(e.target.value)}
                    placeholder="Ej: ¡Hola! ¿Cómo vas? Sigamos juntos."
                    className="w-full bg-white/10 p-3 rounded-lg border border-white/20 text-sm focus:border-indigo-400 outline-none transition-all h-20 resize-none"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="col-span-1 md:col-span-1">
                      <label className="text-[10px] font-bold text-indigo-300">Duración máxima alerta (minutos, 0=5s)</label>
                      <input type="number" min={0} max={5} value={attentionMaxMinutes}
                        onChange={e => setAttentionMaxMinutes(Number(e.target.value))}
                        className="w-full bg-white/10 p-3 rounded-lg border border-white/20 text-sm focus:border-indigo-400 outline-none" />
                      <p className="text-[10px] text-indigo-300 mt-1">Máximo 5 minutos</p>
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <label className="text-[10px] font-bold text-indigo-300">Sonido de notificación (URL)</label>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <select value={notificationSound} onChange={(e) => setNotificationSound(e.target.value)}
                            className="flex-none bg-white/10 p-3 rounded-lg border border-white/20 text-sm focus:border-indigo-400 outline-none mr-2">
                            <option value="/sounds/beep.mp3">Beep (por defecto)</option>
                            <option value="/sounds/chime.mp3">Chime</option>
                            <option value="/sounds/ding.mp3">Ding</option>
                            <option value="/sounds/whatsapp.mp3">WhatsApp-style</option>
                            <option value="">Personalizada (URL abajo)</option>
                          </select>
                          <input type="text" value={notificationSound} onChange={e => setNotificationSound(e.target.value)}
                            className="flex-1 bg-white/10 p-3 rounded-lg border border-white/20 text-sm focus:border-indigo-400 outline-none" />
                        </div>
                        <div>
                          <button type="button" onClick={async () => {
                              const url = notificationSound || '/notification.mp3';
                              try {
                                await new Audio(url).play();
                              } catch (e) {
                                try {
                                  const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                                  if (!AudioContextClass) throw e;
                                  const ctx = new AudioContextClass();
                                  const o = ctx.createOscillator();
                                  const g = ctx.createGain();
                                  o.type = 'sine';
                                  o.frequency.value = 880;
                                  g.gain.value = 0.05;
                                  o.connect(g);
                                  g.connect(ctx.destination);
                                  o.start();
                                  setTimeout(() => { o.stop(); ctx.close(); }, 400);
                                } catch (_) {
                                }
                              }
                            }}
                            className="px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20">Probar</button>
                        </div>
                      </div>
                      <p className="text-[10px] text-indigo-300 mt-1">Sube sonidos a /public o usa una URL externa.</p>
                    </div>
                    <div className="col-span-1 md:col-span-1 flex items-end">
                      <button 
                        onClick={handleUpdateSettings}
                        disabled={isSettingsLoading}
                        className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSettingsLoading ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Guardar Cambios</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-indigo-300 uppercase letter tracking-widest">Google Gemini Key</label>
                  <div className="flex gap-2">
                    <input type="password" value="********" disabled className="flex-1 bg-white/10 p-3 rounded-lg border border-white/20 text-sm font-mono" />
                    <button className="p-3 bg-white/10 rounded-lg hover:bg-white/20"><Key size={20} /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-indigo-300 uppercase letter tracking-widest">Supabase Config</label>
                  <div className="flex gap-2">
                    <input type="text" value="https://pfc-db..." disabled className="flex-1 bg-white/10 p-3 rounded-lg border border-white/20 text-sm overflow-hidden" />
                    <button className="p-3 bg-white/10 rounded-lg hover:bg-white/20"><Database size={20} /></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Configurar Equipo Kiosco ─────────────────────────────── */}
          <div className="bg-gradient-to-br from-cyan-900 to-blue-900 p-8 rounded-[2.5rem] shadow-xl text-white mt-8">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
              <Monitor className="text-cyan-400" size={24} /> Configurar Equipo Kiosco
            </h2>
            <p className="text-cyan-300 text-sm font-bold mb-6">Asigna este equipo a un alumno. El agente kiosco usará este ID para controlar las recompensas.</p>
            
            {isDeviceLoading ? (
              <div className="flex items-center gap-3 p-4 bg-white/10 rounded-xl">
                <Loader2 className="animate-spin text-cyan-400" size={20} />
                <span className="font-bold text-sm">Cargando configuración actual...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Estado actual */}
                {currentDeviceAlumnoId && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                    <UserCheck size={20} className="text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-emerald-300 uppercase tracking-widest">Alumno Asignado Actualmente</p>
                      <p className="text-sm font-bold text-white truncate">
                        {users.find(u => u.id === currentDeviceAlumnoId)?.username || currentDeviceAlumnoId}
                      </p>
                    </div>
                  </div>
                )}

                {/* Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-cyan-300 uppercase tracking-widest">Seleccionar Alumno</label>
                  <select
                    value={deviceAlumnoId}
                    onChange={e => setDeviceAlumnoId(e.target.value)}
                    className="w-full bg-white/10 p-4 rounded-xl border border-white/20 text-white font-bold focus:border-cyan-400 outline-none transition-all appearance-none"
                  >
                    <option value="" className="text-gray-900">— Selecciona un alumno —</option>
                    {users.filter(u => u.role === 'student').map(u => (
                      <option key={u.id} value={u.id} className="text-gray-900">
                        {u.username} {u.id === currentDeviceAlumnoId ? '(actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSaveDevice}
                  disabled={isSavingDevice || !deviceAlumnoId || deviceAlumnoId === currentDeviceAlumnoId}
                  className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSavingDevice ? <Loader2 className="animate-spin" size={18} /> : <Monitor size={18} />}
                  {isSavingDevice ? 'Guardando...' : 'Asignar Equipo a Alumno'}
                </button>

                <p className="text-[10px] text-cyan-400/60 font-bold text-center">
                  ⚠️ Después de cambiar el alumno, reinicia el agente: <code className="bg-white/10 px-1.5 py-0.5 rounded">sudo systemctl restart ia-tutor-agente</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Menú del Sistema ─────────────────────────────────── */}
      {activeMainTab === "menu" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-cyan-900 p-8 rounded-[2.5rem] shadow-xl text-white">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
              <Monitor className="text-cyan-400" size={24} /> Menú del Sistema
            </h2>
            <p className="text-cyan-300 text-sm font-bold mb-6">Crea acciones del sistema operativo y define qué roles pueden verlas.</p>

            {/* Formulario crear/editar */}
            <div className="bg-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-black text-lg text-white">
                {editingAccion ? `✏️ Editando: ${editingAccion.nombre}` : "+ Nueva Acción"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <input value={menuForm.icono_emoji} onChange={e => setMenuForm(f => ({ ...f, icono_emoji: e.target.value }))}
                  placeholder="Emoji" className="bg-white/10 p-3 rounded-xl border border-white/20 text-white text-center text-2xl col-span-1 w-full" />
                <input value={menuForm.nombre} onChange={e => setMenuForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre de la acción" className="bg-white/10 p-3 rounded-xl border border-white/20 text-white font-bold col-span-1" />
              </div>
              <input value={menuForm.descripcion} onChange={e => setMenuForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción (opcional)" className="w-full bg-white/10 p-3 rounded-xl border border-white/20 text-white text-sm" />
              <input value={menuForm.comando} onChange={e => setMenuForm(f => ({ ...f, comando: e.target.value }))}
                placeholder="Comando del SO (ej: shutdown -h now)" className="w-full bg-white/10 p-3 rounded-xl border border-white/20 text-white font-mono text-sm" />
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={menuForm.requiere_sudo} onChange={e => setMenuForm(f => ({ ...f, requiere_sudo: e.target.checked }))}
                    className="w-4 h-4 accent-red-400" />
                  <span className="text-sm font-bold text-red-300">Requiere sudo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={menuForm.activo} onChange={e => setMenuForm(f => ({ ...f, activo: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-400" />
                  <span className="text-sm font-bold text-emerald-300">Activo</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-300 font-bold">Orden:</span>
                  <input type="number" value={menuForm.orden} onChange={e => setMenuForm(f => ({ ...f, orden: parseInt(e.target.value) || 0 }))}
                    className="w-16 bg-white/10 p-2 rounded-lg border border-white/20 text-white text-center text-sm" />
                </div>
              </div>

              {/* Roles visibles */}
              <div>
                <p className="text-xs font-black text-cyan-300 uppercase tracking-widest mb-2">Visible para:</p>
                <div className="flex gap-4">
                  {(['admin', 'tutor', 'student'] as const).map(rol => (
                    <label key={rol} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={menuForm.roles.includes(rol)}
                        onChange={e => setMenuForm(f => ({
                          ...f,
                          roles: e.target.checked ? [...f.roles, rol] : f.roles.filter(r => r !== rol)
                        }))}
                        className="w-4 h-4 accent-cyan-400" />
                      <span className="text-sm font-bold text-white capitalize">{rol === 'student' ? 'Alumno' : rol === 'tutor' ? 'Tutor' : 'Admin'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveAccion} disabled={isSavingAccion || !menuForm.nombre || !menuForm.comando}
                  className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                  {isSavingAccion ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {editingAccion ? 'Guardar Cambios' : 'Crear Acción'}
                </button>
                {editingAccion && (
                  <button onClick={() => { setEditingAccion(null); setMenuForm({ nombre: '', descripcion: '', icono_emoji: '⚙️', comando: '', requiere_sudo: false, orden: 0, activo: true, roles: [] }); }}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black transition-all">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lista de acciones */}
          <div className="bg-white rounded-[2.5rem] shadow-lg border-2 border-gray-50 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-800">Acciones configuradas</h3>
              {isMenuLoading && <Loader2 className="animate-spin text-cyan-500" size={18} />}
            </div>
            {menuAcciones.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Monitor size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-bold">No hay acciones creadas aún</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {menuAcciones.map(a => (
                  <div key={a.id} className={`flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors ${!a.activo ? 'opacity-50' : ''}`}>
                    <span className="text-2xl flex-shrink-0">{a.icono_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800">{a.nombre}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">{a.comando}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {a.requiere_sudo && <span className="text-[10px] bg-red-100 text-red-600 font-black px-2 py-0.5 rounded-full">SUDO</span>}
                        {!a.activo && <span className="text-[10px] bg-gray-200 text-gray-500 font-black px-2 py-0.5 rounded-full">INACTIVO</span>}
                        {a.roles.map(r => (
                          <span key={r} className="text-[10px] bg-cyan-100 text-cyan-700 font-black px-2 py-0.5 rounded-full capitalize">
                            {r === 'student' ? 'Alumno' : r === 'tutor' ? 'Tutor' : 'Admin'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditAccion(a)} className="p-2 rounded-xl bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-colors">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDeleteAccion(a.id)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Audio y Voz ────────────────────────────────────── */}
      {activeMainTab === "audio" && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <AudioDiagnosticsPanel />
        </div>
      )}

      {/* Catálogo Global de Materias (LMS) */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-indigo-50">
        <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
          <BookA className="text-indigo-500" /> Catálogo Global de Materias
        </h2>
        <div className="flex flex-col md:flex-row gap-8">
          <form onSubmit={handleCreateSubject} className="md:w-1/3 space-y-4">
            <p className="text-gray-500 font-bold text-sm">Crea repositorios de materias o áreas que los tutores podrán asignar para generar pruebas.</p>
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Ej: Matemáticas Avanzadas"
              className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-200 outline-none font-bold"
            />
            <button 
              type="submit"
              disabled={isSubjectActionLoading || !newSubjectName.trim()}
              className="w-full p-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubjectActionLoading ? <Loader2 className="animate-spin" /> : "Añadir Materia"}
            </button>
          </form>

          <div className="md:w-2/3 flex flex-wrap gap-4">
            {subjects.length === 0 && <p className="text-gray-400 font-bold italic w-full text-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed">No hay materias catalogadas aún.</p>}
            {subjects.map(sub => (
              <div key={sub.id} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-3 rounded-2xl font-bold flex items-center gap-4">
                {sub.name}
                <button onClick={() => handleDeleteSubject(sub.id)} className="text-indigo-300 hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modales de Gestión */}
      <Modal 
        isOpen={isPasswordModalOpen} 
        onClose={() => {
          setIsPasswordModalOpen(false);
          setUserToEdit(null);
        }}
        title="Cambiar Contraseña"
      >
        <div className="space-y-6">
          <p className="text-gray-500 font-bold">Escribe la nueva contraseña para <span className="text-indigo-600">@{userToEdit?.username}</span></p>
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
        title="Eliminar Usuario"
      >
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={40} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">¿Estás seguro?</p>
            <p className="text-gray-500 font-bold">Estás a punto de eliminar a <span className="text-red-600">@{userToEdit?.username}</span>. Esta acción no se puede deshacer y borrará todas sus tareas asociadas.</p>
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

      <Modal 
        isOpen={isAssignModalOpen} 
        onClose={() => {
          setIsAssignModalOpen(false);
          setUserToEdit(null);
        }}
        title="Asignar Materias"
      >
        <div className="space-y-6">
          <p className="text-gray-500 font-bold">Selecciona las materias que el tutor <span className="text-indigo-600">@{userToEdit?.username}</span> podrá gestionar.</p>
          
          <div className="max-h-60 overflow-y-auto space-y-2 p-2 px-4 rounded-xl border-2 border-gray-100 bg-gray-50">
            {subjects.length === 0 && <p className="text-sm text-gray-400 font-bold py-2">No tienes materias registradas en el catálogo maestro.</p>}
            {subjects.map(s => {
              const isChecked = selectedTutorSubjects.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-all border border-transparent hover:border-gray-200">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                    {isChecked && <CheckSquare size={14} />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        setSelectedTutorSubjects(prev => prev.filter(id => id !== s.id));
                      } else {
                        setSelectedTutorSubjects(prev => [...prev, s.id]);
                      }
                    }}
                  />
                  <span className="font-bold text-gray-700">{s.name}</span>
                </label>
              );
            })}
          </div>

          <button 
            onClick={saveTutorSubjects}
            disabled={isActionLoading}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isActionLoading ? <Loader2 className="animate-spin" /> : "Guardar Relación"}
          </button>
        </div>
      </Modal>

      {/* ──────── PESTAÑA SMART TV ──────── */}
      {activeMainTab === "smarttv" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-red-50">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <Tv size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Control Parental Smart TV</h2>
                <p className="text-gray-500 font-medium text-sm mt-0.5">
                  Configura el horario de bloqueo y el apagado manual del televisor por alumno.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
                <Loader2 className="animate-spin" size={24} />
                <span>Cargando alumnos...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {users.filter(u => u.role === "student").length === 0 ? (
                  <div className="text-center p-12 bg-red-50 rounded-[2rem] border-2 border-dashed border-red-100">
                    <div className="text-5xl mb-3">📺</div>
                    <p className="font-black text-red-600">No hay alumnos registrados.</p>
                    <p className="text-sm font-bold text-red-400 mt-1">
                      Crea alumnos desde la pestaña Usuarios para configurar su Smart TV.
                    </p>
                  </div>
                ) : (
                  users.filter(u => u.role === "student").map(student => (
                    <div key={student.id} className="rounded-2xl border border-gray-100 overflow-hidden">
                      {/* Fila del alumno */}
                      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100/70 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm">
                            {student.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{student.username}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-widest">Alumno</p>
                          </div>
                        </div>
                        <button
                          id={`admin-tv-config-${student.id}`}
                          onClick={() =>
                            setExpandedTvStudentId(prev =>
                              prev === student.id ? null : student.id
                            )
                          }
                          className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition ${
                            expandedTvStudentId === student.id
                              ? "bg-red-600 text-white shadow-md"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                        >
                          <Tv size={15} />
                          {expandedTvStudentId === student.id ? "Cerrar" : "Configurar TV"}
                        </button>
                      </div>

                      {/* Panel expandible */}
                      {expandedTvStudentId === student.id && (
                        <div className="px-6 pb-6 bg-white">
                          <TvControlPanel
                            studentId={student.id}
                            studentName={student.username}
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
