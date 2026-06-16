"use client";

import { useProject } from "./ProjectProvider";

// Описываем структуру данных пользователя, которую будем передавать снаружи
export interface UserProfileData {
  streakDays?: number;
  titleName?: string;
  avatarUrl?: string | null;
  recommendedLevel?: string | null;
  completedTasks?: number;
  xp?: number;
}

interface ProfileModulesProps {
  userData: UserProfileData;
}

export default function ProfileModules({ userData }: ProfileModulesProps) {
  // Вытягиваем конфиг ветки из контекста
  const project = useProject();
  const features = project.features || {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. МОДУЛЬ: ОГНЕННЫЕ СТРИКИ */}
      {features.hasStreaks && (
        <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-start gap-5 hover:-translate-y-1 transition-transform group">
          <div className="text-4xl bg-orange-50 w-16 h-16 flex items-center justify-center rounded-2xl border border-orange-100 group-hover:scale-110 transition-transform origin-bottom">
            🔥
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Стрик</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Решайте задания каждый день, чтобы копить огонь.
            </p>
            <div className="mt-3 bg-orange-500 text-white px-3 py-1 text-sm rounded-lg font-bold inline-flex items-center shadow-sm shadow-orange-200">
              {userData.streakDays || 0} дней в огне
            </div>
          </div>
        </div>
      )}

      {/* 2. МОДУЛЬ: ТИТУЛЫ (РАНГИ) */}
      {features.hasTitles && (
        <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-start gap-5 hover:-translate-y-1 transition-transform group">
          <div className="text-4xl bg-yellow-50 w-16 h-16 flex items-center justify-center rounded-2xl border border-yellow-100 group-hover:scale-110 transition-transform origin-bottom">
            👑
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Ваш титул</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Текущий ранг мастерства в ветке {project.name}.
            </p>
            <div className="mt-3 bg-yellow-100 text-yellow-800 px-3 py-1 text-sm rounded-lg font-bold inline-flex items-center">
              {userData.titleName || "Новичок"}
            </div>
          </div>
        </div>
      )}

      {/* 3. МОДУЛЬ: АВАТАРКИ */}
      {features.hasAvatars && (
        <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-start gap-5 hover:-translate-y-1 transition-transform group">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ borderColor: "var(--project-primary)" }}>
            {userData.avatarUrl ? (
              <img src={userData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">👾</span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Аватар</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Ваше лицо на платформе. Доступно для изменения.
            </p>
            <button 
              className="mt-3 text-sm font-bold bg-gray-50 hover:bg-gray-100 px-3 py-1 rounded-lg transition-colors"
              style={{ color: "var(--project-primary)" }}
            >
              Изменить →
            </button>
          </div>
        </div>
      )}

      {/* 4. МОДУЛЬ: УМНЫЕ РЕКОМЕНДАЦИИ УРОВНЯ (Как в Gatehouse) */}
      {features.hasRecommendations && (
        <div className="bg-white rounded-3xl p-6 border shadow-sm flex items-start gap-5 hover:-translate-y-1 transition-transform group">
          <div className="text-4xl bg-purple-50 w-16 h-16 flex items-center justify-center rounded-2xl border border-purple-100 group-hover:scale-110 transition-transform origin-bottom">
            🧠
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Рекомендация</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Рекомендованный уровень на основе пройденных тестов.
            </p>
            {userData.recommendedLevel ? (
              <div className="mt-3 bg-purple-100 text-purple-800 px-3 py-1 text-sm rounded-lg font-bold inline-flex items-center border border-purple-200">
                {userData.recommendedLevel}
              </div>
            ) : (
              <div className="mt-3 bg-gray-100 text-gray-500 px-3 py-1 text-sm rounded-lg font-bold inline-flex items-center">
                Пройдите тест
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}