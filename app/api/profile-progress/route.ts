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

    // Карта для быстрого поиска названий табов: id таба -> title таба
    const tabTitleMap = new Map<string, string>();

    // 2. Получаем материалы, привязанные к проекту (через табы)
    let materialsQuery = supabase
      .from("materials")
      .select("id, title, material_kind, is_available, is_demo, project_tab_id")
      .eq("is_active", true);

    if (projectId) {
      // 🚀 ИСПРАВЛЕНИЕ: Вытягиваем id вместе с title таба
      const { data: tabs, error: tabsError } = await supabase
        .from("project_tabs")
        .select("id, title")
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (tabsError) {
        throw new Error(tabsError.message);
      }

      const tabIds = tabs?.map((t: { id: string }) => t.id) || [];

      // Заполняем карту соответствия названий
      if (tabs) {
        tabs.forEach((t: { id: string; title: string }) => {
          if (t.id && t.title) {
            tabTitleMap.set(t.id, t.title);
          }
        });
      }

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

      // Демо-материалы — сквозные, поэтому в фильтр по табам конкретного проекта
      // их не включаем условием "или": добираем отдельным запросом ниже.
      materialsQuery = materialsQuery.in("project_tab_id", tabIds);
    }

    const [{ data: materials, error: matErr }, { data: demoMaterials, error: demoMatErr }] =
      await Promise.all([
        materialsQuery,
        // Демо-материалы должны попадать в прогресс независимо от того, в каком проекте/табе они созданы.
        supabase
          .from("materials")
          .select("id, title, material_kind, is_available, is_demo, project_tab_id")
          .eq("is_active", true)
          .eq("is_demo", true),
      ]);

    if (matErr) throw matErr;
    if (demoMatErr) throw demoMatErr;

    // Получаем реальные доступы пользователя к материалам
    const { data: accessData, error: accessErr } = await supabase
      .from("material_access")
      .select("material_id")
      .eq("user_id", user.id);

    if (accessErr) throw accessErr;

    const grantedMaterialIds = new Set(accessData?.map((a) => a.material_id) || []);

    // Объединяем обычные материалы проекта и сквозные демо-материалы, без дублей
    const materialsById = new Map<string, any>();
    for (const m of materials || []) materialsById.set(m.id, m);
    for (const m of demoMaterials || []) {
      if (!materialsById.has(m.id)) materialsById.set(m.id, m);
    }

    // Оставляем ТОЛЬКО те материалы, которые публичны (is_available), демо (is_demo)
    // или выданы пользователю
    const accessibleMaterials = Array.from(materialsById.values()).filter(
      (m) => m.is_available || m.is_demo || grantedMaterialIds.has(m.id)
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

        // Считаем задания с учетом старой и новой архитектуры
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id")
          .or(`material_id.eq.${m.id},textbook_id.eq.${m.id},crossword_id.eq.${m.id}`);

        const total = assignments?.length ?? 0;
        const completed = (assignments || [])
          .filter((a) => completedSet.has(a.id))
          .length;

        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Определяем тип материала
        const kind = m.material_kind === "crossword" ? "crossword" : "textbook";

        // Строим корректную ссылку на страницу материала
        const href = projectSlug
          ? `/projects/${projectSlug}/materials/${m.id}`
          : `/materials/${m.id}`;

        // 🚀 НАХОДИМ НАЗВАНИЕ ТАБА ИЗ НАШЕЙ КАРТЫ
        const tabTitle = m.project_tab_id ? tabTitleMap.get(m.project_tab_id) : undefined;

        return {
          kind,
          id: m.id,
          title: m.title,
          total,
          completed,
          progressPercent,
          href,
          tabTitle, // Отправляем название таба (например: "что то") на фронтенд
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