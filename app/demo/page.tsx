import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import AssignmentClient from "@/app/(app)/projects/[slug]/assignment/AssignmentClient";
import DemoMaterialClient from "./DemoMaterialClient";
import Link from "next/link";

export const revalidate = 0;

type Props = {
  searchParams: Promise<{ assignmentId?: string }>;
};

function toStorageProxyUrl(raw: unknown) {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/api/storage/public/")) return value;
  if (value.startsWith("data:")) return value;

  const marker = "/storage/v1/object/public/";
  const idx = value.indexOf(marker);
  if (idx === -1) return value;

  const restWithQuery = value.slice(idx + marker.length);
  const cleanRest = restWithQuery.split("?")[0]?.split("#")[0] ?? "";
  const parts = cleanRest.split("/").filter(Boolean);
  const bucket = parts.shift();
  const path = parts.join("/");

  if (!bucket || !path) return value;
  return getStoragePublicUrl(bucket, path);
}

export default async function DemoPage({ searchParams }: Props) {
  const { assignmentId } = await searchParams;
  const supabase = await createSupabaseServerClient();

  // 1. Ищем активный демо-материал
  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("is_demo", true)
    .eq("is_active", true)
    .maybeSingle();

  if (!material) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <h1 className="text-2xl font-bold mb-2">Демо-задание не доступно</h1>
        <p className="text-slate-400 max-w-md mb-6">
          Администратор еще не настроил демо-материал в системе.
        </p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
        >
          ← Вернуться на страницу входа
        </Link>
      </div>
    );
  }

  // 2. Если передан параметр задания, запускаем его прохождение
  if (assignmentId) {
    return (
      <AssignmentClient
        assignmentId={assignmentId}
        projectSlug="demo"
        guestMode={true}
      />
    );
  }

  // 3. Загружаем все задания демо-материала для отображения списка
  const { data: assignmentsData } = await supabase
    .from("assignments")
    .select("id, title, order_index, assignment_type")
    .or(
      `material_id.eq.${material.id},textbook_id.eq.${material.id},crossword_id.eq.${material.id}`
    )
    .order("order_index", { ascending: true });

  const assignments = assignmentsData || [];
  const coverUrl = toStorageProxyUrl(material.cover_image_url);

  // 4. Открываем светлую страницу материала
  return (
    <DemoMaterialClient
      material={material}
      assignments={assignments}
      coverUrl={coverUrl}
    />
  );
}