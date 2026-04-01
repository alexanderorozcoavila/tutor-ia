import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * POST /api/configure-device
 * Body: { alumnoId: string }
 * 
 * Escribe/actualiza ALUMNO_ID en el archivo .env.local del proyecto
 * para que el agente kiosco sepa qué alumno controlar.
 * 
 * Solo debe usarse por administradores desde la UI.
 */
export async function POST(request: Request) {
  try {
    const { alumnoId } = await request.json();

    if (!alumnoId || typeof alumnoId !== "string" || alumnoId.trim().length < 5) {
      return NextResponse.json(
        { error: "ID de alumno inválido" },
        { status: 400 }
      );
    }

    const envPath = join(process.cwd(), ".env.local");

    if (!existsSync(envPath)) {
      return NextResponse.json(
        { error: "Archivo .env.local no encontrado en el servidor" },
        { status: 500 }
      );
    }

    // Leer contenido actual
    let content = readFileSync(envPath, "utf-8");

    // Reemplazar o agregar ALUMNO_ID
    const regex = /^ALUMNO_ID=.*$/m;
    const newLine = `ALUMNO_ID=${alumnoId.trim()}`;

    if (regex.test(content)) {
      // Ya existe → reemplazar
      content = content.replace(regex, newLine);
    } else {
      // No existe → agregar al final
      // Asegurar que hay un salto de línea antes
      if (!content.endsWith("\n")) content += "\n";
      content += `\n# Agente Kiosco — Alumno asignado a este dispositivo\n${newLine}\n`;
    }

    writeFileSync(envPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: `Dispositivo configurado para alumno ${alumnoId.trim()}`,
    });
  } catch (error: any) {
    console.error("Error configurando dispositivo:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/configure-device
 * Devuelve el ALUMNO_ID actualmente configurado en .env.local
 */
export async function GET() {
  try {
    const envPath = join(process.cwd(), ".env.local");

    if (!existsSync(envPath)) {
      return NextResponse.json({ alumnoId: null });
    }

    const content = readFileSync(envPath, "utf-8");
    const match = content.match(/^ALUMNO_ID=(.+)$/m);

    return NextResponse.json({
      alumnoId: match ? match[1].trim() : null,
    });
  } catch (error: any) {
    return NextResponse.json({ alumnoId: null });
  }
}
