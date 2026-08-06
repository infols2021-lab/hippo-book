/* app/info/pricing/page.tsx */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PricingClient from "./PricingClient";

export const revalidate = 0;

function lastDayOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 12, 0, 0));
}

function formatRuDate(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export const metadata = {
  title: "Каталог и Прайс | skilLS",
  description: "Цены на учебники и кроссворды, правила покупки, выдача после проверки оплаты.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string; sourceId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const stamp = lastDayOfCurrentMonthUTC();

  // 1. Получаем все активные проекты
  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name, slug, theme_color, theme")
    .eq("is_active", true)
    .order("order_index", { ascending: true });

  // 2. Получаем табы
  const { data: tabsData } = await supabase
    .from("tabs")
    .select("id, project_id, title, icon")
    .order("order_index", { ascending: true });

  // 3. Получаем материалы (привязаны к проектам и табам)
  const { data: materialsData } = await supabase
    .from("materials")
    .select("id, project_id, tab_id, title, cover_image_url, price")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const projects = projectsData || [];
  const tabs = tabsData || [];
  const materials = materialsData || [];

  // Фоллбэк на случай пустой базы (чтобы не падало)
  if (projects.length === 0) {
    projects.push(
      { id: "legacy_olympiad", name: "Олимпиада", slug: "olympiad", theme_color: "#0ea5e9", theme: null },
      { id: "legacy_exams", name: "Экзамены", slug: "exams", theme_color: "#8b5cf6", theme: null }
    );
  }

  return (
    <PricingClient 
      projects={projects}
      tabs={tabs}
      materials={materials}
      lastUpdateDate={formatRuDate(stamp)}
      source={sp.source}
      sourceId={sp.sourceId}
    />
  );
}