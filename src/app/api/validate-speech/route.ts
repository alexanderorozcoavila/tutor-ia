import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { logError } from "@/lib/logger";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const { targetWord, transcribedText } = await req.json();

    if (!targetWord || !transcribedText) {
      return Response.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Instruct Gemini 1.5 Flash to act as a kind tutor for ADHD/ASD children
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        status: z.enum(["success", "retry"]),
        tutor_message: z.string().describe("Mensaje amigable y de refuerzo positivo que se leerá al niño. Nunca uses la palabra incorrecto. Da una pista si es necesario."),
      }),
      system: `Eres un tutor empático y paciente especializado en niños de 6 a 10 años con TDAH o TEA Nivel 1. 
      Tu prioridad absoluta es mantener la motivación, nunca frustrar al niño. 
      El niño, para el ejercicio actual, debía leer la palabra/frase objetivo. Si omiten partes o dicen algo parecido fonéticamente con errores menores, evalúalo según el contexto.
      Si el niño dijo algo totalmente distinto, pide que lo intente de nuevo y dale una pista fonética sutil o anímalo con cariño.
      Nunca digas "Incorrecto" o "Estás mal".`,
      prompt: `La palabra a leer era: "${targetWord}".
      El niño leyó al micrófono: "${transcribedText}".
      Evalúa si es aceptable (success) o si debe intentar de nuevo (retry) y genera el mensaje de voz acorde.`,
    });

    return Response.json(object);
  } catch (error) {
    logError(error, "api/validate-speech");
    return Response.json(
      { error: "Error al validar la lectura" },
      { status: 500 }
    );
  }
}
