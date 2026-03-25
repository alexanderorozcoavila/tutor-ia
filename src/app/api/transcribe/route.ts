import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file") as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: "No se encontró el archivo de audio" }, { status: 400 });
    }

    // Groq requires standard FormData with model definition
    const apiFormData = new FormData();
    apiFormData.append("file", audioFile, "audio.webm");
    apiFormData.append("model", "whisper-large-v3-turbo");
    apiFormData.append("response_format", "json");
    apiFormData.append("language", "es");

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY no está configurada");
    }

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        // Note: fetch automatically sets multipart form-data boundary when passing FormData
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error from Groq API:", errorData);
      return NextResponse.json({ error: "Error de transcripción" }, { status: response.status });
    }

    const { text } = await response.json();
    return NextResponse.json({ text });
    
  } catch (error) {
    logError(error, "api/transcribe");
    return NextResponse.json({ error: "Ha ocurrido un error inesperado" }, { status: 500 });
  }
}
