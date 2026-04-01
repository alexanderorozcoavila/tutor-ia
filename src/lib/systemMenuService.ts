// src/lib/systemMenuService.ts

export interface MenuAccion {
  id: string;
  nombre: string;
  descripcion?: string;
  icono_emoji: string;
  orden: number;
  activo: boolean;
}

export interface MenuAccionCompleta extends MenuAccion {
  comando: string;
  requiere_sudo: boolean;
  roles: string[]; // ['admin', 'tutor', 'student']
}

export const systemMenuService = {
  /**
   * Obtiene los ítems del menú visibles para un rol dado.
   * Llama a /api/system-menu (que consulta Supabase).
   */
  async getMenuItems(rol: string): Promise<MenuAccion[]> {
    const res = await fetch(`/api/system-menu?rol=${rol}`);
    if (!res.ok) throw new Error("Error cargando el menú del sistema");
    const data = await res.json();
    return data.items || [];
  },

  /**
   * Ejecuta una acción del sistema vía el agente local.
   * Llama a /api/system-action → proxy → action_agent.py:3001.
   */
  async ejecutarAccion(accionId: string): Promise<{ ok: boolean; accion?: string; error?: string }> {
    const res = await fetch("/api/system-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion_id: accionId }),
    });
    return res.json();
  },

  // ── Admin: gestión completa ────────────────────────────────────────────────

  async getAllAcciones(): Promise<MenuAccionCompleta[]> {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase
      .from("menu_acciones")
      .select("*, menu_rol_visibilidad(rol)")
      .order("orden");
    if (error) throw error;
    return (data || []).map((a: any) => ({
      ...a,
      roles: (a.menu_rol_visibilidad || []).map((r: any) => r.rol),
    }));
  },

  async createAccion(payload: {
    nombre: string;
    descripcion?: string;
    icono_emoji: string;
    comando: string;
    requiere_sudo: boolean;
    orden: number;
    roles: string[];
  }): Promise<void> {
    const { supabase } = await import("./supabase");
    const { roles, ...accionData } = payload;

    const { data, error } = await supabase
      .from("menu_acciones")
      .insert([accionData])
      .select()
      .single();
    if (error) throw error;

    if (roles.length > 0) {
      await supabase.from("menu_rol_visibilidad").insert(
        roles.map((rol) => ({ accion_id: data.id, rol }))
      );
    }
  },

  async updateAccion(
    id: string,
    payload: {
      nombre: string;
      descripcion?: string;
      icono_emoji: string;
      comando: string;
      requiere_sudo: boolean;
      orden: number;
      activo: boolean;
      roles: string[];
    }
  ): Promise<void> {
    const { supabase } = await import("./supabase");
    const { roles, ...accionData } = payload;

    const { error } = await supabase
      .from("menu_acciones")
      .update(accionData)
      .eq("id", id);
    if (error) throw error;

    // Reemplazar visibilidad: borrar y reinsertar
    await supabase.from("menu_rol_visibilidad").delete().eq("accion_id", id);
    if (roles.length > 0) {
      await supabase.from("menu_rol_visibilidad").insert(
        roles.map((rol) => ({ accion_id: id, rol }))
      );
    }
  },

  async deleteAccion(id: string): Promise<void> {
    const { supabase } = await import("./supabase");
    const { error } = await supabase.from("menu_acciones").delete().eq("id", id);
    if (error) throw error;
  },
};
