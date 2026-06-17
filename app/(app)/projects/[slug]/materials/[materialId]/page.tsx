import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import MaterialClient from "./MaterialClient";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string; materialId: string }>;
};

// Функция для получения прямой ссылки на картинку
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

export default async function MaterialDetailsPage({ params }: PageProps) {
  const { slug, materialId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1. Получаем проект
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, is_active, theme_color, theme")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_active) notFound();

  // 2. Получаем сам материал
  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", materialId)
    .eq("is_active", true)
    .single();

  if (!material) notFound();

  // 3. Проверка доступа
  let hasAccess = material.is_available;
  if (!hasAccess) {
    const { data: access } = await supabase
      .from("material_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("material_id", materialId)
      .single();
    if (access) hasAccess = true;
  }

  // 4. Получаем список заданий (убрано description, добавлено assignment_type)
  const { data: assignmentsData } = await supabase
    .from("assignments")
    .select("id, title, order_index, assignment_type")
    .or(`material_id.eq.${materialId},textbook_id.eq.${materialId},crossword_id.eq.${materialId}`)
    .order("order_index", { ascending: true });

  const assignments = assignmentsData || [];
  const assignmentIds = assignments.map(a => a.id);

  // 5. Прогресс
  let completedIds: string[] = [];
  if (assignmentIds.length > 0) {
    const { data: progressRes } = await supabase
      .from("user_progress")
      .select("assignment_id")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .in("assignment_id", assignmentIds);

    completedIds = (progressRes || []).map(p => p.assignment_id);
  }

  const total = assignments.length;
  const completed = completedIds.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const coverUrl = toStorageProxyUrl(material.cover_image_url);

  // Передаем всё в клиентский компонент!
  return (
    <MaterialClient 
      slug={slug}
      project={project}
      material={material}
      assignments={assignments}
      completedIds={completedIds}
      progressPct={progressPct}
      completedCount={completed}
      totalCount={total}
      coverUrl={coverUrl}
      hasAccess={hasAccess}
    />
  );
}