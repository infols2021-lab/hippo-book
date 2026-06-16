"use client";

import { useState, useEffect } from "react";

export default function ProjectEditor({ project, onClose, onSaved }: { project: any, onClose: () => void, onSaved: () => void }) {
  const [formData, setFormData] = useState({
    name: project?.name || "",
    slug: project?.slug || "",
    description: project?.description || "",
    is_active: project?.is_active ?? true,
    theme: project?.theme || { primaryColor: "#3b82f6", secondaryColor: "#1d4ed8" },
    features: project?.features || { hasStreaks: false, hasTitles: false, hasLeaderboard: false }
  });

  const [levels, setLevels] = useState<any[]>([]);
  const [newLevel, setNewLevel] = useState({ code: "", name: "" });

  useEffect(() => {
    if (project?.id) {
      fetch(`/api/admin/projects/${project.id}/levels`).then(r => r.json()).then(d => setLevels(d.levels || []));
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
    if (!newLevel.code || !newLevel.name || !project?.id) return;
    const res = await fetch(`/api/admin/projects/${project.id}/levels`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level_code: newLevel.code, name: newLevel.name, order_index: levels.length * 10, is_active: true })
    });
    const d = await res.json();
    if (d.ok) {
      setLevels([...levels, d.level]); // или сделай повторный fetch
      setNewLevel({ code: "", name: "" });
    }
  };

  const toggleFeature = (key: string) => {
    setFormData(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
  };

  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">{project ? `Настройка ветки: ${project.name}` : "Новая ветка"}</h2>
        <button onClick={onClose} className="text-gray-500 font-bold hover:bg-gray-100 px-4 py-2 rounded-lg">Закрыть</button>
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
            <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={formData.theme.primaryColor} onChange={e => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})} />
          </div>
        </div>

        {/* ФИЧИ */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-3">Модули платформы (Геймификация)</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border"><input type="checkbox" checked={formData.features.hasStreaks} onChange={() => toggleFeature('hasStreaks')} /> 🔥 Огненные стрики</label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border"><input type="checkbox" checked={formData.features.hasTitles} onChange={() => toggleFeature('hasTitles')} /> 👑 Титулы</label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border"><input type="checkbox" checked={formData.features.hasLeaderboard} onChange={() => toggleFeature('hasLeaderboard')} /> 🏆 Лидерборд</label>
          </div>
        </div>

        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl">💾 Сохранить ядро проекта</button>
      </form>

      {/* УПРАВЛЕНИЕ УРОВНЯМИ */}
      {project?.id && (
        <div className="border-t pt-6">
          <h3 className="text-xl font-bold mb-4">Уровни (Классы) для этого проекта</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {levels.map(l => (
              <div key={l.id} className="bg-gray-50 border p-3 rounded-lg flex justify-between">
                <span className="font-bold">{l.name} <span className="text-xs text-gray-500 font-mono ml-2">({l.level_code})</span></span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 bg-gray-50 p-3 rounded-xl border">
            <input className="border-2 rounded-lg px-3 py-2 flex-1" placeholder="Код (hippo-1)" value={newLevel.code} onChange={e => setNewLevel({...newLevel, code: e.target.value})} />
            <input className="border-2 rounded-lg px-3 py-2 flex-1" placeholder="Название (Hippo 1)" value={newLevel.name} onChange={e => setNewLevel({...newLevel, name: e.target.value})} />
            <button onClick={addLevel} type="button" className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg">Добавить</button>
          </div>
        </div>
      )}
    </div>
  );
}