// app/(admin)/admin/projects/MaterialsManager.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import RoadmapImportPanel from "./RoadmapImportPanel";
import RoadmapVisualEditor from "./RoadmapVisualEditor";
import RoadmapCertificatePanel from "./RoadmapCertificatePanel";

export default function MaterialsManager() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string>("");
  
  const [tabs, setTabs] = useState<any[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>("");
  
  const [levels, setLevels] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);

  const [uploadingCover, setUploadingCover] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((d) => {
        const projList = d.projects || d || [];
        setProjects(projList);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setTabs([]);
      setLevels([]);
      setMaterials([]);
      setSelectedTabId("");
      setSelectedProjectSlug("");
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    setSelectedProjectSlug(project?.slug || "");

    Promise.all([
      fetch(`/api/admin/projects/${selectedProjectId}/tabs`).then((r) => r.json()),
      fetch(`/api/admin/projects/${selectedProjectId}/levels`).then((r) => r.json()),
    ]).then(([tabsData, levelsData]) => {
      setTabs(tabsData.tabs || []);
      setLevels(levelsData.levels || levelsData.data || []);
      setSelectedTabId(""); 
    });
  }, [selectedProjectId, projects]);

  // Все материалы проекта (без фильтра по табу) — для селектора «Привязать PRO-тариф».
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectMaterials([]);
      return;
    }
    fetch(`/api/admin/projects/${selectedProjectId}/materials`)
      .then((r) => r.json())
      .then((d) => setProjectMaterials(d.materials || []));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedTabId) {
      setMaterials([]);
      return;
    }
    fetch(`/api/admin/projects/${selectedProjectId}/materials?tab_id=${selectedTabId}`)
      .then((r) => r.json())
      .then((d) => setMaterials(d.materials || []));
  }, [selectedProjectId, selectedTabId]);

  const toggleLevel = (code: string) => {
    const current = editingMaterial.target_levels || [];
    const updated = current.includes(code)
      ? current.filter((c: string) => c !== code)
      : [...current, code];
    setEditingMaterial({ 
      ...editingMaterial, 
      target_levels: updated,
      class_levels: updated,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingMaterial.id;
    const url = isEdit 
      ? `/api/admin/materials/${editingMaterial.id}` 
      : `/api/admin/materials`;
    
    const project = projects.find(p => p.id === selectedProjectId);
    const branchType = project?.slug || "general";

    const levelCodes = editingMaterial.target_levels || [];

    const payload = {
      ...editingMaterial,
      branch_type: branchType,
      price: Number(editingMaterial.price) || 1000,
      is_secret: Boolean(editingMaterial.is_secret),
      is_demo: Boolean(editingMaterial.is_demo),
      is_pro: Boolean(editingMaterial.is_pro),
      pro_material_id: editingMaterial.is_pro ? null : (editingMaterial.pro_material_id || null),
      checkout_description: editingMaterial.checkout_description || null,
      material_kind: editingMaterial.is_roadmap ? "roadmap" : (editingMaterial.material_kind || "material"),
      project_tab_id: selectedTabId === "none" || !selectedTabId ? null : selectedTabId,
      class_levels: levelCodes,
      target_levels: levelCodes,
    };

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }
      
      setEditingMaterial(null);
      const mRes = await fetch(`/api/admin/projects/${selectedProjectId}/materials?tab_id=${selectedTabId}`);
      const mData = await mRes.json();
      setMaterials(mData.materials || []);
    } catch (err: any) {
      alert("Ошибка: " + err.message);
    }
  };

  const handleDelete = async (materialId: string, materialTitle: string) => {
    const okConfirm = window.confirm(`Удалить материал "${materialTitle}" безвозвратно?`);
    if (!okConfirm) return;

    try {
      const res = await fetch(`/api/admin/materials/${materialId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }

      const mRes = await fetch(`/api/admin/projects/${selectedProjectId}/materials?tab_id=${selectedTabId}`);
      const mData = await mRes.json();
      setMaterials(mData.materials || []);
    } catch (err: any) {
      alert("Ошибка удаления: " + err.message);
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
      formData.append("bucket", "covers"); 
      formData.append("folder", "materials");

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Сбой загрузки на сервер");

      const directUrl = json.publicUrl || json.url || json.imageUrl;
      setEditingMaterial({ ...editingMaterial, cover_image_url: directUrl });
    } catch (e: any) {
      alert("Ошибка загрузки обложки: " + e.message);
    } finally {
      setUploadingCover(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const openEdit = (material: any) => {
    const currentLevels = Array.from(
      new Set([
        ...(Array.isArray(material.target_levels) ? material.target_levels : []),
        ...(Array.isArray(material.class_levels) ? material.class_levels : []),
      ])
    );
    setEditingMaterial({
      ...material,
      target_levels: currentLevels,
      class_levels: currentLevels,
      is_demo: Boolean(material.is_demo),
      is_pro: Boolean(material.is_pro),
      pro_material_id: material.pro_material_id ? String(material.pro_material_id) : null,
      checkout_description: material.checkout_description ? String(material.checkout_description) : "",
      is_roadmap: material.material_kind === "roadmap",
    });
  };

  type ProOptionRow = { id?: string | number; is_pro?: boolean; title?: string };
  const proOptions = (projectMaterials || []).filter((m: ProOptionRow) => {
    const id = String(m?.id ?? "");
    return Boolean(m?.is_pro) && id !== String(editingMaterial?.id || "");
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">1. Проект (Ветка)</label>
          <select 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)} 
            className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-gray-50 font-bold"
          >
            <option value="">-- Выберите ветку --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">2. Вкладка (Таб)</label>
          <select 
            value={selectedTabId} 
            onChange={e => setSelectedTabId(e.target.value)} 
            disabled={!selectedProjectId} 
            className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-gray-50 font-bold disabled:opacity-50"
          >
            <option value="">-- Сначала таб --</option>
            {tabs.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        <button
          disabled={!selectedTabId}
          onClick={() => setEditingMaterial({ 
            title: "", 
            description: "", 
            cover_image_url: "", 
            price: 1000,
            target_levels: [], 
            class_levels: [],
            is_active: true, 
            is_available: false, 
            is_secret: false,
            is_demo: false,
            is_pro: false,
            pro_material_id: null,
            checkout_description: "",
            order_index: 0,
            material_kind: "material",
            is_roadmap: false,
          })}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Создать материал
        </button>
      </div>

      {editingMaterial && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border shadow-md space-y-6">
          <h3 className="text-xl font-bold">{editingMaterial.id ? "Редактирование" : "Новый материал"}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1">Название</label>
              <input 
                required 
                type="text" 
                className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500" 
                value={editingMaterial.title} 
                onChange={e => setEditingMaterial({...editingMaterial, title: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Цена (руб.)</label>
              <input 
                required 
                type="number" 
                min="0"
                className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500" 
                value={editingMaterial.price ?? 1000} 
                onChange={e => setEditingMaterial({...editingMaterial, price: Number(e.target.value)})} 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1">Обложка (Cover Image)</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 border-2 rounded-xl px-4 py-2" 
                    placeholder="URL картинки..." 
                    value={editingMaterial.cover_image_url || ""} 
                    onChange={e => setEditingMaterial({...editingMaterial, cover_image_url: e.target.value})} 
                  />
                  
                  <input 
                    ref={fileRef} 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onPickCover(file);
                    }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileRef.current?.click()} 
                    disabled={uploadingCover} 
                    className="bg-gray-100 hover:bg-gray-200 border-2 text-gray-700 px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-colors"
                  >
                    {uploadingCover ? "Загрузка..." : "Загрузить файл"}
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
              <label className="block text-sm font-bold mb-1">Описание курса (общее, description)</label>
              <textarea 
                className="w-full border-2 rounded-xl px-4 py-2" 
                rows={2} 
                value={editingMaterial.description || ""} 
                onChange={e => setEditingMaterial({...editingMaterial, description: e.target.value})} 
              />
              <p className="text-xs text-gray-400 font-medium mt-1">
                Академическое описание: темы курса, уровень языка, для кого предназначен. Используется по всей платформе.
              </p>
            </div>

            <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl border flex flex-col gap-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                  checked={Boolean(editingMaterial.is_pro)}
                  onChange={(e) =>
                    setEditingMaterial({
                      ...editingMaterial,
                      is_pro: e.target.checked,
                      pro_material_id: e.target.checked ? null : editingMaterial.pro_material_id,
                    })
                  }
                />
                PRO-версия (скрыть из каталога витрины)
              </label>

              {!editingMaterial.is_pro && (
                <div>
                  <label className="block text-sm font-bold mb-1 text-gray-700">
                    Привязать PRO-тариф (pro_material_id)
                  </label>
                  <select
                    className="w-full border-2 rounded-xl px-4 py-2 bg-white outline-none"
                    value={editingMaterial.pro_material_id || ""}
                    onChange={(e) =>
                      setEditingMaterial({
                        ...editingMaterial,
                        pro_material_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— Без PRO-версии —</option>
                    {proOptions.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.title || "Материал"} (PRO)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    В списке — только PRO-материалы этой же ветки. На карточке появится цена «от …», а в заявке — выбор тарифа.
                  </p>
                </div>
              )}

              {Boolean(editingMaterial.is_pro) && (
                <p className="text-xs text-amber-600 font-semibold">
                  Материал отмечен как PRO и не показывается отдельной карточкой в витрине и списках ученика.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1">
                Описание тарифа в заявке (checkout_description)
              </label>
              <textarea
                className="w-full border-2 rounded-xl px-4 py-2"
                rows={4}
                placeholder="Коммерческое описание формата и тарифа для модалки заявки: УТП, формат доступа, система звёзд, экзамены, сертификаты."
                value={editingMaterial.checkout_description || ""}
                onChange={(e) =>
                  setEditingMaterial({ ...editingMaterial, checkout_description: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Уровни доступа (Классы)</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border">
              {levels.length === 0 ? (
                <span className="text-red-500 text-sm font-bold">Добавьте уровни в настройках проекта</span>
              ) : (
                levels.map(lvl => {
                  const isChecked = (editingMaterial.target_levels || []).includes(lvl.code);
                  return (
                    <label 
                      key={lvl.id} 
                      className={`px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                        isChecked ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white hover:bg-gray-100'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={isChecked} 
                        onChange={() => toggleLevel(lvl.code)} 
                      />
                      {lvl.label}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-6 p-4 bg-gray-50 rounded-xl border">
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" 
                checked={editingMaterial.is_active} 
                onChange={e => setEditingMaterial({...editingMaterial, is_active: e.target.checked})} 
              />
              Отображать на сайте (is_active)
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" 
                checked={editingMaterial.is_available} 
                onChange={e => setEditingMaterial({...editingMaterial, is_available: e.target.checked})} 
              />
              Доступен всем без заявок (is_available)
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-700">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500" 
                checked={Boolean(editingMaterial.is_secret)} 
                onChange={e => setEditingMaterial({...editingMaterial, is_secret: e.target.checked})} 
              />
              Секретный материал (is_secret)
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-700">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500" 
                checked={Boolean(editingMaterial.is_demo)} 
                onChange={e => setEditingMaterial({...editingMaterial, is_demo: e.target.checked})} 
              />
              Демо-материал (is_demo — единственный на систему)
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-sky-700">
              <input
                type="checkbox"
                className="w-5 h-5 rounded text-sky-600 focus:ring-sky-500"
                checked={Boolean(editingMaterial.is_roadmap) || editingMaterial.material_kind === "roadmap"}
                onChange={(e) => setEditingMaterial({
                  ...editingMaterial,
                  is_roadmap: e.target.checked,
                  material_kind: e.target.checked ? "roadmap" : "material",
                })}
              />
              Roadmap-курс (блоки, звезды, экзамены)
            </label>
          </div>

          {editingMaterial.id && (editingMaterial.is_roadmap || editingMaterial.material_kind === "roadmap") ? (
            <>
              <RoadmapVisualEditor materialId={editingMaterial.id} materialTitle={editingMaterial.title || "Материал"} />
              <RoadmapCertificatePanel materialId={editingMaterial.id} materialTitle={editingMaterial.title || "Материал"} />
              <RoadmapImportPanel materialId={editingMaterial.id} materialTitle={editingMaterial.title || "Материал"} />
            </>
          ) : null}

          <div className="flex gap-4">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-2.5 rounded-xl font-bold">
              Сохранить
            </button>
            <button 
              type="button" 
              onClick={() => setEditingMaterial(null)} 
              className="bg-gray-200 hover:bg-gray-300 transition-colors text-gray-800 px-6 py-2.5 rounded-xl font-bold"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {!editingMaterial && selectedProjectId && selectedTabId && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-bold text-gray-600">Название</th>
                <th className="p-4 font-bold text-gray-600">Уровни</th>
                <th className="p-4 font-bold text-gray-600 text-center">Цена</th>
                <th className="p-4 font-bold text-gray-600 text-center">Статус</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500 font-bold bg-gray-50/50">
                    В этом разделе пока нет материалов. Создайте первый!
                  </td>
                </tr>
              ) : (
                materials.map(mat => {
                  const displayLevels = Array.from(
                    new Set([
                      ...(Array.isArray(mat.target_levels) ? mat.target_levels : []),
                      ...(Array.isArray(mat.class_levels) ? mat.class_levels : []),
                    ])
                  );

                  return (
                    <tr key={mat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold flex items-center gap-4">
                        {mat.cover_image_url ? (
                          <img src={mat.cover_image_url} alt="" className="w-12 h-12 object-cover rounded-lg shadow-sm border" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 font-bold shadow-sm border">DOC</div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{mat.title}</span>
                            {mat.is_demo && (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                DEMO
                              </span>
                            )}
                            {mat.is_secret && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                Секретный
                              </span>
                            )}
                            {mat.material_kind === "roadmap" && (
                              <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                ROADMAP
                              </span>
                            )}
                            {mat.is_pro && (
                              <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                PRO
                              </span>
                            )}
                            {mat.pro_material_id && (
                              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                PRO-связь
                              </span>
                            )}
                          </div>
                          {mat.description && <div className="text-xs font-normal text-gray-500 mt-0.5 truncate max-w-xs">{mat.description}</div>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {displayLevels.map((code: string) => (
                            <span key={code} className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded uppercase">
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm font-bold text-gray-800">
                        {mat.price ?? 1000} руб.
                      </td>
                      <td className="p-4 text-center text-sm font-bold">
                        {mat.is_available ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg">Всем</span> : <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg">По заявке</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => openEdit(mat)} 
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-bold transition-colors"
                          >
                            Изменить
                          </button>
                          <button 
                            onClick={() => void handleDelete(mat.id, mat.title)} 
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold transition-colors" 
                            title="Удалить"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}