import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ProjectLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // Берем проект (используем правильное поле is_active)
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, is_active")
    .eq("slug", slug)
    .single();

  // Если проекта нет или он скрыт - показываем 404 прямо здесь
  // Файл not-found.tsx больше не нужен!
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

  // Берем табы для этого проекта
  const { data: tabs } = await supabase
    .from("project_tabs")
    .select("*")
    .eq("project_id", project.id)
    .eq("is_active", true)
    .order("order_index");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* HERO БЛОК (Использует CSS переменную для цвета) */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: "var(--project-primary)" }} />
        <h2 className="text-3xl font-extrabold text-gray-900 mb-3">{project.name}</h2>
        <p className="text-gray-600 max-w-2xl text-lg leading-relaxed">
          {project.description || "Добро пожаловать в эту ветку! Здесь собраны все необходимые материалы и задания для вашей подготовки."}
        </p>
      </div>

      {/* ДИНАМИЧЕСКИЕ ТАБЫ */}
      <div>
        <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          📚 Доступные разделы
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tabs?.map((tab) => (
            <Link key={tab.id} href={`/projects/${slug}/materials?tab=${tab.slug}`}>
              <div 
                className="bg-white rounded-2xl p-6 border shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden"
              >
                {/* Эффект наведения с цветом проекта */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity" 
                  style={{ backgroundColor: "var(--project-primary)" }}
                />
                
                <div className="text-5xl mb-5 group-hover:scale-110 transition-transform origin-left drop-shadow-sm">
                  {tab.icon || "📄"}
                </div>
                {/* Используем правильное поле title */}
                <h4 className="text-xl font-bold text-gray-900 mb-2">{tab.title}</h4>
                <div 
                  className="font-semibold text-sm flex items-center gap-1.5"
                  style={{ color: "var(--project-primary)" }}
                >
                  Перейти к материалам 
                  <span className="group-hover:translate-x-1.5 transition-transform">→</span>
                </div>
              </div>
            </Link>
          ))}

          {(!tabs || tabs.length === 0) && (
            <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-lg font-medium text-gray-700">В этой ветке пока нет разделов</p>
              <p className="text-sm">Администратор еще не добавил сюда материалы.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}