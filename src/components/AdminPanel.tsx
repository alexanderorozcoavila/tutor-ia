"use client";

import { useState, useEffect } from "react";
import { User, userService } from "@/lib/userService";
import { settingsService } from "@/lib/settingsService";
import { lmsService, Subject } from "@/lib/lmsService";
import { UserPlus, Settings, Database, Key, ShieldCheck, Loader2, Trash2, AlertTriangle, MessageSquare, Save, BookA, CheckSquare, X, Star, Plus, Pencil } from "lucide-react";
import { Modal } from "./Modal";
import { useAlert } from "@/lib/AlertContext";

export function AdminPanel() {
  const { showAlert } = useAlert();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"tutor" | "admin">("tutor");
  const [isCreating, setIsCreating] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<"users" | "themes" | "settings">("users");
  const [themes, setThemes] = useState<any[]>([]);
  const [isThemesLoading, setIsThemesLoading] = useState(false);

  // Estados para modales
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState("");
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
  
  // Modal de Asignación a Tutor
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTutorSubjects, setSelectedTutorSubjects] = useState<string[]>([]);

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

  useEffect(() => {
    loadUsers();
    loadSettings();
    loadSubjects();
    loadThemes();
  }, []);

  const handleUpdateSettings = async () => {
    setIsSettingsLoading(true);
    try {
      await settingsService.updateSettings({ attention_message: attentionMessage });
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
      <div className="flex bg-indigo-50/50 p-2 rounded-3xl border-2 border-indigo-100/50">
        <button 
          onClick={() => setActiveMainTab("users")}
          className={`flex-1 py-4 rounded-2xl font-black transition-all ${activeMainTab === "users" ? "bg-white text-indigo-600 shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}
        >
          Gestión de Usuarios
        </button>
        <button 
          onClick={() => setActiveMainTab("themes")}
          className={`flex-1 py-4 rounded-2xl font-black transition-all ${activeMainTab === "themes" ? "bg-white text-indigo-600 shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}
        >
          Sistema de Temas
        </button>
        <button 
          onClick={() => setActiveMainTab("settings")}
          className={`flex-1 py-4 rounded-2xl font-black transition-all ${activeMainTab === "settings" ? "bg-white text-indigo-600 shadow-md" : "text-indigo-400 hover:text-indigo-600"}`}
        >
          Configuración Global
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
                  <button 
                    onClick={handleUpdateSettings}
                    disabled={isSettingsLoading}
                    className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSettingsLoading ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Guardar Cambios</>}
                  </button>
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
    </div>
  );
}
