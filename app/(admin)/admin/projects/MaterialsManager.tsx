"use client";

import { useState, useEffect, useRef } from "react";

export default function MaterialsManager() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  const [tabs, setTabs] = useState<any[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>("");
  
  const [levels, setLevels] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);

  // Для загрузки изображений
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // 1. Грузим проекты
  useEffect(() => {
    fetch("/api/admin/projects").then(r => r.json()).then(d => {
      setProjects(d.projects || d || []);
      setIsLoading(false);
    });
  }, []);

  // 2. Грузим Табы и Уровни при выборе Проекта
  useEffect(() => {
    if (!selectedProjectId) {
      setTabs([]); setLevels([]); setMaterials([]); setSelectedTabId("");
      return;
    }
    Promise.all([
      fetch(`/api/admin/projects/${selectedProjectId}/tabs`).then(r => r.json()),
      fetch(`/api/admin/projects/${selectedProjectId}/levels`).then(r => r.json()),
    ]).then(([tabsData, levelsData]) => {
      setTabs(tabsData.tabs || []);
      setLevels(levelsData.levels || levelsData.data || []);
      setSelectedTabId(""); // Сбрасываем таб при смене проекта
    });
  }, [selectedProjectId]);

  // 3. Грузим материалы при выборе Таба
  useEffect(() => {
    if (!selectedProjectId || !selectedTabId) {
      setMaterials([]);
      return;
    }
    fetch(`/api/admin/projects/${selectedProjectId}/materials?tab_id=${selectedTabId}`)
      .then(r => r.json())
      .then(d => setMaterials(d.materials || []));
  }, [selectedProjectId, selectedTabId]);

  const toggleLevel = (code: string) => {
    const current = editingMaterial.target_levels || [];
    const updated = current.includes(code) ? current.filter((c: string) => c !== code) : [...current, code];
    setEditingMaterial({ ...editingMaterial, target_levels: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingMaterial.id;
    const url = isEdit ? `/api/admin/projects/${selectedProjectId}/materials/${editingMaterial.id}` : `/api/admin/projects/${selectedProjectId}/materials`;
    
    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        // Обязательно передаем project_tab_id
        body: JSON.stringify({ ...editingMaterial, project_tab_id: selectedTabId }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      
      setEditingMaterial(null);
      // Обновляем список
      const mRes = await fetch(`/api/admin/projects/${selectedProjectId}/materials?tab_id=${selectedTabId}`);
      const mData = await mRes.json();
      setMaterials(mData.materials || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

  async function onPickCover(file: File) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const allowed = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
    if (!allowed.includes(ext)) {
      alert("Поддерживаются только изображения (JPG, PNG, WebP и т.д.)");
      return;
    }
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "materials"); // бакет для материалов
      formData.append("folder", "covers");

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Сбой загрузки");

      const directUrl = json.publicUrl || json.url || json.imageUrl;
      setEditingMaterial({ ...editingMaterial, cover_image_url: directUrl });
    } catch (e: any) {
      alert("❌ Ошибка загрузки обложки: " + e.message);
    } finally {
      setUploadingCover(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">1. Проект (Ветка)</label>
          <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-gray-50 font-bold">
            <option value="">-- Выберите ветку --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">2. Вкладка (Таб)</label>
          <select value={selectedTabId} onChange={e => setSelectedTabId(e.target.value)} disabled={!selectedProjectId} className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-gray-50 font-bold disabled:opacity-50">
            <option value="">-- Сначала таб --</option>
            {/* ИСПРАВЛЕНО: используем t.title вместо t.name */}
            {tabs.map(t => <option key={t.id} value={t.id}>{t.icon || ""} {t.title}</option>)}
          </select>
        </div>

        <button
          disabled={!selectedTabId}
          onClick={() => setEditingMaterial({ title: "", description: "", cover_image_url: "", target_levels: [], is_active: true, is_available: false, order_index: 0 })}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Создать материал
        </button>
      </div>

      {editingMaterial && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border shadow-md space-y-6">
          <h3 className="text-xl font-bold">{editingMaterial.id ? "Редактирование" : "Новый материал"}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Название</label>
              <input required type="text" className="w-full border-2 rounded-xl px-4 py-2" value={editingMaterial.title} onChange={e => setEditingMaterial({...editingMaterial, title: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-1">Обложка (Cover Image)</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input type="text" className="flex-1 border-2 rounded-xl px-4 py-2" placeholder="URL картинки..." value={editingMaterial.cover_image_url || ""} onChange={e => setEditingMaterial({...editingMaterial, cover_image_url: e.target.value})} />
                  
                  {/* ИНТЕГРИРОВАННАЯ ЗАГРУЗКА */}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onPickCover(file);
                  }} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingCover} className="bg-gray-100 hover:bg-gray-200 border-2 text-gray-700 px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-colors">
                    {uploadingCover ? "⌛" : "📁 Файл"}
                  </button>
                </div>
                {editingMaterial.cover_image_url && (
                  <div className="relative w-fit">
                    <img src={editingMaterial.cover_image_url} alt="Cover preview" className="h-20 rounded-lg object-cover border" />
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1">Описание (Description)</label>
              <textarea className="w-full border-2 rounded-xl px-4 py-2" rows={2} value={editingMaterial.description || ""} onChange={e => setEditingMaterial({...editingMaterial, description: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Уровни доступа (Классы)</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border">
              {levels.length === 0 ? <span className="text-red-500 text-sm">Добавьте уровни в настройках проекта</span> : levels.map(lvl => (
                // ИСПРАВЛЕНО: используем lvl.code и lvl.label
                <label key={lvl.id} className={`px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium ${editingMaterial.target_levels?.includes(lvl.code) ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white'}`}>
                  <input type="checkbox" className="hidden" checked={editingMaterial.target_levels?.includes(lvl.code)} onChange={() => toggleLevel(lvl.code)} />
                  {lvl.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6 p-4 bg-gray-50 rounded-xl border">
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input type="checkbox" className="w-5 h-5" checked={editingMaterial.is_active} onChange={e => setEditingMaterial({...editingMaterial, is_active: e.target.checked})} />
              Отображать на сайте (is_active)
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input type="checkbox" className="w-5 h-5" checked={editingMaterial.is_available} onChange={e => setEditingMaterial({...editingMaterial, is_available: e.target.checked})} />
              Доступен всем без заявок (is_available)
            </label>
          </div>

          <div className="flex gap-4">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Сохранить</button>
            <button type="button" onClick={() => setEditingMaterial(null)} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-xl font-bold">Отмена</button>
          </div>
        </form>
      )}

      {/* СПИСОК */}
      {materials.length > 0 && !editingMaterial && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-bold">Название</th>
                <th className="p-4 font-bold">Уровни</th>
                <th className="p-4 font-bold text-center">Статус</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.map(mat => (
                <tr key={mat.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold flex items-center gap-3">
                    {mat.cover_image_url && <img src={mat.cover_image_url} alt="" className="w-10 h-10 object-cover rounded shadow-sm" />}
                    {mat.title}
                  </td>
                  <td className="p-4 text-xs font-mono text-gray-500">{(mat.target_levels || []).join(", ")}</td>
                  <td className="p-4 text-center text-sm font-bold">
                    {mat.is_available ? <span className="text-green-600">Всем</span> : <span className="text-yellow-600">По заявке</span>}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => setEditingMaterial(mat)} className="text-blue-600 font-bold">Изменить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}