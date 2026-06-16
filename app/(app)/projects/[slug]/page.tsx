import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

// Отключаем кэширование страницы
export const revalidate = 0;

export default async function ProjectLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // Проверяем существование проекта и его статус
  const { data: project } = await supabase
    .from("projects")
    .select("id, is_active")
    .eq("slug", slug)
    .single();

  // Если проекта нет или он скрыт - показываем 404 прямо здесь
  if (!project || project.is_active === false) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-7xl mb-6 drop-shadow-sm">🏜️</div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Ветка не найдена</h1>
        <p className="text-lg text-gray-500 max-w-md mb-8 leading-relaxed">
          Кажется, вы перешли по неверной ссылке, или администратор временно скрыл этот раздел.
        </p>
        <Link 
          href="/portal"
          className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          Вернуться на портал
        </Link>
      </div>
    );
  }

  // Проект найден и активен -> мгновенный редирект в профиль (он теперь лицо проекта)
  redirect(`/projects/${slug}/profile`);
}