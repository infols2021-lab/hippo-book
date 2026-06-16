import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

export const revalidate = 0; // Отключаем кэш для моментального обновления прогресса

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; level?: string }>;
};

// Хелпер для получения правильных ссылок на картинки
function toStorageProxyUrl(raw: unknown) {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";

  if (value.startsWith("/api/storage/public/")) return value;
  if (value.startsWith("data:")) return value;

  const marker = "/storage/v1/object/public/";
  const idx = value.indexOf(marker);

  if (idx === -1) return value;

  const restWithQuery = value.slice(idx + marker.length);
  const cleanRest = restWithQuery.split("?")[0]?.split("#")[0] ?? "";
  const parts = cleanRest.split("/").filter(Boolean);

  const bucket = parts.shift();
  const path = parts.join("/");

  if (!bucket || !path) return value;

  return getStoragePublicUrl(bucket, path);
}

export default async function ProjectMaterialsPage({ params, searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  const { tab: activeTabSlug, level: activeLevelCode } = await searchParams;

  // 1. Проверяем авторизацию пользователя
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Получаем ядро проекта (ИСПРАВЛЕНО: проверяем is_active вместо is_available)
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, is_active, theme")
    .eq("slug", slug)
    .single();

  if (!project || project.is_active === false) notFound();

  // 3. Получаем табы и уровни для фильтров
  const [tabsRes, levelsRes] = await Promise.all([
    supabase.from("project_tabs").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("project_levels").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index")
  ]);

  const tabs = tabsRes.data || [];
  const levels = levelsRes.data || [];

  // Если таб не выбран, но табы есть — делаем мягкий редирект на первый доступный
  if (!activeTabSlug && tabs.length > 0) {
    redirect(`/projects/${slug}/materials?tab=${tabs[0].slug}${activeLevelCode ? `&level=${activeLevelCode}` : ''}`);
  }

  const activeTab = tabs.find(t => t.slug === activeTabSlug);

  // 4. Формируем запрос на материалы
  let materialsQuery = supabase
    .from("materials")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: false });

  // Фильтр по табам (через ID)
  if (activeTab) {
    materialsQuery = materialsQuery.eq("project_tab_id", activeTab.id);
  } else {
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length > 0) {
      materialsQuery = materialsQuery.in("project_tab_id", tabIds);
    } else {
      materialsQuery = materialsQuery.eq("project_tab_id", "00000000-0000-0000-0000-000000000000"); // Заглушка, если табов нет
    }
  }

  // Фильтр по уровням
  if (activeLevelCode) {
    materialsQuery = materialsQuery.contains("target_levels", [activeLevelCode]);
  }

  const { data: materialsData } = await materialsQuery;
  const materials = materialsData || [];
  const materialIds = materials.map(m => m.id);

  // 5. Запрашиваем доступы и прогресс пользователя одним махом
  let grantedMaterialIds = new Set<string>();
  let completedSet = new Set<string>();
  let assignments: any[] = [];

  if (materialIds.length > 0) {
    const idsString = materialIds.join(',');

    const [accessRes, assignmentsRes] = await Promise.all([
      supabase.from("material_access").select("material_id").eq("user_id", user.id).in("material_id", materialIds),
      // or() нужен для совместимости новых материалов и старых легаси учебников/кроссвордов
      supabase.from("assignments").select("id, material_id, textbook_id, crossword_id").or(`material_id.in.(${idsString}),textbook_id.in.(${idsString}),crossword_id.in.(${idsString})`)
    ]);

    grantedMaterialIds = new Set((accessRes.data || []).map(a => a.material_id));
    assignments = assignmentsRes.data || [];
    const assignmentIds = assignments.map(a => a.id);

    if (assignmentIds.length > 0) {
      const { data: progressRes } = await supabase
        .from("user_progress")
        .select("assignment_id")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .in("assignment_id", assignmentIds);
        
      completedSet = new Set((progressRes || []).map(p => p.assignment_id));
    }
  }

  // 6. Разбиваем материалы на доступные и закрытые
  const availableMats = [];
  const lockedMats = [];

  for (const m of materials) {
    if (m.is_available || grantedMaterialIds.has(m.id)) {
      availableMats.push(m);
    } else {
      lockedMats.push(m);
    }
  }

  // Хелпер расчета прогресса конкретного материала
  function getProgress(matId: string) {
    const related = assignments.filter(a => a.material_id === matId || a.textbook_id === matId || a.crossword_id === matId);
    const total = related.length;
    let completed = 0;
    for (const a of related) {
      if (completedSet.has(a.id)) completed++;
    }
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress };
  }

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* 1. ШАПКА ФИЛЬТРОВ И НАВИГАЦИИ */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-gray-50 to-transparent rounded-bl-full -z-10" />
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10 border-b border-gray-100 pb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Учебные материалы</h2>
            <p className="text-gray-500 font-medium">Проект: <span style={{ color: "var(--project-primary)" }}>{project.name}</span></p>
          </div>
          <Link 
            href={`/projects/${project.slug}/profile`}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            👤 Вернуться в профиль
          </Link>
        </div>

        {/* Фильтр по табам */}
        {tabs.length > 0 && (
          <div className="relative z-10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Раздел материалов</h3>
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const isActive = tab.slug === activeTabSlug;
                return (
                  <Link
                    key={tab.id}
                    href={`/projects/${slug}/materials?tab=${tab.slug}${activeLevelCode ? `&level=${activeLevelCode}` : ''}`}
                    className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                      isActive ? 'text-white shadow-lg transform -translate-y-0.5' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 shadow-sm'
                    }`}
                    style={isActive ? { backgroundColor: "var(--project-primary)", borderColor: "var(--project-primary)" } : {}}
                  >
                    <span className={`text-lg transition-transform ${isActive ? "scale-110" : "grayscale"}`}>{tab.icon || "📁"}</span>
                    {tab.title}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Фильтр по уровням */}
        {levels.length > 0 && (
          <div className="relative z-10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Уровень сложности / Класс</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${slug}/materials?tab=${activeTabSlug || ''}`}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  !activeLevelCode ? 'bg-gray-800 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm'
                }`}
              >
                Все уровни
              </Link>
              {levels.map(lvl => {
                const isActive = lvl.code === activeLevelCode;
                return (
                  <Link
                    key={lvl.id}
                    href={`/projects/${slug}/materials?tab=${activeTabSlug || ''}&level=${lvl.code}`}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      isActive ? 'text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm'
                    }`}
                    style={isActive ? { backgroundColor: "var(--project-primary)", borderColor: "var(--project-primary)" } : {}}
                  >
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
        <div className="flex items-center gap-3 px-2">
          <div className="text-3xl">{activeTab.icon || "📁"}</div>
          <h2 className="text-2xl font-extrabold text-gray-900">{activeTab.title}</h2>
          <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full ml-2">
            {materials.length} шт.
          </span>
        </div>
      )}

      {/* 2. СЕТКА МАТЕРИАЛОВ */}
      {materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* ДОСТУПНЫЕ МАТЕРИАЛЫ */}
          {availableMats.map((m) => {
            const { total, completed, progress } = getProgress(m.id);
            const coverUrl = toStorageProxyUrl(m.cover_image_url);

            return (
              <Link
                key={m.id}
                href={`/projects/${slug}/materials/${m.id}`}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 group flex flex-col relative overflow-hidden"
              >
                {/* Эффект свечения при наведении */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-2xl pointer-events-none" style={{ backgroundColor: "var(--project-primary)" }} />

                <div className="flex gap-4 mb-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 shrink-0 border border-black/5 flex items-center justify-center text-3xl shadow-inner">
                    {coverUrl ? (
                      <img src={coverUrl} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      "📄"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-gray-900 text-lg truncate group-hover:text-blue-600 transition-colors">
                      {m.title}
                    </h4>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1 leading-snug">
                      {m.description || "Материалы и задания для выполнения"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto relative z-10">
                  <div className="flex justify-between items-center text-xs font-bold mb-2.5">
                    <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      {completed} / {total} выполнено
                    </span>
                    <span style={{ color: "var(--project-primary)" }} className="text-sm">{progress}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${progress}%`, backgroundColor: "var(--project-primary)" }} 
                    />
                  </div>
                </div>
              </Link>
            );
          })}

          {/* ЗАБЛОКИРОВАННЫЕ МАТЕРИАЛЫ */}
          {lockedMats.map((m) => {
            const coverUrl = toStorageProxyUrl(m.cover_image_url);

            return (
              <div
                key={m.id}
                className="bg-white/60 rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col relative overflow-hidden grayscale-[40%] opacity-80"
              >
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-gray-800 px-3 py-1.5 rounded-lg shadow-sm border text-xs font-extrabold flex items-center gap-1.5 z-10">
                  <span>🔒</span> Закрыто
                </div>

                <div className="flex gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-black/5 flex items-center justify-center text-3xl">
                    {coverUrl ? <img src={coverUrl} alt={m.title} className="w-full h-full object-cover" /> : "📄"}
                  </div>
                  <div className="flex-1 min-w-0 pr-16">
                    <h4 className="font-extrabold text-gray-600 text-lg truncate">{m.title}</h4>
                    <p className="text-sm text-gray-400 line-clamp-2 mt-1 leading-snug">
                      {m.description || "Материал временно недоступен"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto bg-gray-50 rounded-xl p-3 text-center border border-dashed border-gray-200">
                  <span className="text-xs font-bold text-gray-500">
                    Ожидайте доступ или отправьте заявку
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-200 shadow-sm">
          <div className="text-4xl mb-4 opacity-50">🍃</div>
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