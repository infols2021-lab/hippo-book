import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GatehouseMaterialClient, {
  type GatehouseAssignmentPreview,
  type GatehouseMaterialPageData,
} from "../GatehouseMaterialClient";

// Отключаем кеширование страницы, чтобы всегда показывать актуальные данные
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MaybePromise<T> = T | Promise<T>;

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const score = Number(value);
  if (!Number.isFinite(score)) return null;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeMaterial(row: any): GatehouseMaterialPageData["material"] {
  return {
    id: String(row?.id ?? ""),
    branch_type: "gatehouse",
    material_kind: String(row?.material_kind ?? "mock_test"),
    title: String(row?.title ?? "Пробный тест"),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: Boolean(row?.is_active ?? true),
    is_available: Boolean(row?.is_available ?? false),
    order_index: Number(row?.order_index ?? 0),
    class_levels: normalizeArray(row?.class_levels),
    target_levels: normalizeArray(row?.target_levels),
    legacy_source_table:
      row?.legacy_source_table === "textbooks" || row?.legacy_source_table === "crosswords"
        ? row.legacy_source_table
        : null,
    legacy_source_id: typeof row?.legacy_source_id === "string" ? row.legacy_source_id : null,
    created_by: typeof row?.created_by === "string" ? row.created_by : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
  };
}

export default async function GatehouseMaterialByIdPage({
  params,
}: {
  params: MaybePromise<{ id: string }>;
}) {
  const { id } = await params;
  const materialId = String(id ?? "").trim();

  if (!materialId) {
    redirect("/gatehouse/materials");
  }

  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/login");
  }

  const { data: materialRow, error: materialError } = await supabase
    .from("materials")
    .select("*")
    .eq("id", materialId)
    .eq("branch_type", "gatehouse")
    .eq("material_kind", "mock_test")
    .eq("is_active", true)
    .single();

  if (materialError || !materialRow) {
    return (
      <GatehouseMaterialClient
        initialData={null}
        initialError={materialError?.message || "Материал не найден"}
      />
    );
  }

  const material = normalizeMaterial(materialRow);

  const [{ data: accessRow }, { data: assignmentsRows, error: assignmentsError }, { data: progressRows, error: progressError }] =
    await Promise.all([
      supabase
        .from("material_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", material.id)
        .maybeSingle(),

      supabase
        .from("assignments")
        // === ИСПРАВЛЕНИЕ: Добавили assignment_type в select ===
        .select("id, title, order_index, content, assignment_type, created_at")
        .eq("material_id", material.id)
        .eq("branch_type", "gatehouse")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("user_progress")
        .select("assignment_id, is_completed, score, completed_at")
        .eq("user_id", user.id),
    ]);

  const hasAccess = Boolean(material.is_available || accessRow);

  // Сортировка записей прогресса: завершённые идут первыми (свежие сверху),
  // чтобы в Map попала последняя запись – самая свежая завершённая
  const rawProgress = Array.isArray(progressRows) ? progressRows : [];
  const sortedProgress = [...rawProgress].sort((a, b) => {
    const aCompleted = Boolean(a.is_completed) && !!a.completed_at;
    const bCompleted = Boolean(b.is_completed) && !!b.completed_at;

    // Завершённые записи всегда выше незавершённых
    if (aCompleted && !bCompleted) return -1;
    if (!aCompleted && bCompleted) return 1;

    // Если обе завершены или обе не завершены – по дате (свежие выше)
    const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bTime - aTime;
  });

  const progressByAssignment = new Map(
    sortedProgress.map((item: any) => [
      String(item?.assignment_id ?? ""),
      {
        is_completed: Boolean(item?.is_completed),
        score: normalizeScore(item?.score),
        completed_at: typeof item?.completed_at === "string" ? item.completed_at : null,
      },
    ])
  );

  const assignments: GatehouseAssignmentPreview[] = Array.isArray(assignmentsRows)
    ? assignmentsRows.map((assignment: any) => {
        const progress = progressByAssignment.get(String(assignment?.id ?? ""));
        const questions = Array.isArray(assignment?.content?.questions) ? assignment.content.questions : [];

        return {
          id: String(assignment?.id ?? ""),
          title: String(assignment?.title ?? "Задание"),
          order_index: Number(assignment?.order_index ?? 0),
          questionsCount: questions.length,
          isCompleted: Boolean(progress?.is_completed),
          score: progress?.score ?? null,
          completedAt: progress?.completed_at ?? null,
          assignment_type: assignment?.assignment_type ?? "test", // === ИСПРАВЛЕНИЕ: Передаем тип на клиент ===
          content: assignment?.content ?? {}, // === ИСПРАВЛЕНИЕ: Передаем контент для клиентских проверок ===
        };
      })
    : [];

  const completedAssignments = assignments.filter((assignment) => assignment.isCompleted).length;
  const totalAssignments = assignments.length;
  const progress = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  const data: GatehouseMaterialPageData = {
    material,
    assignments,
    hasAccess,
    progress,
    completedAssignments,
    totalAssignments,
  };

  const error = assignmentsError?.message || progressError?.message || null;

  return <GatehouseMaterialClient initialData={data} initialError={error} />;
}