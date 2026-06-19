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

  // 🚀 ИСПРАВЛЕНИЕ: Данные профиля лежат в таблице profiles, а не users
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // 2. Получаем текущий проект
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_active) notFound();

  // 3. Собираем реальные табы, уровни и историю заявок этого юзера
  const [tabsRes, levelsRes, requestsRes] = await Promise.all([
    supabase.from("project_tabs").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("project_levels").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("purchase_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
  ]);

  const tabs = tabsRes.data || [];
  const tabIds = tabs.map(t => t.id);

  // 4. 🚀 ДИНАМИЧЕСКИЙ ПОДСЧЕТ ЦЕН: Грузим материалы этих табов
  const { data: materials } = await supabase
    .from("materials")
    .select("project_tab_id, price")
    .in("project_tab_id", tabIds)
    .eq("is_active", true);

  // Считаем общую стоимость каждого таба (сумма цен его материалов)
  const tabPrices: Record<string, number> = {};
  tabs.forEach(t => { tabPrices[t.id] = 0; });
  
  (materials || []).forEach(m => {
    if (m.project_tab_id) {
      tabPrices[m.project_tab_id] += (m.price || 0);
    }
  });

  // Обогащаем табы вычисленной ценой
  const enrichedTabs = tabs.map(t => ({
    ...t,
    price: tabPrices[t.id] || 0
  }));

  // Маппинг для легаси заявок (если там хранились названия, а не ID)
  const tabTitleToId = new Map<string, string>();
  enrichedTabs.forEach(t => tabTitleToId.set(t.title, t.id));

  // 5. Фильтруем заявки и обогащаем их вычисленной total_price
  const allRequests = requestsRes.data || [];
  const projectRequests = allRequests
    .filter(r => r.project_id === project.id || !r.project_id)
    .map(r => {
      // Собираем все запрошенные табы из заявки
      const rawTabs = r.material_kinds?.length ? r.material_kinds : (r.textbook_types || []);
      
      // Считаем общую цену для этой конкретной заявки
      const total_price = rawTabs.reduce((sum: number, tabIdentifier: string) => {
        const tabId = tabTitleToId.get(tabIdentifier) || tabIdentifier;
        return sum + (tabPrices[tabId] || 0);
      }, 0);

      return {
        ...r,
        total_price
      };
    });

  return (
    <RequestsClient
      project={project}
      levels={levelsRes.data || []}
      tabs={enrichedTabs}
      userId={user.id}
      userEmail={userProfile?.email || user.email || ""}
      userFullName={userProfile?.full_name || "Ученик"}
      initialRequests={projectRequests}
    />
  );
}