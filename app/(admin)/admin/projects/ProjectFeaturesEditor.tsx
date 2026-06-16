"use client";

import { useState, useEffect } from "react";

export interface ProjectFeatures {
  hasStreaks?: boolean;
  hasTitles?: boolean;
  hasAvatars?: boolean;
  hasRecommendations?: boolean;
  hasLeaderboard?: boolean;
}

export default function ProjectFeaturesEditor({ projectId }: { projectId: string }) {
  const [features, setFeatures] = useState<ProjectFeatures>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загружаем текущие настройки проекта
  useEffect(() => {
    if (!projectId) return;
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        // Предполагается, что GET /api/admin/projects/[id] возвращает сам проект
        const res = await fetch(`/api/admin/projects/${projectId}`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка загрузки фичей");
        setFeatures(data.project?.features || {});
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleToggle = (featureKey: keyof ProjectFeatures) => {
    setFeatures(prev => ({ ...prev, [featureKey]: !prev[featureKey] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Обновляем только поле features через PATCH или PUT проекта
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "PUT", // или PATCH, в зависимости от твоего API
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка сохранения");
      
      alert("Настройки модулей успешно сохранены!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const featureList = [
    { key: "hasStreaks" as const, name: "Огненные стрики (Streaks)", desc: "Отслеживание ежедневных заходов и непрерывного выполнения заданий.", icon: "🔥" },
    { key: "hasTitles" as const, name: "Титулы и Достижения", desc: "Система рангов (Новичок, Мастер и т.д.) за набранные баллы.", icon: "👑" },
    { key: "hasAvatars" as const, name: "Кастомные аватарки", desc: "Пользователи могут менять аватарки в профиле этой ветки.", icon: "👾" },
    { key: "hasRecommendations" as const, name: "Умные рекомендации", desc: "Автоматический расчет и рекомендация уровня (как в экзаменах).", icon: "🧠" },
    { key: "hasLeaderboard" as const, name: "Таблица лидеров", desc: "Рейтинг пользователей по баллам внутри этого проекта.", icon: "🏆" },
  ];

  if (isLoading) return <div className="p-6 text-gray-500 animate-pulse">Загрузка модулей...</div>;

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Модули проекта (Features)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Включайте и отключайте функционал профиля и геймификации для этой ветки.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? "Сохранение..." : "Сохранить изменения"}
        </button>
      </div>

      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {featureList.map((f) => {
          const isActive = !!features[f.key];
          return (
            <div 
              key={f.key} 
              onClick={() => handleToggle(f.key)}
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-start gap-4 ${
                isActive ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              <div className="text-3xl mt-1">{f.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h4 className={`font-bold ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>{f.name}</h4>
                  {/* Красивый Toggle-переключатель */}
                  <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}