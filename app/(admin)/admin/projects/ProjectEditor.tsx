"use client";

import { useState, useEffect } from "react";

export default function ProjectEditor({ project, onClose, onSaved }: { project: any, onClose: () => void, onSaved: () => void }) {
  // Читаем цвета с обратной совместимостью (старый и новый формат)
  const initialPrimaryColor = project?.theme?.colors?.primary || project?.theme?.primaryColor || "#3b82f6";
  const initialSecondaryColor = project?.theme?.colors?.secondary || project?.theme?.secondaryColor || "#1d4ed8";
  const initialPageBg = project?.theme?.colors?.pageBg || project?.theme?.backgroundColor || "#f8fafc";
  const initialCardBg = project?.theme?.colors?.cardBg || "#ffffff";
  const initialTextColor = project?.theme?.colors?.textColor || "#111827";

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
        secondary: initialSecondaryColor,
        pageBg: initialPageBg,
        cardBg: initialCardBg,
        textColor: initialTextColor,
      },
      // Дублируем для легаси профилей
      primaryColor: initialPrimaryColor,
      secondaryColor: initialSecondaryColor,
      backgroundColor: initialPageBg,
    },
    features: {
      ...project?.features,
      streaks: project?.features?.streaks || project?.features?.hasStreaks || false,
      titles: project?.features?.titles || project?.features?.hasTitles || false,
      leaderboard: project?.features?.leaderboard || project?.features?.hasLeaderboard || false,
      avatars: project?.features?.avatars || project?.features?.hasAvatars || false,
      profileProgress: project?.features?.profileProgress || false,
      requestMode: project?.features?.requestMode || false,
      // Дублируем старые ключи для обратной совместимости
      hasStreaks: project?.features?.streaks || project?.features?.hasStreaks || false,
      hasTitles: project?.features?.titles || project?.features?.hasTitles || false,
      hasLeaderboard: project?.features?.leaderboard || project?.features?.hasLeaderboard || false,
    }
  });

  const [levels, setLevels] = useState<any[]>([]);
  const [newLevel, setNewLevel] = useState({ code: "", label: "" });

  const [tabs, setTabs] = useState<any[]>([]);
  const [editingTab, setEditingTab] = useState<any | null>(null);

  useEffect(() => {
    if (project?.id) {
      fetch(`/api/admin/projects/${project.id}/levels`)
        .then(r => r.json())
        .then(d => setLevels(d.levels || d.data || []));
      
      fetch(`/api/admin/projects/${project.id}/tabs`)
        .then(r => r.json())
        .then(d => setTabs(d.tabs || []));
    }
  }, [project]);

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
      const refreshRes = await fetch(`/api/admin/projects/${project.id}/tabs`);
      const refreshData = await refreshRes.json();
      setTabs(refreshData.tabs || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  const handleThemeChange = (colorKey: string, colorValue: string) => {
    setFormData(prev => {
      const newColors = { ...prev.theme.colors, [colorKey]: colorValue };
      return {
        ...prev,
        theme: {
          ...prev.theme,
          colors: newColors,
          primaryColor: newColors.primary,
          secondaryColor: newColors.secondary,
          backgroundColor: newColors.pageBg
        }
      };
    });
  };

  const ColorPicker = ({ label, colorKey, value }: { label: string, colorKey: string, value: string }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-xl">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-gray-500 uppercase">{value}</span>
        <input 
          type="color" 
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" 
          value={value} 
          onChange={e => handleThemeChange(colorKey, e.target.value)} 
        />
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">{project ? `Настройка ветки: ${project.name}` : "Новая ветка"}</h2>
        <button onClick={onClose} className="text-gray-500 font-bold hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">Закрыть</button>
      </div>

      <form onSubmit={saveProject} className="space-y-8">
        {/* БАЗОВЫЕ НАСТРОЙКИ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">Название ветки</label>
            <input required className="w-full border-2 rounded-xl px-4 py-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Английский для детей" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">URL (Slug)</label>
            <input required className="w-full border-2 rounded-xl px-4 py-2" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="kids-english" />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-bold mb-1">Описание на портале</label>
            <textarea className="w-full border-2 rounded-xl px-4 py-2" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Лучшие материалы для изучения..." />
          </div>
        </div>

        {/* ДИЗАЙН СИСТЕМА И ПРЕВЬЮ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold mb-1">🎨 Дизайн-система (Theme)</h3>
              <p className="text-sm text-gray-500 mb-4">Настройте цвета, которые будут применяться ко всей ветке.</p>
            </div>
            <div className="space-y-2">
              <ColorPicker label="Основной (Кнопки, Акценты)" colorKey="primary" value={formData.theme.colors.primary} />
              <ColorPicker label="Второстепенный (Ховеры, Градиенты)" colorKey="secondary" value={formData.theme.colors.secondary} />
              <ColorPicker label="Фон страницы" colorKey="pageBg" value={formData.theme.colors.pageBg} />
              <ColorPicker label="Фон карточек" colorKey="cardBg" value={formData.theme.colors.cardBg} />
              <ColorPicker label="Цвет текста" colorKey="textColor" value={formData.theme.colors.textColor} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold mb-1">👀 Живое превью</h3>
            <p className="text-sm text-gray-500 mb-4">Так будет выглядеть интерфейс для ученика.</p>
            
            {/* ИНТЕРАКТИВНАЯ ПРЕВЬЮШКА */}
            <div 
              className="rounded-2xl border overflow-hidden shadow-inner transition-colors duration-300"
              style={{ backgroundColor: formData.theme.colors.pageBg, color: formData.theme.colors.textColor, minHeight: '300px' }}
            >
              {/* Фейковый Header */}
              <div className="flex items-center justify-between p-4 border-b border-black/5" style={{ backgroundColor: formData.theme.colors.cardBg }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: formData.theme.colors.primary }}>EK</div>
                  <div className="font-bold text-sm">{formData.name || "Название ветки"}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs">👤</div>
              </div>

              {/* Фейковый контент */}
              <div className="p-5 space-y-5">
                {/* Фейковые табы */}
                <div className="flex gap-2">
                  <div className="px-4 py-1.5 rounded-full text-sm font-bold text-white shadow-sm" style={{ backgroundColor: formData.theme.colors.primary }}>
                    📚 Раздел 1
                  </div>
                  <div className="px-4 py-1.5 rounded-full text-sm font-bold opacity-70" style={{ backgroundColor: formData.theme.colors.cardBg, color: formData.theme.colors.textColor }}>
                    🧩 Раздел 2
                  </div>
                </div>

                {/* Фейковая карточка материала */}
                <div className="p-4 rounded-xl shadow-sm border border-black/5" style={{ backgroundColor: formData.theme.colors.cardBg }}>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: formData.theme.colors.pageBg }}>📘</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">Пример учебника</div>
                      <div className="text-xs opacity-60 mb-2 mt-0.5">Описание материала...</div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: formData.theme.colors.pageBg }}>
                        <div className="h-full w-2/3" style={{ backgroundColor: formData.theme.colors.primary }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Фейковая кнопка */}
                <div 
                  className="w-full py-2.5 rounded-xl text-center text-sm font-bold text-white shadow-md"
                  style={{ background: `linear-gradient(135deg, ${formData.theme.colors.primary}, ${formData.theme.colors.secondary})` }}
                >
                  🚀 Начать обучение
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ФИЧИ (ГЕЙМИФИКАЦИЯ) */}
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 border-t pt-6">
          <h3 className="font-bold text-blue-900 mb-1 text-lg">🎮 Модули платформы (Геймификация)</h3>
          <p className="text-sm text-blue-700/70 mb-4">Включите или отключите механики для этой ветки.</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={formData.features.streaks} onChange={() => toggleFeature('streaks', 'hasStreaks')} /> 
              <span className="font-bold text-gray-800">🔥 Огненные стрики</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={formData.features.titles} onChange={() => toggleFeature('titles', 'hasTitles')} /> 
              <span className="font-bold text-gray-800">👑 Титулы</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={formData.features.leaderboard} onChange={() => toggleFeature('leaderboard', 'hasLeaderboard')} /> 
              <span className="font-bold text-gray-800">🏆 Лидерборд</span>
            </label>
          </div>
        </div>

        <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 transition-colors text-white font-extrabold py-3.5 rounded-xl shadow-md">
          💾 Сохранить ядро проекта
        </button>
      </form>

      {/* ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ (УРОВНИ И ТАБЫ) */}
      {project?.id && (
        <div className="space-y-8 border-t pt-8">
          {/* УПРАВЛЕНИЕ УРОВНЯМИ */}
          <div className="bg-gray-50/50 p-6 rounded-3xl border">
            <h3 className="text-xl font-bold mb-4">Уровни (Классы)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              {levels.map(l => (
                <div key={l.id} className="bg-white border shadow-sm p-3 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-gray-800">{l.label}</span>
                  <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded-md">{l.code}</span>
                </div>
              ))}
              {levels.length === 0 && <div className="text-sm text-gray-500 col-span-full">Уровней пока нет</div>}
            </div>
            <div className="flex flex-wrap gap-3 bg-white p-4 rounded-2xl border shadow-sm">
              <input className="border-2 rounded-xl px-4 py-2 flex-1 min-w-[150px] outline-none focus:border-blue-500 font-medium" placeholder="Код (например: hippo-1)" value={newLevel.code} onChange={e => setNewLevel({...newLevel, code: e.target.value})} />
              <input className="border-2 rounded-xl px-4 py-2 flex-1 min-w-[150px] outline-none focus:border-blue-500 font-medium" placeholder="Название (например: Hippo 1)" value={newLevel.label} onChange={e => setNewLevel({...newLevel, label: e.target.value})} />
              <button onClick={addLevel} type="button" className="bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold px-6 py-2.5 rounded-xl shadow-sm">Добавить уровень</button>
            </div>
          </div>

          {/* УПРАВЛЕНИЕ ТАБАМИ (РАЗДЕЛАМИ) */}
          <div className="bg-gray-50/50 p-6 rounded-3xl border">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold">Разделы материалов (Табы)</h3>
              {!editingTab && (
                <button 
                  type="button"
                  onClick={() => setEditingTab({ title: "", slug: "", icon: "📄", order_index: tabs.length * 10, is_active: true, component_type: "materials" })}
                  className="bg-white hover:bg-gray-50 border shadow-sm transition-colors text-gray-800 px-5 py-2.5 rounded-xl font-bold text-sm"
                >
                  + Создать раздел
                </button>
              )}
            </div>

            {editingTab && (
              <form onSubmit={saveTab} className="bg-white p-6 rounded-2xl border shadow-md mb-6 relative">
                <h4 className="font-bold text-lg mb-4 text-gray-800">{editingTab.id ? "Редактирование раздела" : "Новый раздел"}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Название (Title)</label>
                    <input required className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500" placeholder="Напр: Грамматика" value={editingTab.title} onChange={e => setEditingTab({...editingTab, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL (Slug)</label>
                    <input required className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500 font-mono" placeholder="grammar" value={editingTab.slug} onChange={e => setEditingTab({...editingTab, slug: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Иконка (Emoji)</label>
                    <input className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500 text-xl" placeholder="📚" value={editingTab.icon || ""} onChange={e => setEditingTab({...editingTab, icon: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Порядок сортировки</label>
                    <input type="number" required className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500" value={editingTab.order_index} onChange={e => setEditingTab({...editingTab, order_index: Number(e.target.value)})} />
                  </div>
                </div>
                
                <label className="flex items-center gap-3 cursor-pointer font-bold mt-5 p-3 bg-gray-50 rounded-xl border w-fit">
                  <input type="checkbox" checked={editingTab.is_active} onChange={e => setEditingTab({...editingTab, is_active: e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                  <span className="text-sm">Отображать на сайте (Активен)</span>
                </label>
                
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-2.5 rounded-xl font-bold shadow-sm">Сохранить раздел</button>
                  <button type="button" onClick={() => setEditingTab(null)} className="bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors px-6 py-2.5 rounded-xl font-bold">Отмена</button>
                </div>
              </form>
            )}

            {!editingTab && tabs.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-4 font-bold text-gray-600">Раздел</th>
                      <th className="p-4 font-bold text-gray-600 text-center w-24">Порядок</th>
                      <th className="p-4 font-bold text-gray-600 text-center w-32">Статус</th>
                      <th className="p-4 w-48"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tabs.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-base text-gray-800 flex items-center gap-2">
                            <span className="text-xl">{t.icon}</span> {t.title}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">/{t.slug}</div>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-600">{t.order_index}</td>
                        <td className="p-4 text-center">
                          {t.is_active 
                            ? <span className="text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded-md">Активен</span> 
                            : <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-md">Скрыт</span>
                          }
                        </td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button type="button" onClick={() => setEditingTab(t)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm">
                            Изменить
                          </button>
                          <button type="button" onClick={() => deleteTab(t.id)} className="bg-red-50 text-red-600 hover:bg-red-100 transition-colors px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm">
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!editingTab && tabs.length === 0 && (
              <div className="text-sm text-gray-500 bg-white border border-dashed rounded-2xl p-8 text-center font-bold">
                Вкладок пока нет. Создайте первую, чтобы начать загружать материалы!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}