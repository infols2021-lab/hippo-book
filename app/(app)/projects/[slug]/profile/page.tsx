/* app/(app)/projects/[slug]/profile/page.tsx */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ProjectProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  
  // В реальном приложении здесь еще тянем данные юзера `auth.getUser()`
  // и его `user_progress`

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, features")
    .eq("slug", slug)
    .single();

  if (!project) notFound();

  // Достаем флаги геймификации, которые мы настраивали в админке, поддерживаем оба формата
  const features = project.features || {};
  const showStreaks = features.streaks || features.hasStreaks;
  const showTitles = features.titles || features.hasTitles;
  const showLeaderboard = features.leaderboard || features.hasLeaderboard;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Профиль: {project.name}</h2>
        <p className="text-gray-500 text-lg">Ваш личный прогресс и достижения в этой ветке.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. БАЗОВАЯ СТАТИСТИКА (Рендерится всегда) */}
        <div className="bg-white rounded-3xl p-6 border shadow-sm md:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5" style={{ color: "var(--project-primary)" }}>
             <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-5 relative z-10">Общая статистика</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10 text-center">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="text-3xl font-black text-gray-900">12</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mt-2 tracking-wider">Решено заданий</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="text-3xl font-black text-green-600">89%</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mt-2 tracking-wider">Средний балл</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="text-3xl font-black" style={{ color: "var(--project-primary)" }}>3</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mt-2 tracking-wider">Доступа открыто</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="text-3xl font-black text-purple-600">1.2k</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mt-2 tracking-wider">Очков опыта</div>
            </div>
          </div>
        </div>

        {/* 2. ОГНЕННЫЙ СТРИК */}
        {showStreaks && (
          <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-start gap-5 hover:-translate-y-1 transition-transform">
            <div className="text-4xl bg-orange-50 w-16 h-16 flex items-center justify-center rounded-2xl border border-orange-100">🔥</div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Огненный стрик</h3>
              <p className="text-gray-500 text-sm mt-1">Решайте задания каждый день, чтобы копить огонь!</p>
              <div className="mt-4 bg-orange-500 text-white px-3 py-1 text-sm rounded-lg font-bold inline-flex items-center gap-1.5 shadow-sm shadow-orange-200">
                <span>3 дня в огне</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. ТИТУЛЫ */}
        {showTitles && (
          <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-start gap-5 hover:-translate-y-1 transition-transform">
            <div className="text-4xl bg-yellow-50 w-16 h-16 flex items-center justify-center rounded-2xl border border-yellow-100">👑</div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Ваш титул</h3>
              <p className="text-gray-500 text-sm mt-1">Ранг мастерства в {project.name}.</p>
              <div className="mt-4 bg-yellow-100 text-yellow-800 px-3 py-1 text-sm rounded-lg font-bold inline-flex items-center gap-1.5">
                Продвинутый Знаток
              </div>
            </div>
          </div>
        )}

        {/* 4. ТАБЛИЦА ЛИДЕРОВ */}
        {showLeaderboard && (
          <div className="bg-white rounded-3xl p-6 border shadow-sm flex flex-col md:col-span-2">
            <div className="flex items-center gap-4 mb-5">
              <div className="text-3xl bg-blue-50 w-12 h-12 flex items-center justify-center rounded-xl">🏆</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Таблица лидеров</h3>
                <p className="text-gray-500 text-sm">Топ учеников этой ветки</p>
              </div>
            </div>
            
            <div className="space-y-2 bg-gray-50 p-4 rounded-2xl">
              {/* Фейковые данные для наглядности */}
              <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100">
                <span className="font-bold text-gray-800 flex items-center gap-2"><span className="text-yellow-500">1.</span> Александр В.</span>
                <span className="text-gray-900 font-black">1500 XP</span>
              </div>
              <div 
                className="flex justify-between items-center px-4 py-3 rounded-xl border-2"
                style={{ borderColor: "var(--project-primary)", backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, white)" }}
              >
                <span className="font-bold flex items-center gap-2" style={{ color: "var(--project-primary)" }}>
                  <span className="opacity-60">4.</span> Вы (Текущее место)
                </span>
                <span className="font-black" style={{ color: "var(--project-primary)" }}>1200 XP</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}