import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no configurada.");
    }

    const { targetText, transcribedText } = await req.json();

    if (!targetText || !transcribedText) {
      return NextResponse.json(
        { error: "Faltan parámetros de texto objetivo o transcrito." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Eres un tutor infantil evaluando la lectura en voz alta de un niño de entre 5 y 8 años.

TEXTO OBJETIVO A LEER:
"${targetText}"

TEXTO TRANSCRITO DE SU VOZ:
"${transcribedText}"

TAREAS:
1. Compara qué tan parecido es el texto transcrito al objetivo, considerando que la IA de transcripción a veces falla ligeramente o el niño arrastra una sílaba (sé comprensivo pero justo).
2. Calcula una puntuación de precisión (score) del 0 al 100.
3. Redacta un mensaje de retroalimentación super cortito (DE MÁXIMO 15 PALABRAS) que se le dirá al niño de forma hablada.
- Si le fue genial (>80): super efusivo "¡Qué lectura más asombrosa! Eres increíble."
- Si le fue medio (50-79): "¡Vas por buen camino! Podemos mejorar un poquito."
- Si se equivocó mucho o inventó (<50): "¡Uf, qué difícil! ¿Lo leemos de nuevo con más calma?"

REGLA ESTRICTA DE SALIDA:
Debes responder ÚNICAMENTE con un objeto JSON válido, sin delimitadores de código markdown, con esta estructura exacta:
{
  "score": 90,
  "message": "¡Excelente lectura, tienes voz de locutor!"
}
`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text().trim();
    
    // Safety parsing in case Gemini adds ```json
    let cleanJson = textResponse;
    if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
    } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/```/g, '').trim();
    }

    const evalData = JSON.parse(cleanJson);

    return NextResponse.json({
      score: evalData.score,
      message: evalData.message
    });

  } catch (error: any) {
    console.error("Error validando lectura:", error.message);
    return NextResponse.json(
      { error: "Hubo un problema mágico validando la lectura." },
      { status: 500 }
    );
  }
}
