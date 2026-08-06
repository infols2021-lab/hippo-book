import { createClient } from "@supabase/supabase-js";
import PricingClient from "./PricingClient";

type SP = { source?: string; sourceId?: string };

function lastDayOfCurrentMonthUTC(): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0, 12, 0, 0));
}

function formatRuDate(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export const metadata = {
  title: "Каталог материалов и прайс",
  description: "Доступные учебники, кроссворды и тестирования по направлениям.",
};

export const revalidate = 0;

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};

  // Админский клиент Supabase для безошибочного получения публичного каталога на сервере
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Активные проекты
  const { data: projectsData } = await supabaseAdmin
    .from("projects")
    .select("id, name, slug, theme_color, theme")
    .eq("is_active", true)
    .order("order_index", { ascending: true });

  const projects = projectsData || [];
  const projectIds = projects.map((p) => p.id);

  let tabs: any[] = [];
  let materials: any[] = [];

  if (projectIds.length > 0) {
    // 2. Активные табы
    const { data: tabsData } = await supabaseAdmin
      .from("project_tabs")
      .select("id, project_id, title, icon")
      .in("project_id", projectIds)
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    tabs = tabsData || [];
    const tabIds = tabs.map((t) => t.id);

    if (tabIds.length > 0) {
      // 3. Активные материалы по project_tab_id
      const { data: matsData } = await supabaseAdmin
        .from("materials")
        .select("id, project_tab_id, title, description, cover_image_url, price, is_active, is_secret")
        .eq("is_active", true)
        .in("project_tab_id", tabIds);

      const tabToProjectMap = new Map<string, string>();
      tabs.forEach((t) => tabToProjectMap.set(t.id, t.project_id));

      materials = (matsData || [])
        .filter((m: any) => !m.is_secret)
        .map((m: any) => ({
          ...m,
          project_id: tabToProjectMap.get(m.project_tab_id) || null,
          tab_id: m.project_tab_id,
        }));
    }
  }

  const stamp = formatRuDate(lastDayOfCurrentMonthUTC());

  return (
    <PricingClient
      projects={projects}
      tabs={tabs}
      materials={materials}
      lastUpdateDate={stamp}
      source={sp.source}
      sourceId={sp.sourceId}
    />
  );
}