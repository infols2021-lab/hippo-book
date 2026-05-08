import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) return new NextResponse("No URL provided", { status: 400 });

  try {
    // Добавляем User-Agent, чтобы хранилища не блокировали запрос от "бота"
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status} ${imageUrl}`);
      // Если не удалось скачать для оптимизации, просто редиректим на оригинал
      return NextResponse.redirect(imageUrl);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const optimizedImage = await sharp(inputBuffer)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return new NextResponse(new Uint8Array(optimizedImage), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Optimization error, redirecting to raw:", error);
    // В случае любой ошибки sharp'а просто отдаем оригинал, чтобы картинка не "пропадала"
    return NextResponse.redirect(imageUrl);
  }
}