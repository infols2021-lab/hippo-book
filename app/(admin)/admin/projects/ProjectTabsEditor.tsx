"use client";

import { useState, useEffect } from "react";

export interface ProjectTab {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  icon: string | null;
  order_index: number;
  is_active: boolean;
}

export default function ProjectTabsEditor({ projectId }: { projectId: string }) {
  const [tabs, setTabs] = useState<ProjectTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTab, setEditingTab] = useState<Partial<ProjectTab> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTabs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/tabs`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка загрузки табов");
      setTabs(data.tabs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchTabs();
  }, [projectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTab) return;
    
    setIsSaving(true);
    const isEdit = !!editingTab.id;
    const url = isEdit 
      ? `/api/admin/projects/${projectId}/tabs/${editingTab.id}` 
      : `/api/admin/projects/${projectId}/tabs`;
      
    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTab),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка при сохранении");
      
      setEditingTab(null);
      fetchTabs();
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
          <h3 className="text-lg font-bold text-gray-900">Вкладки материалов (Табы)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Разделы, которые увидят пользователи (Учебники, Тесты, Кроссворды и т.д.)
          </p>
        </div>
        {!editingTab && (
          <button
            onClick={() => setEditingTab({ name: "", slug: "", icon: "📄", order_index: 0, is_active: true })}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            + Добавить таб
          </button>
        )}
      </div>

      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}

      {editingTab && (
        <form onSubmit={handleSave} className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6 animate-in fade-in zoom-in-95 duration-200">
          <h4 className="font-bold text-gray-800 mb-4">{editingTab.id ? "Редактировать таб" : "Новый таб"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Название</label>
              <input
                type="text"
                required
                value={editingTab.name || ""}
                onChange={(e) => setEditingTab({ ...editingTab, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Учебники"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Slug (URL)</label>
              <input
                type="text"
                required
                pattern="[a-z0-9-]+"
                value={editingTab.slug || ""}
                onChange={(e) => setEditingTab({ ...editingTab, slug: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="textbooks"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Иконка (Emoji/Текст)</label>
              <input
                type="text"
                value={editingTab.icon || ""}
                onChange={(e) => setEditingTab({ ...editingTab, icon: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="📚"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Сортировка</label>
              <input
                type="number"
                value={editingTab.order_index || 0}
                onChange={(e) => setEditingTab({ ...editingTab, order_index: parseInt(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingTab.is_active ?? true}
                onChange={(e) => setEditingTab({ ...editingTab, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Активен</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingTab(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-gray-500 text-sm">Загрузка табов...</div>
      ) : tabs.length === 0 && !editingTab ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed text-gray-500 text-sm">
          Нет вкладок. Создайте хотя бы одну.
        </div>
      ) : (
        <div className="space-y-2">
          {tabs.map((tab) => (
            <div key={tab.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-2xl w-8 text-center">{tab.icon || "📄"}</div>
                <div>
                  <div className="font-bold text-gray-900">{tab.name}</div>
                  <div className="text-xs text-gray-500 font-mono">/{tab.slug} (Порядок: {tab.order_index})</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-bold rounded-md ${tab.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {tab.is_active ? "Активен" : "Скрыт"}
                </span>
                <button
                  onClick={() => setEditingTab(tab)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1"
                >
                  Изменить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}