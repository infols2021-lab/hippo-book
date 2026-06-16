"use client";

import { useState, useEffect } from "react";
import ProjectEditor from "./ProjectEditor";

// Единый интерфейс проекта для фронтенда
export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_available: boolean;
  theme: Record<string, string>; // JSONB для CSS переменных
  features?: Record<string, any>; // JSONB для флагов (стрики, титулы и т.д.)
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/projects");
      if (!res.ok) throw new Error("Не удалось загрузить проекты");
      
      const data = await res.json();
      // Ожидаем, что API возвращает { ok: true, projects: [...] } 
      // или просто массив, зависит от твоего стандарта. Подстроим под стандартный ok/fail:
      if (data.ok && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else if (Array.isArray(data)) {
        setProjects(data); // Фоллбэк, если возвращается просто массив
      } else {
        throw new Error(data.error || "Неверный формат ответа");
      }
    } catch (err: any) {
      setError(err.message || "Сетевая ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Если админ нажал "Создать" или "Редактировать", показываем форму
  if (isCreating || editingProject) {
    return (
      <ProjectEditor
        project={editingProject}
        onClose={() => {
          setIsCreating(false);
          setEditingProject(null);
        }}
        onSaved={() => {
          setIsCreating(false);
          setEditingProject(null);
          fetchProjects(); // Обновляем список после сохранения
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Проекты и Ветки</h2>
          <p className="text-sm text-gray-500 mt-1">
            Управляйте глобальными разделами платформы (Олимпиада, Экзамены и др.)
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Новый проект
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="text-gray-400 mb-3">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Нет проектов</h3>
          <p className="text-gray-500 mt-1 mb-4">Вы еще не создали ни одной ветки.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Создать первый проект &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden"
            >
              {/* Цветовая полоска сверху, берет цвет из темы проекта */}
              <div 
                className="absolute top-0 left-0 w-full h-1.5 opacity-80"
                style={{ backgroundColor: project.theme?.primaryColor || '#3b82f6' }}
              />
              
              <div className="flex justify-between items-start mb-4 mt-2">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono mt-1">/{project.slug}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                  project.is_available 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {project.is_available ? "Активен" : "Скрыт"}
                </span>
              </div>
              
              <p className="text-gray-600 text-sm flex-grow mb-6 line-clamp-3">
                {project.description || "Описание отсутствует..."}
              </p>

              <button
                onClick={() => setEditingProject(project)}
                className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Настроить ядро
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}