// app/api/optimize/route.ts
import JSZip from "jszip";
import sharp from "sharp";
import { requireAdmin } from "@/lib/api/admin";

export async function POST(req: Request) {
  // ✅ Фаза 0 — безопасность: только для администраторов
  const adminCheck = await requireAdmin();
  if ("response" in adminCheck) return adminCheck.response;

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const quality = parseInt(formData.get("quality") as string) || 80;

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Файлы не найдены" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const zip = new JSZip();

    await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());

        const webpBuffer = await sharp(buffer).webp({ quality }).toBuffer();

        const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";

        zip.file(newName, webpBuffer);
      }),
    );

    const zipData = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipData as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="optimized_images.zip"',
      },
    });
  } catch (error) {
    console.error("Критическая ошибка сервера:", error);
    return new Response(
      JSON.stringify({ error: "Ошибка сервера" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}