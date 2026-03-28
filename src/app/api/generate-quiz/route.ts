import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { logError } from "@/lib/logger";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { baseText, questionCount } = await req.json();

    if (!baseText || !questionCount || questionCount <= 0) {
      return Response.json({ error: "Faltan parámetros requeridos (baseText y questionCount)" }, { status: 400 });
    }

    // Call Gemini 1.5/2.5 Flash para generación estructural
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        questions: z.array(
          z.object({
            id: z.string().describe("Un ID único y aleatorio para la pregunta (uuid-like)"),
            text: z.string().describe("La pregunta adaptada a un niño de 6 a 9 años de edad."),
            options: z.array(z.string()).length(3).describe("Exclusivamente 3 opciones claras de respuesta."),
            correctIndex: z.number().int().min(0).max(2).describe("El índice exacto (0-2) de la opción que es correcta."),
            explanation: z.string().describe("Un mensaje corto, asertivo y amigable celebrando y justificando por qué es correcto. (Ej: '¡Así es! Porque la rana verde...')"),
          })
        ).length(questionCount), // Exigimos la cantidad exacta pedida por el usuario
      }),
      system: `
        Actúa como un Especialista en Pedagogía Infantil Excepcional, experto en crear evaluaciones de comprensión lectora para niños de educación básica inicial (6 a 9 años).
        
        ### Reglas de Generación:
        1. Lenguaje Simple: Español neutro, directo. Evita metáforas complejas, "preguntas trampa", "Todas/Ninguna de las anteriores".
        2. Número Exacto: Genera una matriz estrictamente del tamaño de "questionCount" solicitado.
        3. Explicación Refuerzo: La explicación de la correcta debe sonar muy positiva y justificar sutilmente el punto.
      `,
      messages: [
        {
          role: "user",
          content: `Genera ${questionCount} pregunta(s) de comprensión lectora sobre el siguiente texto:\n\n"${baseText}"`,
        },
      ],
    });

    return Response.json({ questions: object.questions });
  } catch (error) {
    logError(error, "api/generate-quiz");
    return Response.json(
      { error: "Error interactuando con la API de IA o el formato resultante fue inválido." },
      { status: 500 }
    );
  }
}
