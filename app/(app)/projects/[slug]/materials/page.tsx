import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const revalidate = 0; // Отключаем кэш для актуальных данных

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; level?: string }>;
};

export default async function ProjectMaterialsPage({ params, searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  const { tab: activeTabSlug, level: activeLevelCode } = await searchParams;

  // 1. Получаем проект
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, is_available")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_available) notFound();

  // 2. Получаем табы и уровни для фильтров
  const [tabsRes, levelsRes] = await Promise.all([
    supabase.from("project_tabs").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("project_levels").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index")
  ]);

  const tabs = tabsRes.data || [];
  const levels = levelsRes.data || [];

  // Если таб не выбран, но табы есть — редиректим на первый доступный
  if (!activeTabSlug && tabs.length > 0) {
    redirect(`/projects/${slug}/materials?tab=${tabs[0].slug}${activeLevelCode ? `&level=${activeLevelCode}` : ''}`);
  }

  // 3. Собираем материалы (ИСПРАВЛЕНО: title вместо name у табов)
  let query = supabase
    .from("materials")
    .select(`*, project_tabs!inner(slug, icon, title)`) 
    .eq("project_id", project.id)
    .eq("is_active", true)
    .order("order_index", { ascending: false });

  if (activeTabSlug) {
    query = query.eq("project_tabs.slug", activeTabSlug);
  }
  if (activeLevelCode) {
    query = query.contains("target_levels", [activeLevelCode]);
  }

  const { data: materials } = await query;
  const activeTab = tabs.find(t => t.slug === activeTabSlug);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ШАПКА ФИЛЬТРОВ */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        
        {/* Фильтр по табам */}
        {tabs.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Раздел материалов</h3>
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const isActive = tab.slug === activeTabSlug;
                return (
                  <Link
                    key={tab.id}
                    href={`/projects/${slug}/materials?tab=${tab.slug}${activeLevelCode ? `&level=${activeLevelCode}` : ''}`}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                      isActive ? 'text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                    style={isActive ? { backgroundColor: "var(--project-primary)" } : {}}
                  >
                    {/* ИСПРАВЛЕНО: tab.title вместо tab.name */}
                    <span>{tab.icon || ""}</span> {tab.title}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Фильтр по уровням */}
        {levels.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Уровень сложности / Класс</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${slug}/materials?tab=${activeTabSlug || ''}`}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  !activeLevelCode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Все уровни
              </Link>
              {levels.map(lvl => {
                // ИСПРАВЛЕНО: lvl.code вместо lvl.level_code
                const isActive = lvl.code === activeLevelCode;
                return (
                  <Link
                    key={lvl.id}
                    href={`/projects/${slug}/materials?tab=${activeTabSlug || ''}&level=${lvl.code}`}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={isActive ? { backgroundColor: "var(--project-secondary)" } : {}}
                  >
                    {/* ИСПРАВЛЕНО: lvl.label вместо lvl.name */}
                    {lvl.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ЗАГОЛОВОК АКТИВНОГО ТАБА */}
      {activeTab && (
        <div className="flex items-center gap-3">
          <div className="text-3xl">{activeTab.icon || ""}</div>
          {/* ИСПРАВЛЕНО: activeTab.title вместо activeTab.name */}
          <h2 className="text-2xl font-extrabold text-gray-900">{activeTab.title}</h2>
          <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full ml-2">
            {materials?.length || 0} шт.
          </span>
        </div>
      )}

      {/* СЕТКА МАТЕРИАЛОВ */}
      {materials && materials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {materials.map(mat => (
            <Link key={mat.id} href={`/projects/${slug}/assignment/${mat.id}`}>
              <div className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all group flex flex-col h-full relative overflow-hidden cursor-pointer">
                <div className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "var(--project-primary)" }} />
                
                {/* Обложка материала, если она есть */}
                {mat.cover_image_url && (
                  <img src={mat.cover_image_url} alt={mat.title} className="w-full h-32 object-cover rounded-xl mb-4 border border-gray-100" />
                )}

                <h4 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {mat.title}
                </h4>
                
                <p className="text-sm text-gray-500 mb-5 flex-grow line-clamp-2">
                  {mat.description || "Нажмите, чтобы открыть и начать выполнение задания."}
                </p>
                
                <div className="flex justify-between items-end mt-auto pt-4 border-t border-gray-50">
                  <div className="flex flex-wrap gap-1">
                    {mat.target_levels?.map((l: string) => (
                      <span key={l} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">
                        {/* ИСПРАВЛЕНО: level.code и level.label */}
                        {levels.find(level => level.code === l)?.label || l}
                      </span>
                    ))}
                  </div>
                  <div className="font-bold text-sm" style={{ color: "var(--project-primary)" }}>
                    Открыть →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-200">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-gray-900">Материалы не найдены</h3>
          <p className="text-gray-500 mt-2">
            Для выбранных фильтров пока нет заданий. Попробуйте выбрать другой уровень или раздел.
          </p>
          {(activeTabSlug || activeLevelCode) && (
            <Link href={`/projects/${slug}/materials`} className="mt-6 inline-block bg-gray-100 text-gray-700 font-bold px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors">
              Сбросить фильтры
            </Link>
          )}
        </div>
      )}
    </div>
  );
}