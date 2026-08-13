// app/(app)/projects/[slug]/requests/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import RequestsClient from "./RequestsClient";

export const revalidate = 0; // Всегда свежие данные

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

  // 5. Сохраняем историческую стоимость заявок (все направления пользователя)
  const allRequests = requestsRes.data || [];
  const enrichedRequests = allRequests.map((r) => {
    if (typeof r.total_price === "number" && r.total_price > 0) {
      return r;
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
      ownedMaterialIds={Array.from(ownedSet)}
    />
  );
}