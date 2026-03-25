import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { logError } from "@/lib/logger";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { base64Image } = await req.json();

    if (!base64Image) {
      return Response.json({ error: "No se proporcionó ninguna imagen" }, { status: 400 });
    }

    // Call Gemini 1.5 Flash Vision for OCR
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: "Eres un experto en OCR (Reconocimiento óptico de caracteres). Tu tarea es extraer el texto de la imagen proporcionada de manera exacta. No añadidas comentarios, solo devuelve el texto encontrado. Si no hay texto, devuelve una cadena vacía.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: Buffer.from(base64Image, 'base64'),
            },
            { type: "text", text: "Extrae todo el texto de esta imagen." },
          ],
        },
      ],
    });

    return Response.json({ text: text.trim() });
  } catch (error) {
    logError(error, "api/extract-text");
    return Response.json(
      { error: "Error procesando la imagen para extraer texto" },
      { status: 500 }
    );
  }
}
