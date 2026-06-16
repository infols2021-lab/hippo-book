"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js"; // Используем клиентский supabase, если у тебя настроен

// Временный клиент для запросов (замени на свой, если используешь другой)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminTabsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [tabs, setTabs] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Форма
  const [editingTab, setEditingTab] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", slug: "", icon: "📄", is_active: true, order_index: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // 1. Загружаем проекты
  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase.from("projects").select("id, name").order("created_at");
      if (data) {
        setProjects(data);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      }
      setIsLoading(false);
    }
    loadProjects();
  }, []);

  // 2. Загружаем табы при выборе проекта
  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadTabs() {
      const { data } = await supabase
        .from("project_tabs")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("order_index");
      if (data) setTabs(data);
    }
    loadTabs();
  }, [selectedProjectId]);

  const handleEdit = (tab: any) => {
    setEditingTab(tab);
    setFormData({ 
      name: tab.name, 
      slug: tab.slug, 
      icon: tab.icon || "📄", 
      is_active: tab.is_active, 
      order_index: tab.order_index 
    });
  };

  const handleCreateNew = () => {
    setEditingTab(null);
    setFormData({ name: "", slug: "", icon: "📄", is_active: true, order_index: tabs.length * 10 });
  };

  const saveTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const res = await fetch("/api/admin/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTab?.id,
          project_id: selectedProjectId,
          ...formData
        })
      });
      
      if (!res.ok) throw new Error("Ошибка сохранения");
      
      // Обновляем список локально
      const { data } = await supabase.from("project_tabs").select("*").eq("project_id", selectedProjectId).order("order_index");
      if (data) setTabs(data);
      
      setEditingTab(null);
      handleCreateNew();
      alert("Сохранено!");
    } catch (error) {
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTab = async (id: string) => {
    if (!confirm("Точно удалить этот раздел?")) return;
    try {
      await fetch(`/api/admin/tabs?id=${id}`, { method: "DELETE" });
      setTabs(tabs.filter(t => t.id !== id));
    } catch (e) {
      alert("Ошибка удаления");
    }
  };

  if (isLoading) return <div className="p-10">Загрузка...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🗂 Управление разделами (Табами)</h1>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
        <span className="font-bold">Ветка (Проект):</span>
        <select 
          className="border-2 rounded-xl px-4 py-2 bg-gray-50 outline-none min-w-[250px]"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* СПИСОК ТАБОВ */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold mb-4">Существующие табы</h2>
          {tabs.length === 0 ? (
            <div className="p-10 bg-gray-50 rounded-2xl border-2 border-dashed text-center text-gray-500">
              В этом проекте пока нет табов. Создайте первый справа!
            </div>
          ) : (
            tabs.map(tab => (
              <div key={tab.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{tab.icon}</div>
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {tab.name} 
                      {!tab.is_active && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded">Скрыт</span>}
                    </h3>
                    <div className="text-gray-400 text-sm font-mono">slug: {tab.slug} | сортировка: {tab.order_index}</div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(tab)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold">Изменить</button>
                  <button onClick={() => deleteTab(tab.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold">Удалить</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ФОРМА РЕДАКТИРОВАНИЯ */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm self-start sticky top-6">
          <h2 className="text-xl font-bold mb-6">
            {editingTab ? "✏️ Редактировать таб" : "➕ Новый таб"}
          </h2>
          <form onSubmit={saveTab} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Название (для UI)</label>
              <input required type="text" className="w-full border-2 rounded-xl px-4 py-2 bg-gray-50" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Напр: Учебники" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Slug (для URL)</label>
              <input required type="text" className="w-full border-2 rounded-xl px-4 py-2 bg-gray-50" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="Напр: textbooks" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Иконка (Эмодзи)</label>
                <input required type="text" className="w-full border-2 rounded-xl px-4 py-2 bg-gray-50" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Сортировка</label>
                <input required type="number" className="w-full border-2 rounded-xl px-4 py-2 bg-gray-50" value={formData.order_index} onChange={e => setFormData({...formData, order_index: Number(e.target.value)})} />
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
              <span className="font-bold text-gray-700">Активен (Виден юзерам)</span>
            </label>
            
            <div className="pt-4 flex gap-2">
              <button disabled={isSaving} type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                {isSaving ? "Сохранение..." : "💾 Сохранить"}
              </button>
              {editingTab && (
                <button type="button" onClick={handleCreateNew} className="px-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">
                  Отмена
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}