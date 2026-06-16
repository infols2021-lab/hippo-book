"use client";

import { useState, useEffect } from "react";

export default function ProjectEditor({ project, onClose, onSaved }: { project: any, onClose: () => void, onSaved: () => void }) {
  // Читаем цвет темы с обратной совместимостью (из нового или старого формата)
  const initialPrimaryColor = project?.theme?.colors?.primary || project?.theme?.primaryColor || "#3b82f6";

  const [formData, setFormData] = useState({
    name: project?.name || "",
    slug: project?.slug || "",
    description: project?.description || "",
    is_active: project?.is_active ?? true,
    theme: {
      ...project?.theme,
      colors: {
        ...project?.theme?.colors,
        primary: initialPrimaryColor,
      },
      primaryColor: initialPrimaryColor // Дублируем для легаси
    },
    features: {
      ...project?.features,
      streaks: project?.features?.streaks || project?.features?.hasStreaks || false,
      titles: project?.features?.titles || project?.features?.hasTitles || false,
      leaderboard: project?.features?.leaderboard || project?.features?.hasLeaderboard || false,
      avatars: project?.features?.avatars || project?.features?.hasAvatars || false,
      profileProgress: project?.features?.profileProgress || false,
      requestMode: project?.features?.requestMode || false,
      hasStreaks: project?.features?.streaks || project?.features?.hasStreaks || false,
      hasTitles: project?.features?.titles || project?.features?.hasTitles || false,
      hasLeaderboard: project?.features?.leaderboard || project?.features?.hasLeaderboard || false,
    }
  });

  const [levels, setLevels] = useState<any[]>([]);
  const [newLevel, setNewLevel] = useState({ code: "", label: "" });

  // Стейты для управления табами
  const [tabs, setTabs] = useState<any[]>([]);
  const [editingTab, setEditingTab] = useState<any | null>(null);

  useEffect(() => {
    if (project?.id) {
      // Загружаем уровни
      fetch(`/api/admin/projects/${project.id}/levels`)
        .then(r => r.json())
        .then(d => setLevels(d.levels || d.data || []));
      
      // Загружаем табы
      fetch(`/api/admin/projects/${project.id}/tabs`)
        .then(r => r.json())
        .then(d => setTabs(d.tabs || []));
    }
  }, [project]);

  // СОХРАНЕНИЕ ПРОЕКТА
  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = project?.id ? `/api/admin/projects/${project.id}` : "/api/admin/projects";
    await fetch(url, {
      method: project?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
    onSaved();
  };

  // ДОБАВЛЕНИЕ УРОВНЯ
  const addLevel = async () => {
    if (!newLevel.code || !newLevel.label || !project?.id) return;
    
    const res = await fetch(`/api/admin/projects/${project.id}/levels`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        code: newLevel.code,
        label: newLevel.label,
        order_index: levels.length * 10, 
        is_active: true 
      })
    });
    
    const d = await res.json();
    if (res.ok) {
      if (d.level || d.data) {
        setLevels([...levels, d.level || d.data]);
      } else {
        const refresh = await fetch(`/api/admin/projects/${project.id}/levels`);
        const refreshData = await refresh.json();
        setLevels(refreshData.levels || refreshData.data || []);
      }
      setNewLevel({ code: "", label: "" });
    } else {
      alert("Ошибка: " + (d.error || "Не удалось добавить уровень"));
    }
  };

  // СОХРАНЕНИЕ ТАБА
  const saveTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id || !editingTab) return;

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/tabs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTab),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Ошибка сохранения таба");
      }

      setEditingTab(null);
      // Обновляем список табов
      const refreshRes = await fetch(`/api/admin/projects/${project.id}/tabs`);
      const refreshData = await refreshRes.json();
      setTabs(refreshData.tabs || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // УДАЛЕНИЕ ТАБА
  const deleteTab = async (tabId: string) => {
    if (!project?.id) return;
    if (!window.confirm("Удалить этот раздел? (Убедитесь, что в нем нет материалов)")) return;

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/tabs?id=${tabId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Ошибка удаления");
      }
      setTabs(tabs.filter(t => t.id !== tabId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleFeature = (newKey: string, legacyKey: string) => {
    setFormData(prev => {
      const newValue = !prev.features[newKey as keyof typeof prev.features];
      return {
        ...prev, 
        features: { 
          ...prev.features, 
          [newKey]: newValue, 
          [legacyKey]: newValue 
        } 
      };
    });
  };

  const handleThemeChange = (color: string) => {
    setFormData(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        colors: {
          ...prev.theme.colors,
          primary: color
        },
        primaryColor: color
      }
    }));
  };

  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">{project ? `Настройка ветки: ${project.name}` : "Новая ветка"}</h2>
        <button onClick={onClose} className="text-gray-500 font-bold hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">Закрыть</button>
      </div>

      <form onSubmit={saveProject} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">Название ветки</label>
            <input required className="w-full border-2 rounded-xl px-4 py-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">URL (Slug)</label>
            <input required className="w-full border-2 rounded-xl px-4 py-2" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-bold mb-1">Описание на портале</label>
            <textarea className="w-full border-2 rounded-xl px-4 py-2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Цвет темы</label>
            <input 
              type="color" 
              className="w-full h-12 rounded-xl cursor-pointer" 
              value={formData.theme.colors.primary} 
              onChange={e => handleThemeChange(e.target.value)} 
            />
          </div>
        </div>

        {/* ФИЧИ */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-3">Модули платформы (Геймификация)</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={formData.features.streaks} onChange={() => toggleFeature('streaks', 'hasStreaks')} /> 
              🔥 Огненные стрики
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={formData.features.titles} onChange={() => toggleFeature('titles', 'hasTitles')} /> 
              👑 Титулы
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={formData.features.leaderboard} onChange={() => toggleFeature('leaderboard', 'hasLeaderboard')} /> 
              🏆 Лидерборд
            </label>
          </div>
        </div>

        <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 transition-colors text-white font-bold py-3 rounded-xl">💾 Сохранить ядро проекта</button>
      </form>

      {/* ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ (ПОЯВЛЯЮТСЯ ТОЛЬКО ПОСЛЕ СОЗДАНИЯ ПРОЕКТА) */}
      {project?.id && (
        <>
          {/* УПРАВЛЕНИЕ УРОВНЯМИ */}
          <div className="border-t pt-6">
            <h3 className="text-xl font-bold mb-4">Уровни (Классы)</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {levels.map(l => (
                <div key={l.id} className="bg-gray-50 border p-3 rounded-lg flex justify-between">
                  <span className="font-bold">{l.label} <span className="text-xs text-gray-500 font-mono ml-2">({l.code})</span></span>
                </div>
              ))}
              {levels.length === 0 && <div className="text-sm text-gray-500 col-span-2">Уровней пока нет</div>}
            </div>
            <div className="flex gap-3 bg-gray-50 p-3 rounded-xl border">
              <input className="border-2 rounded-lg px-3 py-2 flex-1" placeholder="Код (hippo-1)" value={newLevel.code} onChange={e => setNewLevel({...newLevel, code: e.target.value})} />
              <input className="border-2 rounded-lg px-3 py-2 flex-1" placeholder="Название (Hippo 1)" value={newLevel.label} onChange={e => setNewLevel({...newLevel, label: e.target.value})} />
              <button onClick={addLevel} type="button" className="bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold px-4 py-2 rounded-lg">Добавить</button>
            </div>
          </div>

          {/* УПРАВЛЕНИЕ ТАБАМИ (РАЗДЕЛАМИ) */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Разделы (Табы)</h3>
              {!editingTab && (
                <button 
                  type="button"
                  onClick={() => setEditingTab({ title: "", slug: "", icon: "📄", order_index: tabs.length * 10, is_active: true, component_type: "materials" })}
                  className="bg-gray-100 hover:bg-gray-200 transition-colors text-gray-800 px-4 py-2 rounded-lg font-bold text-sm"
                >
                  + Создать раздел
                </button>
              )}
            </div>

            {/* Форма редактирования таба */}
            {editingTab && (
              <form onSubmit={saveTab} className="bg-gray-50 p-5 rounded-2xl border border-blue-100 mb-6 relative">
                <h4 className="font-bold text-lg mb-4">{editingTab.id ? "Редактирование раздела" : "Новый раздел"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Название (Title)</label>
                    <input required className="w-full border-2 rounded-xl px-4 py-2" placeholder="Грамматика" value={editingTab.title} onChange={e => setEditingTab({...editingTab, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">URL (Slug)</label>
                    <input required className="w-full border-2 rounded-xl px-4 py-2" placeholder="grammar" value={editingTab.slug} onChange={e => setEditingTab({...editingTab, slug: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Иконка (Emoji)</label>
                    <input className="w-full border-2 rounded-xl px-4 py-2" placeholder="📚" value={editingTab.icon || ""} onChange={e => setEditingTab({...editingTab, icon: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Порядок сортировки</label>
                    <input type="number" required className="w-full border-2 rounded-xl px-4 py-2" value={editingTab.order_index} onChange={e => setEditingTab({...editingTab, order_index: Number(e.target.value)})} />
                  </div>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer font-bold mt-4">
                  <input type="checkbox" checked={editingTab.is_active} onChange={e => setEditingTab({...editingTab, is_active: e.target.checked})} className="w-5 h-5" />
                  Отображать на сайте
                </label>
                
                <div className="flex gap-4 mt-6">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-2.5 rounded-xl font-bold">Сохранить раздел</button>
                  <button type="button" onClick={() => setEditingTab(null)} className="bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors px-6 py-2.5 rounded-xl font-bold">Отмена</button>
                </div>
              </form>
            )}

            {/* Список табов */}
            {!editingTab && tabs.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 font-bold text-sm">Раздел</th>
                      <th className="p-3 font-bold text-sm text-center">Порядок</th>
                      <th className="p-3 font-bold text-sm text-center">Статус</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tabs.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-bold">{t.icon} {t.title}</div>
                          <div className="text-xs text-gray-400 font-mono">/{t.slug}</div>
                        </td>
                        <td className="p-3 text-center font-bold">{t.order_index}</td>
                        <td className="p-3 text-center">
                          {t.is_active ? <span className="text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded">Активен</span> : <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded">Скрыт</span>}
                        </td>
                        <td className="p-3 text-right space-x-3">
                          <button type="button" onClick={() => setEditingTab(t)} className="text-blue-600 text-sm font-bold hover:underline">Изменить</button>
                          <button type="button" onClick={() => deleteTab(t.id)} className="text-red-500 text-sm font-bold hover:underline">Удалить</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!editingTab && tabs.length === 0 && (
              <div className="text-sm text-gray-500 bg-gray-50 border border-dashed rounded-xl p-6 text-center font-bold">
                Вкладок пока нет. Создайте первую, чтобы загружать материалы!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}