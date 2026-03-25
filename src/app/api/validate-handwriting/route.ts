import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { logError } from "@/lib/logger";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const { targetWord, base64Image } = await req.json();

    if (!targetWord || !base64Image) {
      return Response.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Call Gemini 1.5 Flash Vision
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        success: z.boolean(),
        message: z.string().describe("Mensaje amigable y de refuerzo positivo que se leerá al niño. Si lo logró, felicítalo efusivamente. Si falló, dile qué intentó hacer y anímalo a que sea más claro."),
        detected_text: z.string().describe("Texto aproximado que logras ver en la imagen"),
      }),
      system: `Eres un tutor experto en caligrafía infantil para niños de 6 a 10 años con TDA/TEA Nivel 1.
      Vas a recibir una foto de lo que el niño ha escrito en su cuaderno.
      La meta del niño era escribir el siguiente texto: "${targetWord}".
      Evalúa la imagen siendo MUY permisivo. Los niños pueden tener trazos irregulares, letras de distintos tamaños, omisiones menores o luz precaria.
      Si la mayor parte del texto es legible y coincide con la intención del ejercicio, marca 'success' como true.
      Tu mensaje debe ser siempre reforzador, NUNCA usar la palabra "Incorrecto" o "Mal".
      Si hay errores, menciónalos como "puntos para mejorar" de forma dulce.
      Ejemplo si hay errores: "¡Qué increíble esfuerzo! Veo que escribiste casi todo perfecto. Solo ten cuidado con la letra 'b' que parece una 'd', ¡pero vas por muy buen camino!"`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `El texto esperado es: ${targetWord}` },
            {
              type: "image",
              image: Buffer.from(base64Image, 'base64'),
            },
          ],
        },
      ],
    });

    return Response.json(object);
  } catch (error) {
    logError(error, "api/validate-handwriting");
    return Response.json(
      { error: "Error procesando la imagen de caligrafía" },
      { status: 500 }
    );
  }
}
