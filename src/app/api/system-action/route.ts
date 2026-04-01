import { NextResponse } from "next/server";

const AGENT_URL = `http://127.0.0.1:${process.env.MENU_AGENT_PORT || "3001"}`;

/**
 * POST /api/system-action
 * Body: { accion_id: string }
 * Proxy seguro hacia el action_agent.py local.
 */
export async function POST(request: Request) {
  try {
    const { accion_id } = await request.json();

    if (!accion_id || typeof accion_id !== "string") {
      return NextResponse.json({ error: "accion_id requerido" }, { status: 400 });
    }

    const response = await fetch(`${AGENT_URL}/ejecutar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion_id }),
      signal: AbortSignal.timeout(12_000), // 12s timeout
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : 500 });
  } catch (err: any) {
    // Si el agente no está corriendo
    if (err.cause?.code === "ECONNREFUSED" || err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "El agente de menú no está disponible. ¿Está corriendo action_agent.py?" },
        { status: 503 }
      );
    }
    console.error("[system-action] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
