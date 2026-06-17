// app/api/profile-progress/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  // Получаем slug из URL, если нужно фильтровать по проекту
  const url = new URL(req.url);
  const projectSlug = url.searchParams.get("slug");

  try {
    // 1. Найдём ID проекта по slug (если передан)
    let projectId: string | null = null;
    if (projectSlug) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", projectSlug)
        .single();

      if (projectError) {
        // Если проект не найден, возвращаем пустой результат, а не ошибку
        return ok({
          stats: {
            totalMaterials: 0,
            completedMaterials: 0,
            totalAvailableAssignments: 0,
            completedAvailableAssignments: 0,
            successRate: 0,
          },
          materialsProgress: [],
        });
      }
      projectId = project?.id ?? null;
    }

    // 2. Получаем материалы, привязанные к проекту (через табы)
    let materialsQuery = supabase
      .from("materials")
      .select("id, title, material_kind, is_available, project_tab_id")
      .eq("is_active", true);

    if (projectId) {
      // Сначала получим все табы этого проекта
      const { data: tabs, error: tabsError } = await supabase
        .from("project_tabs")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (tabsError) {
        throw new Error(tabsError.message);
      }

      const tabIds = tabs?.map((t: { id: string }) => t.id) || [];
      if (tabIds.length === 0) {
        return ok({
          stats: {
            totalMaterials: 0,
            completedMaterials: 0,
            totalAvailableAssignments: 0,
            completedAvailableAssignments: 0,
            successRate: 0,
          },
          materialsProgress: [],
        });
      }

      materialsQuery = materialsQuery.in("project_tab_id", tabIds);
    }

    const { data: materials, error: matErr } = await materialsQuery;
    if (matErr) throw matErr;

    // ❗️ 2.5 ИСПРАВЛЕНИЕ: Получаем реальные доступы пользователя к материалам
    const { data: accessData, error: accessErr } = await supabase
      .from("material_access")
      .select("material_id")
      .eq("user_id", user.id);

    if (accessErr) throw accessErr;

    const grantedMaterialIds = new Set(accessData?.map((a) => a.material_id) || []);

    // ❗️ Оставляем ТОЛЬКО те материалы, которые публичны (is_available) или выданы пользователю
    const accessibleMaterials = (materials || []).filter(
      (m) => m.is_available || grantedMaterialIds.has(m.id)
    );

    // 3. Получаем прогресс пользователя по всем заданиям
    const { data: userProgress, error: progErr } = await supabase
      .from("user_progress")
      .select("assignment_id, is_completed")
      .eq("user_id", user.id);
    if (progErr) throw progErr;

    const completedSet = new Set(
      (userProgress || [])
        .filter((p) => p.is_completed)
        .map((p) => p.assignment_id)
    );

    // 4. Для каждого ДОСТУПНОГО материала получаем список заданий и считаем прогресс
    const materialsProgress = await Promise.all(
      accessibleMaterials.map(async (m) => {
        
        // ❗️ ИСПРАВЛЕНИЕ: Считаем задания с учетом старой и новой архитектуры (textbook_id / crossword_id / material_id)
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id")
          .or(`material_id.eq.${m.id},textbook_id.eq.${m.id},crossword_id.eq.${m.id}`);

        const total = assignments?.length ?? 0;
        const completed = (assignments || [])
          .filter((a) => completedSet.has(a.id))
          .length;

        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Определяем тип материала (для иконки в UI)
        const kind = m.material_kind === "crossword" ? "crossword" : "textbook";

        // Строим корректную ссылку на страницу материала
        const href = projectSlug
          ? `/projects/${projectSlug}/materials/${m.id}`
          : `/materials/${m.id}`; // fallback для старых ссылок

        return {
          kind,
          id: m.id,
          title: m.title,
          total,
          completed,
          progressPercent,
          href,
        };
      })
    );

    // 5. Общая статистика (строим только по доступным материалам)
    const totalMaterials = accessibleMaterials.length;
    const completedMaterials = materialsProgress.filter(
      (m) => m.total > 0 && m.completed === m.total
    ).length;

    const totalAvailableAssignments = materialsProgress.reduce(
      (acc, m) => acc + m.total,
      0
    );
    const completedAvailableAssignments = materialsProgress.reduce(
      (acc, m) => acc + m.completed,
      0
    );

    const successRate =
      totalAvailableAssignments > 0
        ? Math.round(
            (completedAvailableAssignments / totalAvailableAssignments) * 100
          )
        : 0;

    const stats = {
      totalMaterials,
      completedMaterials,
      totalAvailableAssignments,
      completedAvailableAssignments,
      successRate,
    };

    return ok({ stats, materialsProgress });
  } catch (error: any) {
    console.error("🔴 [API PROFILE PROGRESS] Ошибка:", error);
    return fail(error?.message || "Server error", 500, "DB_ERROR");
  }
}