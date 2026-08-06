import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const supabase = await createSupabaseServerClient();

  // 1. Получаем активные проекты
  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name, slug, theme_color, theme")
    .eq("is_active", true)
    .order("order_index", { ascending: true });

  const projects = projectsData || [];
  const projectIds = projects.map((p) => p.id);

  let tabs: any[] = [];
  let materials: any[] = [];

  if (projectIds.length > 0) {
    const [{ data: tabsData }, { data: matsData }] = await Promise.all([
      supabase
        .from("project_tabs")
        .select("id, project_id, title, icon")
        .in("project_id", projectIds)
        .order("order_index", { ascending: true }),
      supabase
        .from("materials")
        .select("id, project_id, project_tab_id, title, description, cover_image_url, price")
        .eq("is_active", true)
        .in("project_id", projectIds),
    ]);

    tabs = tabsData || [];
    materials = (matsData || []).map((m) => ({
      ...m,
      tab_id: m.project_tab_id,
    }));
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