import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) return new NextResponse("No URL provided", { status: 400 });

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Обработка через sharp: ресайз до 1200px и конвертация в WebP (качество 80)
    const optimizedImage = await sharp(inputBuffer)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // ФИКС ОШИБКИ: оборачиваем Buffer в Uint8Array для NextResponse
    return new NextResponse(new Uint8Array(optimizedImage), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Image optimization error:", error);
    return new NextResponse("Error processing image", { status: 500 });
  }
}