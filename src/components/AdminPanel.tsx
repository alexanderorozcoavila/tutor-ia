"use client";

import { useState, useEffect } from "react";
import { User, userService } from "@/lib/userService";
import { settingsService } from "@/lib/settingsService";
import { UserPlus, Settings, Database, Key, ShieldCheck, Loader2, Trash2, AlertTriangle, MessageSquare, Save } from "lucide-react";
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

  // Estados para modales
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState("");
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

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

  useEffect(() => {
    loadUsers();
    loadSettings();
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

        {/* Configuración del Sistema */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-indigo-900 p-8 rounded-[2.5rem] shadow-xl text-white">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <Settings className="text-indigo-400" /> Configuración
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
    </div>
  );
}
