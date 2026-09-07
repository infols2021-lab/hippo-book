// app/(app)/projects/[slug]/requests/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { toStringArray } from "@/lib/materials/normalize";
import RequestsClient from "./RequestsClient";

export const revalidate = 0; // Всегда свежие данные

type RequestMaterialMeta = {
  id: string;
  title: string;
  price: number;
  material_kind?: string;
  tab_title?: string | null;
  project_id?: string | null;
  project_name?: string | null;
};

export default async function ProjectRequestsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // 1. Проверяем юзера
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Данные профиля
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // 2. Получаем текущий проект и все активные направления
  const [{ data: project }, { data: activeProjects }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug, is_active, theme, theme_color")
      .eq("slug", slug)
      .single(),
    supabase
      .from("projects")
      .select("id, name, slug, theme, theme_color")
      .eq("is_active", true)
      .order("order_index", { ascending: true }),
  ]);

  if (!project || !project.is_active) notFound();

  // 3. Собираем табы, уровни, историю заявок и реальные выданные доступы
  const [tabsRes, levelsRes, requestsRes, accessRes, grantsRes] = await Promise.all([
    supabase.from("project_tabs").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("project_levels").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("purchase_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("material_access").select("material_id").eq("user_id", user.id),
    supabase.from("purchase_request_grants").select("material_id, item_id").eq("user_id", user.id),
  ]);

  const tabs = tabsRes.data || [];
  const tabIds = tabs.map((t) => t.id);

  // Собираем все ID выданных материалов
  const ownedSet = new Set<string>();

  (accessRes.data || []).forEach((a) => {
    if (a.material_id) ownedSet.add(a.material_id);
  });

  (grantsRes.data || []).forEach((g) => {
    if (g.material_id) ownedSet.add(g.material_id);
    if (g.item_id) ownedSet.add(g.item_id);
  });

  // 3.1. Collect granted materials for notifications (processed requests)
  const grantedMaterialIds = Array.from(
    new Set<string>(
      [
        ...(grantsRes.data || []).map((g) => g.material_id),
        ...(accessRes.data || []).map((a) => a.material_id),
      ].filter(Boolean)
    )
  );

  let initialGrants: {
    materialId: string;
    materialTitle: string;
    tabTitle: string | null;
    tabSlug: string | null;
    projectId: string | null;
  }[] = [];

  if (grantedMaterialIds.length > 0) {
    const { data: grantedMats } = await supabase
      .from("materials")
      .select("id, title, project_tab_id")
      .in("id", grantedMaterialIds);

    const grantedTabIds = Array.from(
      new Set<string>((grantedMats || []).map((m) => m.project_tab_id).filter(Boolean))
    );

    const { data: grantedTabs } = grantedTabIds.length
      ? await supabase.from("project_tabs").select("id, title, slug, project_id").in("id", grantedTabIds)
      : { data: [] }

    const tabById = new Map((grantedTabs || []).map((t) => [t.id, t]));

    initialGrants = (grantedMats || []).map((m) => {
      const tab = m.project_tab_id ? tabById.get(m.project_tab_id) : undefined;
      return {
        materialId: String(m.id),
        materialTitle: String(m.title || "Материал"),
        tabTitle: tab?.title ?? null,
        tabSlug: tab?.slug ?? null,
        projectId: tab?.project_id ?? null,
      };
    });
  }

  // 4. ДИНАМИЧЕСКИЙ ПОДСЧЕТ ЦЕН ТАБОВ (для справочной информации)
  const { data: materials } = await supabase
    .from("materials")
    .select("project_tab_id, price")
    .in("project_tab_id", tabIds)
    .eq("is_active", true);

  const tabPrices: Record<string, number> = {};
  tabs.forEach((t) => {
    tabPrices[t.id] = 0;
  });

  (materials || []).forEach((m) => {
    if (m.project_tab_id) {
      tabPrices[m.project_tab_id] += m.price || 0;
    }
  });

  const enrichedTabs = tabs.map((t) => ({
    ...t,
    price: tabPrices[t.id] || 0,
  }));

  const tabTitleToId = new Map<string, string>();
  enrichedTabs.forEach((t) => tabTitleToId.set(t.title, t.id));

  // 4.1. Материалы из ВСЕХ заявок пользователя (все проекты) — чтобы в истории
  // корректно показывались реальные названия (включая roadmap), табы и цены.
  const allRequests = requestsRes.data || [];

  const allRequestMaterialIds = Array.from(
    new Set<string>(allRequests.flatMap((r) => toStringArray(r.material_ids)))
  );

  let requestMaterialsMap = new Map<string, RequestMaterialMeta>();

  if (allRequestMaterialIds.length > 0) {
    const [
      { data: fetchedRequestMats },
      { data: fetchedRequestTextbooks },
      { data: fetchedRequestCrosswords },
    ] = await Promise.all([
      supabase
        .from("materials")
        .select("id, title, price, material_kind, project_tabs(title, project_id)")
        .in("id", allRequestMaterialIds),
      supabase
        .from("textbooks")
        .select("id, title, price")
        .in("id", allRequestMaterialIds),
      supabase
        .from("crosswords")
        .select("id, title, price")
        .in("id", allRequestMaterialIds),
    ]);

    type MaterialTabEmbed = {
      title?: unknown;
      project_id?: unknown;
    } | null;

    function readMaterialTab(m: unknown): { tab: MaterialTabEmbed } {
      const projectTabs = (m as { project_tabs?: MaterialTabEmbed | MaterialTabEmbed[] })
        .project_tabs;
      const arr = Array.isArray(projectTabs) ? projectTabs : projectTabs ? [projectTabs] : [];
      return { tab: arr[0] ?? null };
    }

    const map = new Map<string, RequestMaterialMeta>();

    // Имена проектов, в которых лежат материалы заявок (их может быть несколько).
    const tabProjectIds = new Set<string>();
    for (const m of fetchedRequestMats || []) {
      const { tab } = readMaterialTab(m);
      const pid = tab?.project_id;
      if (pid) tabProjectIds.add(String(pid));
    }

    let projectNameRows: { id: string; name: string }[] | null = null;
    if (tabProjectIds.size > 0) {
      const res = await supabase
        .from("projects")
        .select("id, name")
        .in("id", Array.from(tabProjectIds));
      projectNameRows = (res.data || []) as { id: string; name: string }[];
    }
    const projectNameById = new Map<string, string>();
    for (const p of projectNameRows || []) projectNameById.set(String(p.id), String(p.name));

    for (const m of fetchedRequestMats || []) {
      const { tab } = readMaterialTab(m);
      const rawTabTitle = tab?.title ? String(tab.title) : "";
      const projectId = tab?.project_id ? String(tab.project_id) : null;
      map.set(String(m.id), {
        id: String(m.id),
        title: String(m.title || "Материал"),
        price: Number(m.price || 0),
        material_kind: m.material_kind ? String(m.material_kind) : "material",
        tab_title: rawTabTitle || null,
        project_id: projectId,
        project_name: projectId ? (projectNameById.get(projectId) ?? null) : null,
      });
    }

    for (const m of fetchedRequestTextbooks || []) {
      if (!map.has(String(m.id))) {
        map.set(String(m.id), {
          id: String(m.id),
          title: String(m.title || "Учебник"),
          price: Number(m.price || 0),
          material_kind: "textbook",
          tab_title: "Учебники",
        });
      }
    }

    for (const m of fetchedRequestCrosswords || []) {
      if (!map.has(String(m.id))) {
        map.set(String(m.id), {
          id: String(m.id),
          title: String(m.title || "Кроссворд"),
          price: Number(m.price || 0),
          material_kind: "crossword",
          tab_title: "Кроссворды",
        });
      }
    }

    requestMaterialsMap = map;
  }

  const initialRequestMaterials = Array.from(requestMaterialsMap.values());

  // 5. Сохраняем историческую стоимость заявок (все направления пользователя)
  const enrichedRequests = allRequests.map((r) => {
    if (typeof r.total_price === "number" && r.total_price > 0) {
      return r;
    }

    // Новая витрина: считаем цену по реальным material_ids —
    // материалы заявки могут относиться к разным проектам.
    const ids = toStringArray(r.material_ids);
    if (ids.length > 0) {
      const idsPrice = ids.reduce(
        (sum, id) => sum + (requestMaterialsMap.get(id)?.price || 0),
        0
      );
      if (idsPrice > 0) {
        return { ...r, total_price: idsPrice };
      }
    }

    const belongsToCurrentProject = !r.project_id || r.project_id === project.id;
    if (!belongsToCurrentProject) {
      return {
        ...r,
        total_price: typeof r.total_price === "number" ? r.total_price : 1000,
      };
    }

    const rawTabs = r.material_kinds?.length ? r.material_kinds : r.textbook_types || [];
    const calculatedPrice = rawTabs.reduce((sum: number, tabIdentifier: string) => {
      const tabId = tabTitleToId.get(tabIdentifier) || tabIdentifier;
      return sum + (tabPrices[tabId] || 0);
    }, 0);

    return {
      ...r,
      total_price: calculatedPrice > 0 ? calculatedPrice : 1000,
    };
  });

  return (
    <RequestsClient
      project={project}
      availableProjects={activeProjects || []}
      levels={levelsRes.data || []}
      tabs={enrichedTabs}
      userId={user.id}
      userEmail={userProfile?.email || user.email || ""}
      userFullName={userProfile?.full_name || "Ученик"}
      initialRequests={enrichedRequests}
      initialRequestMaterials={initialRequestMaterials}
      ownedMaterialIds={Array.from(ownedSet)}
      initialGrants={initialGrants}
    />
  );
}