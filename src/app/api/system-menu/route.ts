import { NextResponse } from "next/server";

const AGENT_URL = `http://127.0.0.1:${process.env.MENU_AGENT_PORT || "3001"}`;

/**
 * GET /api/system-menu?rol=admin|tutor|student
 * Retorna los ítems del menú visibles para el rol dado.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rol = searchParams.get("rol");

  if (!rol || !["admin", "tutor", "student"].includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  try {
    // Importación dinámica para que no rompa en client-side
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("menu_acciones")
      .select(`
        id,
        nombre,
        descripcion,
        icono_emoji,
        orden,
        activo,
        menu_rol_visibilidad!inner(rol)
      `)
      .eq("activo", true)
      .eq("menu_rol_visibilidad.rol", rol)
      .order("orden");

    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (err: any) {
    console.error("[system-menu] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
