"use client";

import { useState, useEffect } from "react";

export interface ProjectLevel {
  id: string;
  project_id: string;
  name: string; // Красивое название (Hippo 1)
  level_code: string; // Технический код для БД (hippo-1)
  order_index: number;
  is_active: boolean;
}

export default function ProjectLevelsEditor({ projectId }: { projectId: string }) {
  const [levels, setLevels] = useState<ProjectLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingLevel, setEditingLevel] = useState<Partial<ProjectLevel> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchLevels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/levels`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка загрузки уровней");
      setLevels(data.levels || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchLevels();
  }, [projectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLevel) return;
    
    setIsSaving(true);
    const isEdit = !!editingLevel.id;
    const url = isEdit 
      ? `/api/admin/projects/${projectId}/levels/${editingLevel.id}` 
      : `/api/admin/projects/${projectId}/levels`;
      
    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLevel),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка при сохранении");
      
      setEditingLevel(null);
      fetchLevels();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Уровни / Категории (Levels)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Сложность или классы для этой ветки (Например: Hippo 1, Stage 2, B2)
          </p>
        </div>
        {!editingLevel && (
          <button
            onClick={() => setEditingLevel({ name: "", level_code: "", order_index: 0, is_active: true })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            + Добавить уровень
          </button>
        )}
      </div>

      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}

      {editingLevel && (
        <form onSubmit={handleSave} className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 mb-6 animate-in fade-in zoom-in-95 duration-200">
          <h4 className="font-bold text-gray-800 mb-4">{editingLevel.id ? "Редактировать уровень" : "Новый уровень"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Отображаемое Имя</label>
              <input
                type="text"
                required
                value={editingLevel.name || ""}
                onChange={(e) => setEditingLevel({ ...editingLevel, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Hippo 1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Код (Системный ID)</label>
              <input
                type="text"
                required
                pattern="[a-z0-9-_]+"
                value={editingLevel.level_code || ""}
                onChange={(e) => setEditingLevel({ ...editingLevel, level_code: e.target.value.toLowerCase() })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="hippo_1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Сортировка</label>
              <input
                type="number"
                value={editingLevel.order_index || 0}
                onChange={(e) => setEditingLevel({ ...editingLevel, order_index: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-between items-center mt-5 pt-4 border-t border-purple-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingLevel.is_active ?? true}
                onChange={(e) => setEditingLevel({ ...editingLevel, is_active: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Уровень активен</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingLevel(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-gray-500 text-sm">Загрузка уровней...</div>
      ) : levels.length === 0 && !editingLevel ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed text-gray-500 text-sm">
          Нет уровней. Материалы нельзя будет привязать.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {levels.map((lvl) => (
            <div key={lvl.id} className="flex flex-col p-4 border rounded-xl hover:shadow-md transition-shadow bg-white">
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-gray-900">{lvl.name}</div>
                <button
                  onClick={() => setEditingLevel(lvl)}
                  className="text-gray-400 hover:text-purple-600"
                  title="Изменить"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div className="text-xs text-gray-500 font-mono mb-3 bg-gray-100 p-1 rounded inline-block w-max">
                {lvl.level_code}
              </div>
              <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">Порядок: {lvl.order_index}</span>
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${lvl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {lvl.is_active ? "ВКЛ" : "ВЫКЛ"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}