"use client";

import { useState, useEffect } from "react";

// Интерфейсы (можно вынести в общий файл types.ts)
interface Project { id: string; name: string; slug: string; }
interface Tab { id: string; name: string; icon: string; }
interface Level { id: string; name: string; level_code: string; }
interface Material {
  id: string;
  project_id: string;
  tab_id: string;
  title: string;
  description: string | null;
  target_levels: string[];
  is_active: boolean;
  order_index: number;
}

export default function MaterialsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>("");
  
  const [levels, setLevels] = useState<Level[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [editingMaterial, setEditingMaterial] = useState<Partial<Material> | null>(null);

  // 1. Грузим список проектов при старте
  useEffect(() => {
    fetch("/api/admin/projects")
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || data || []);
        setIsLoading(false);
      });
  }, []);

  // 2. Грузим Табы, Уровни и Материалы при выборе Проекта
  useEffect(() => {
    if (!selectedProjectId) {
      setTabs([]); setLevels([]); setMaterials([]); setSelectedTabId("");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [tabsRes, levelsRes, matsRes] = await Promise.all([
          fetch(`/api/admin/projects/${selectedProjectId}/tabs`).then(r => r.json()),
          fetch(`/api/admin/projects/${selectedProjectId}/levels`).then(r => r.json()),
          fetch(`/api/admin/projects/${selectedProjectId}/materials${selectedTabId ? `?tab_id=${selectedTabId}` : ''}`).then(r => r.json()),
        ]);

        setTabs(tabsRes.tabs || []);
        setLevels(levelsRes.levels || []);
        setMaterials(matsRes.materials || []);
      } catch (err) {
        console.error("Ошибка загрузки данных проекта", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedProjectId, selectedTabId]);

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial || !selectedProjectId) return;

    const isEdit = !!editingMaterial.id;
    const url = isEdit 
      ? `/api/admin/projects/${selectedProjectId}/materials/${editingMaterial.id}` // Ожидаемый роут для обновления
      : `/api/admin/projects/${selectedProjectId}/materials`; // Мы создали этот роут ранее
    
    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMaterial),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка");
      
      setEditingMaterial(null);
      // Обновляем список материалов
      const updatedMatsRes = await fetch(`/api/admin/projects/${selectedProjectId}/materials${selectedTabId ? `?tab_id=${selectedTabId}` : ''}`);
      const updatedData = await updatedMatsRes.json();
      setMaterials(updatedData.materials || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleLevelSelection = (levelCode: string) => {
    if (!editingMaterial) return;
    const currentLevels = editingMaterial.target_levels || [];
    if (currentLevels.includes(levelCode)) {
      setEditingMaterial({ ...editingMaterial, target_levels: currentLevels.filter(c => c !== levelCode) });
    } else {
      setEditingMaterial({ ...editingMaterial, target_levels: [...currentLevels, levelCode] });
    }
  };

  return (
    <div className="space-y-6">
      {/* ПАНЕЛЬ ФИЛЬТРОВ И НАВИГАЦИИ */}
      <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Проект (Ветка)</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 bg-gray-50"
          >
            <option value="">-- Выберите проект --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} (/{p.slug})</option>)}
          </select>
        </div>

        {selectedProjectId && (
          <div className="flex-1 min-w-[200px] animate-in fade-in slide-in-from-left-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Вкладка (Таб)</label>
            <select 
              value={selectedTabId} 
              onChange={(e) => setSelectedTabId(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 bg-gray-50"
            >
              <option value="">Все вкладки</option>
              {tabs.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          </div>
        )}

        {selectedProjectId && (
          <button
            onClick={() => setEditingMaterial({ 
              title: "", description: "", tab_id: selectedTabId || (tabs[0]?.id || ""), target_levels: [], order_index: 0, is_active: true 
            })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            + Добавить материал
          </button>
        )}
      </div>

      {/* ФОРМА РЕДАКТИРОВАНИЯ (Модальное окно или раскрывающийся блок) */}
      {editingMaterial && (
        <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-md animate-in slide-in-from-top-4">
          <h3 className="text-xl font-bold text-gray-900 mb-5 border-b pb-3">
            {editingMaterial.id ? "Редактирование материала" : "Создание нового материала"}
          </h3>
          <form onSubmit={handleSaveMaterial} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Название</label>
                <input
                  type="text" required
                  value={editingMaterial.title || ""}
                  onChange={(e) => setEditingMaterial({...editingMaterial, title: e.target.value})}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Например: Кроссворд Present Simple"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Вкладка (Таб)</label>
                <select
                  required
                  value={editingMaterial.tab_id || ""}
                  onChange={(e) => setEditingMaterial({...editingMaterial, tab_id: e.target.value})}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>Выберите таб...</option>
                  {tabs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* ВЫБОР УРОВНЕЙ */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Для каких уровней доступен материал? (Target Levels)
              </label>
              {levels.length === 0 ? (
                <div className="text-sm text-red-500">У проекта нет уровней. Сначала создайте уровни в настройках проекта.</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {levels.map(lvl => {
                    const isChecked = (editingMaterial.target_levels || []).includes(lvl.level_code);
                    return (
                      <label 
                        key={lvl.id} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors ${
                          isChecked ? 'bg-blue-100 border-blue-400 text-blue-900' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isChecked}
                          onChange={() => toggleLevelSelection(lvl.level_code)}
                        />
                        <span className="font-medium text-sm">{lvl.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setEditingMaterial(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">
                Отмена
              </button>
              <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
                Сохранить материал
              </button>
            </div>
          </form>
        </div>
      )}

      {/* СПИСОК МАТЕРИАЛОВ */}
      {!selectedProjectId ? (
        <div className="text-center py-20 text-gray-400 font-medium text-lg">
          Выберите проект сверху, чтобы начать работу с материалами.
        </div>
      ) : isLoading ? (
        <div className="text-center py-10">Загрузка...</div>
      ) : materials.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
          Здесь пока нет материалов.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b">
                <th className="px-6 py-4 font-bold">Материал</th>
                <th className="px-6 py-4 font-bold">Таб</th>
                <th className="px-6 py-4 font-bold">Уровни</th>
                <th className="px-6 py-4 font-bold text-center">Статус</th>
                <th className="px-6 py-4 font-bold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materials.map(mat => {
                // Находим название таба для красивого отображения (если API не вернуло join)
                const tabName = tabs.find(t => t.id === mat.tab_id)?.name || "Неизвестно";
                return (
                  <tr key={mat.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 font-bold text-gray-900">{mat.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded-md border">{tabName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {mat.target_levels?.map(lvl => (
                          <span key={lvl} className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                            {lvl}
                          </span>
                        )) || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-block w-3 h-3 rounded-full ${mat.is_active ? 'bg-green-500' : 'bg-red-400'}`} title={mat.is_active ? 'Активен' : 'Скрыт'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setEditingMaterial(mat)} className="text-blue-600 font-medium hover:underline text-sm">
                        Изменить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}