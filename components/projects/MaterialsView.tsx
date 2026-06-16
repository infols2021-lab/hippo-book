"use client";

import Link from "next/link";
import { useProject } from "./ProjectProvider";

type Tab = { id: string; name: string; slug: string; icon: string | null };
type Level = { id: string; name: string; level_code: string };
type Material = {
  id: string;
  title: string;
  description: string | null;
  target_levels: string[];
  project_tabs: { slug: string; icon: string | null; name: string };
};

interface MaterialsViewProps {
  tabs: Tab[];
  levels: Level[];
  materials: Material[];
  activeTabSlug?: string;
  activeLevelCode?: string;
}

export default function MaterialsView({ 
  tabs, 
  levels, 
  materials, 
  activeTabSlug, 
  activeLevelCode 
}: MaterialsViewProps) {
  // Достаем инфу о проекте (слаг и цвета) из нашего нового контекста!
  const project = useProject();
  const activeTab = tabs.find(t => t.slug === activeTabSlug);

  return (
    <div className="space-y-8">
      {/* ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        
        {tabs.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Раздел материалов</h3>
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const isActive = tab.slug === activeTabSlug;
                return (
                  <Link
                    key={tab.id}
                    href={`/projects/${project.slug}/materials?tab=${tab.slug}${activeLevelCode ? `&level=${activeLevelCode}` : ''}`}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                      isActive ? 'text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                    style={isActive ? { backgroundColor: "var(--project-primary)" } : {}}
                  >
                    <span className="text-lg">{tab.icon || "📄"}</span> {tab.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {levels.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Уровень сложности / Класс</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${project.slug}/materials?tab=${activeTabSlug || ''}`}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  !activeLevelCode ? 'bg-gray-800 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Все уровни
              </Link>
              {levels.map(lvl => {
                const isActive = lvl.level_code === activeLevelCode;
                return (
                  <Link
                    key={lvl.id}
                    href={`/projects/${project.slug}/materials?tab=${activeTabSlug || ''}&level=${lvl.level_code}`}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      isActive ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={isActive ? { backgroundColor: "var(--project-secondary)" } : {}}
                  >
                    {lvl.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ЗАГОЛОВОК СПИСКА */}
      {activeTab && (
        <div className="flex items-center gap-3">
          <div className="text-4xl drop-shadow-sm">{activeTab.icon || "📄"}</div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">{activeTab.name}</h2>
          <span className="bg-gray-100 border border-gray-200 text-gray-600 text-sm font-bold px-3 py-1 rounded-full ml-2">
            {materials.length} заданий
          </span>
        </div>
      )}

      {/* СЕТКА КАРТОЧЕК */}
      {materials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map(mat => (
            <Link key={mat.id} href={`/projects/${project.slug}/assignment/${mat.id}`}>
              <div className="bg-white rounded-3xl p-6 border shadow-sm hover:shadow-lg transition-all group flex flex-col h-full relative overflow-hidden cursor-pointer hover:-translate-y-1">
                <div 
                  className="absolute top-0 left-0 w-full h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" 
                  style={{ backgroundColor: "var(--project-primary)" }} 
                />
                
                <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {mat.title}
                </h4>
                
                <p className="text-sm text-gray-500 mb-6 flex-grow line-clamp-3 leading-relaxed">
                  {mat.description || "Нажмите, чтобы открыть и начать выполнение задания. Удачи!"}
                </p>
                
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1.5">
                    {mat.target_levels?.map((l: string) => {
                      const levelName = levels.find(level => level.level_code === l)?.name || l;
                      return (
                        <span key={l} className="text-[10px] font-black bg-gray-100 text-gray-600 px-2 py-1 rounded-md uppercase tracking-wider">
                          {levelName}
                        </span>
                      );
                    })}
                  </div>
                  <div 
                    className="font-black text-sm bg-gray-50 px-3 py-1.5 rounded-lg group-hover:bg-blue-50 transition-colors flex items-center gap-1" 
                    style={{ color: "var(--project-primary)" }}
                  >
                    Решать <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-200">
          <div className="text-5xl mb-4 opacity-50">📭</div>
          <h3 className="text-2xl font-bold text-gray-900">Материалы не найдены</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Для выбранных фильтров пока нет загруженных заданий. Попробуйте выбрать другой класс или раздел.
          </p>
        </div>
      )}
    </div>
  );
}