import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Отключаем кэширование, чтобы статусы веток проверялись мгновенно
export const revalidate = 0; 

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>; // Next.js 15 async params
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // 1. Получаем конфиг ветки
  const { data: project } = await supabase
    .from("projects")
    .select("id, is_active, theme")
    .eq("slug", slug)
    .single();

  // Проверяем, существует ли проект и активен ли он
  if (!project || project.is_active === false) {
    notFound();
  }

  // 2. Читаем тему (с обратной совместимостью для старого и нового форматов)
  const theme = project.theme || {};
  const primaryColor = theme?.colors?.primary || theme.primaryColor || theme.theme_color || "#3b82f6";
  const secondaryColor = theme?.colors?.secondary || theme.secondaryColor || "#1d4ed8";
  const bgColor = theme?.colors?.pageBg || theme.backgroundColor || "#f8fafc";

  return (
    <div
      // 🚀 Инжектим цвета из БД прямо в CSS-переменные этого DOM-дерева!
      // Теперь ProfileClient и MaterialsClient могут использовать var(--project-primary)
      style={{
        "--project-primary": primaryColor,
        "--project-secondary": secondaryColor,
        "--project-bg": bgColor,
        backgroundColor: "var(--project-bg)",
      } as React.CSSProperties}
      className="min-h-screen w-full transition-colors duration-500"
    >
      {/* Здесь больше нет белой шапки-навигации. 
        Дочерние страницы (Профиль и Материалы) сами рендерят свой идеальный UI.
      */}
      {children}
    </div>
  );
}