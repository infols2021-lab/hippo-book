import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

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
    .select("id, name, slug, is_available, theme")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_available) {
    notFound(); // Если проекта нет или он скрыт админом -> 404
  }

  // 2. Читаем тему (с обратной совместимостью для старого и нового форматов)
  const theme = project.theme || {};
  const primaryColor = theme?.colors?.primary || theme.primaryColor || theme.theme_color || "#3b82f6";
  const secondaryColor = theme?.colors?.secondary || theme.secondaryColor || "#1d4ed8";
  const bgColor = theme?.colors?.pageBg || theme.backgroundColor || "#f8fafc";

  return (
    <div
      // 🚀 Инжектим цвета из БД прямо в CSS-переменные этого DOM-дерева!
      style={{
        "--project-primary": primaryColor,
        "--project-secondary": secondaryColor,
        "--project-bg": bgColor,
      } as React.CSSProperties}
      className="min-h-screen bg-[var(--project-bg)] transition-colors duration-500"
    >
      {/* ЛОКАЛЬНАЯ ШАПКА ВЕТКИ */}
      <nav className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/portal" 
              className="text-gray-400 hover:text-gray-800 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-lg"
              title="Вернуться в Портал"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <Link href={`/projects/${slug}`}>
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "var(--project-primary)" }}>
                {project.name}
              </h1>
            </Link>
          </div>
          
          <div className="flex gap-1 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            <Link 
              href={`/projects/${slug}`} 
              className="px-4 py-2 font-medium text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Главная
            </Link>
            <Link 
              href={`/projects/${slug}/requests`} 
              className="px-4 py-2 font-medium text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Мои доступы
            </Link>
            <Link 
              href={`/projects/${slug}/profile`} 
              className="px-4 py-2 font-bold text-sm rounded-lg transition-all whitespace-nowrap"
              style={{ backgroundColor: "var(--project-primary)", color: "#fff", opacity: 0.9 }}
            >
              Профиль ветки
            </Link>
          </div>
        </div>
      </nav>

      {/* ОСНОВНОЙ КОНТЕНТ ВЕТКИ */}
      <main className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>
    </div>
  );
}