import JSZip from 'jszip';
import sharp from 'sharp';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const quality = parseInt(formData.get('quality') as string) || 80;

    // Проверка наличия файлов [cite: 16]
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: 'Файлы не найдены' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const zip = new JSZip();

    // Параллельная обработка всех изображений через sharp 
    await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Конвертируем в WebP с заданным качеством
        const webpBuffer = await sharp(buffer)
          .webp({ quality })
          .toBuffer();

        // Убираем старое расширение и добавляем .webp
        const newName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
        
        // Добавляем файл в ZIP-архив
        zip.file(newName, webpBuffer);
      })
    );

    // Генерируем бинарные данные архива
    const zipData = await zip.generateAsync({ type: 'uint8array' });

    /**
     * РЕШЕНИЕ ОШИБКИ ТИПИЗАЦИИ:
     * Мы используем 'as unknown as BodyInit', чтобы TypeScript в Next.js 16 
     * принял Uint8Array как валидное тело ответа Response.
     */
    return new Response(zipData as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="optimized_images.zip"',
      },
    });

  } catch (error) {
    console.error('Критическая ошибка сервера:', error);
    return new Response(JSON.stringify({ error: 'Ошибка сервера' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}