import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProjectLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // Берем проект
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description")
    .eq("slug", slug)
    .single();

  if (!project) notFound();

  // Берем табы для этого проекта
  const { data: tabs } = await supabase
    .from("project_tabs")
    .select("*")
    .eq("project_id", project.id)
    .eq("is_active", true)
    .order("order_index");

  return (
    <div className="space-y-8">
      {/* HERO БЛОК (Использует CSS переменную) */}
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
                <h4 className="text-xl font-bold text-gray-900 mb-2">{tab.name}</h4>
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