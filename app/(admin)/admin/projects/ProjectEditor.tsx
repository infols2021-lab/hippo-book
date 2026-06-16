"use client";

import { useState } from "react";
import type { Project } from "./ProjectsTab";

type ProjectEditorProps = {
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProjectEditor({ project, onClose, onSaved }: ProjectEditorProps) {
  // Инициализируем стейт. Если создаем новый, подставляем дефолтные значения.
  const [formData, setFormData] = useState({
    name: project?.name || "",
    slug: project?.slug || "",
    description: project?.description || "",
    is_available: project?.is_available ?? true,
    theme: project?.theme || { 
      primaryColor: "#0ea5e9", // Дефолтный синий
      secondaryColor: "#38bdf8",
      backgroundColor: "#f8fafc"
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    // Динамический выбор метода и URL
    const isEdit = !!project;
    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `/api/admin/projects/${project.id}` : "/api/admin/projects";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Ошибка при сохранении проекта");
      }

      onSaved(); // Успешно сохранили -> уведомляем родителя
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 animate-in slide-in-from-bottom-4 duration-300">
      {/* Шапка модалки/формы */}
      <div className="flex justify-between items-center p-6 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {project ? "Настройка проекта" : "Создание нового проекта"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {project ? `Редактирование ветки /${project.slug}` : "Заполните базовые данные для новой ветки"}
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Базовые настройки</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Например: Hippo Olympiad"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Slug (URL) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 select-none">
                  /projects/
                </span>
                <input
                  type="text"
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="olympiad"
                  title="Только маленькие латинские буквы, цифры и дефис"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="w-full border border-gray-300 rounded-xl pl-24 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Краткое описание</label>
            <textarea
              rows={3}
              placeholder="Опишите для чего нужна эта ветка..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none"
            />
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* ВИЗУАЛЬНАЯ ТЕМА */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Оформление (Theme JSON)</h3>
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl flex flex-wrap gap-8 items-center">
            
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                <input
                  type="color"
                  value={formData.theme.primaryColor}
                  onChange={(e) => setFormData({ ...formData, theme: { ...formData.theme, primaryColor: e.target.value } })}
                  className="absolute inset-0 w-[200%] h-[200%] -top-2 -left-2 cursor-pointer"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">Основной цвет</div>
                <div className="text-xs text-gray-500 font-mono uppercase">{formData.theme.primaryColor}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                <input
                  type="color"
                  value={formData.theme.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, theme: { ...formData.theme, secondaryColor: e.target.value } })}
                  className="absolute inset-0 w-[200%] h-[200%] -top-2 -left-2 cursor-pointer"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">Вторичный цвет</div>
                <div className="text-xs text-gray-500 font-mono uppercase">{formData.theme.secondaryColor}</div>
              </div>
            </div>

          </div>
        </div>

        <hr className="border-gray-100" />

        {/* СТАТУС */}
        <label className={`flex items-start gap-4 p-5 border rounded-xl cursor-pointer transition-colors ${
          formData.is_available ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center h-6 mt-0.5">
            <input
              type="checkbox"
              checked={formData.is_available}
              onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
              className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
            />
          </div>
          <div>
            <div className={`font-semibold ${formData.is_available ? 'text-green-900' : 'text-gray-900'}`}>
              Опубликовать ветку (Активна)
            </div>
            <div className={`text-sm mt-1 ${formData.is_available ? 'text-green-700' : 'text-gray-500'}`}>
              Если галочка снята, пользователи не смогут получить доступ к этому проекту, его табам и материалам.
            </div>
          </div>
        </label>

        {/* КНОПКИ ДЕЙСТВИЙ */}
        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSaving ? "Сохранение..." : "Сохранить проект"}
          </button>
        </div>

      </form>
    </div>
  );
}