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
    let projectId: string | null = null;
    let tabs: any[] = [];
    // Карта для быстрого поиска названий табов: id таба -> title таба
    const tabTitleMap = new Map<string, string>();

    // 1. Найдём ID проекта по slug (если передан)
    if (projectSlug) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", projectSlug)
        .single();

      if (projectError) {
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
      .select("id, title, material_kind, is_available, is_demo, project_tab_id")
      .eq("is_active", true);

    if (projectId) {
      const { data: t, error: tabsError } = await supabase
        .from("project_tabs")
        .select("id, title")
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (tabsError) throw new Error(tabsError.message);
      
      tabs = t || [];
      const tabIds = tabs.map((x: { id: string }) => x.id);
      
      // Заполняем карту соответствия названий
      tabs.forEach((x: { id: string; title: string }) => {
        if (x.id && x.title) tabTitleMap.set(x.id, x.title);
      });

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

    // 4. Сначала собираем УНИКАЛЬНЫЙ прогресс для правильной математики
    const uniqueProgress = await Promise.all(
      accessibleMaterials.map(async (m) => {
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id")
          .or(`material_id.eq.${m.id},textbook_id.eq.${m.id},crossword_id.eq.${m.id}`);

        const total = assignments?.length ?? 0;
        const completed = (assignments || [])
          .filter((a) => completedSet.has(a.id))
          .length;

        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { m, total, completed, progressPercent };
      })
    );

    // 5. Считаем статистику ДО клонирования демо-материалов, чтобы избежать накрутки счетчиков
    const totalMaterials = uniqueProgress.length;
    const completedMaterials = uniqueProgress.filter(
      (p) => p.total > 0 && p.completed === p.total
    ).length;

    const totalAvailableAssignments = uniqueProgress.reduce(
      (acc, p) => acc + p.total,
      0
    );
    const completedAvailableAssignments = uniqueProgress.reduce(
      (acc, p) => acc + p.completed,
      0
    );

    const successRate =
      totalAvailableAssignments > 0
        ? Math.round((completedAvailableAssignments / totalAvailableAssignments) * 100)
        : 0;

    const stats = {
      totalMaterials,
      completedMaterials,
      totalAvailableAssignments,
      completedAvailableAssignments,
      successRate,
    };

    // 6. Формируем финальный массив для фронтенда с клонированием демок во все табы проекта
    const materialsProgress: any[] = [];
    
    for (const { m, total, completed, progressPercent } of uniqueProgress) {
      const kind = m.material_kind === "crossword" ? "crossword" : "textbook";
      const href = projectSlug
        ? `/projects/${projectSlug}/materials/${m.id}`
        : `/materials/${m.id}`;

      if (m.is_demo && tabs.length > 0) {
        // Если это демо, раскидываем его по всем табам ТЕКУЩЕГО проекта
        for (const t of tabs) {
          materialsProgress.push({
            kind,
            id: `${m.id}-${t.id}`, // Уникальный ключ для React
            title: m.title,
            total,
            completed,
            progressPercent,
            href,
            tabTitle: t.title, // Принудительно присваиваем имя таба из текущего проекта
          });
        }
      } else {
        // Обычные материалы кладутся в свой родной таб
        const tabTitle = m.project_tab_id ? tabTitleMap.get(m.project_tab_id) : undefined;
        materialsProgress.push({
          kind,
          id: m.id,
          title: m.title,
          total,
          completed,
          progressPercent,
          href,
          tabTitle,
        });
      }
    }

    return ok({ stats, materialsProgress });
  } catch (error: any) {
    console.error("🔴 [API PROFILE PROGRESS] Ошибка:", error);
    return fail(error?.message || "Server error", 500, "DB_ERROR");
  }
}