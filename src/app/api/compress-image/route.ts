import { NextResponse } from 'next/server';
import sharp from 'sharp';

export async function POST(req: Request) {
  try {
    const { base64Image } = await req.json();

    if (!base64Image) {
      return NextResponse.json({ error: 'Falta la imagen base64' }, { status: 400 });
    }

    // Extraer metadata del base64 ("data:image/jpeg;base64,...")
    const matches = base64Image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Formato base64 inválido' }, { status: 400 });
    }

    const data = Buffer.from(matches[2], 'base64');

    // Pipeline de compresión con Sharp: Convertir a WebP y calidad 75%
    // Mantiene canal Alpha automáticamente para PNGs (transparencia)
    const compressedBuffer = await sharp(data)
      .webp({ quality: 75, lossless: false })
      .toBuffer();

    const compressedBase64 = `data:image/webp;base64,${compressedBuffer.toString('base64')}`;

    return NextResponse.json({ compressedImage: compressedBase64 });
  } catch (error) {
    console.error('Error al comprimir la imagen:', error);
    return NextResponse.json({ error: 'Fallo al procesar la imagen' }, { status: 500 });
  }
}
