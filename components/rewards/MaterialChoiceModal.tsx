"use client";

import React, { useState, useEffect } from "react";

interface MaterialItem {
  id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  price?: number;
  is_secret?: boolean;
  kind?: string;
  has_access?: boolean;
  is_unlocked?: boolean;
  unlocked?: boolean;
  already_unlocked?: boolean;
  project_tab_id?: string | null;
}

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
}

interface MaterialChoiceModalProps {
  isOpen: boolean;
  promocodeCode: string;
  requiredChoiceCount: number;
  onClose: () => void;
}

export default function MaterialChoiceModal({
  isOpen,
  promocodeCode,
  requiredChoiceCount,
  onClose,
}: MaterialChoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const activeProjects: ProjectItem[] = data.projects || [];
        setProjects(activeProjects);
        if (activeProjects.length > 0) {
          setSelectedProjectId(activeProjects[0].id);
          void loadMaterialsForProject(activeProjects[0].slug);
        }
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterialsForProject = async (projectSlug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/materials`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
      }
    } catch (e) {
      console.error("Failed to load materials:", e);
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyUnlocked = (m: MaterialItem): boolean => {
    return Boolean(
      m.has_access || m.is_unlocked || m.unlocked || m.already_unlocked
    );
  };

  const handleToggleMaterial = (m: MaterialItem) => {
    if (isAlreadyUnlocked(m)) return;

    if (selectedMaterialIds.includes(m.id)) {
      setSelectedMaterialIds(selectedMaterialIds.filter((id) => id !== m.id));
    } else {
      if (selectedMaterialIds.length < requiredChoiceCount) {
        setSelectedMaterialIds([...selectedMaterialIds, m.id]);
      }
    }
  };

  const handleSubmitChoice = async () => {
    if (selectedMaterialIds.length < requiredChoiceCount) {
      alert(`Пожалуйста, выберите ${requiredChoiceCount} материал(а).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/promocodes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promocodeCode,
          chosenMaterialIds: selectedMaterialIds,
        }),
      });

      if (res.ok) {
        alert("Материалы успешно разблокированы!");
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения выбора");
      }
    } catch (e) {
      alert("Ошибка соединения с сервером");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allUnlockedInProject =
    materials.length > 0 && materials.every((m) => isAlreadyUnlocked(m));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="rounded-[32px] max-w-3xl w-full p-6 space-y-6 shadow-2xl overflow-hidden relative border transition-all"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
        }}
      >
        {/* Шапка модалки */}
        <div
          className="flex justify-between items-start border-b pb-4"
          style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
        >
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider">
              Выбор материалов по промокоду
            </h3>
            <p className="text-xs font-medium opacity-60 mt-1">
              Выберите {requiredChoiceCount} материал(а) для бесплатного бессрочного доступа:
            </p>
          </div>
          <div
            className="font-mono text-xs font-black px-3 py-1.5 border rounded-xl uppercase tracking-wider"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)",
              borderColor: "var(--project-primary, #0ea5e9)",
              color: "var(--project-primary, #0ea5e9)",
            }}
          >
            Выбрано: {selectedMaterialIds.length} / {requiredChoiceCount}
          </div>
        </div>

        {/* Выбор проекта/раздела */}
        {projects.length > 1 && (
          <div className="flex gap-2 border-b pb-3 overflow-x-auto" style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(p.id);
                  void loadMaterialsForProject(p.slug);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border"
                style={{
                  backgroundColor:
                    selectedProjectId === p.id
                      ? "var(--project-primary, #0ea5e9)"
                      : "color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent)",
                  borderColor:
                    selectedProjectId === p.id
                      ? "var(--project-primary, #0ea5e9)"
                      : "var(--glass-border, rgba(15,23,42,0.1))",
                  color: selectedProjectId === p.id ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Если все материалы уже открыты */}
        {allUnlockedInProject && !loading && (
          <div className="p-4 rounded-2xl border text-center" style={{ backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)" }}>
            <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "#10b981" }}>
              Все материалы уже открыты
            </div>
            <div className="text-xs font-medium opacity-75">
              Все учебные материалы текущего раздела уже присутствуют на вашем аккаунте.
            </div>
          </div>
        )}

        {/* Сетка материалов в стиле витрины */}
        <div className="max-h-80 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pr-1">
          {loading ? (
            <div className="col-span-full text-center py-12 text-xs font-bold uppercase tracking-wider opacity-60">
              Загрузка каталога материалов...
            </div>
          ) : materials.length === 0 ? (
            <div className="col-span-full text-center py-12 text-xs font-bold uppercase tracking-wider opacity-60">
              В данном разделе нет материалов
            </div>
          ) : (
            materials.map((m) => {
              const unlocked = isAlreadyUnlocked(m);
              const isSelected = selectedMaterialIds.includes(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleMaterial(m)}
                  className="p-3 rounded-2xl border flex flex-col justify-between transition-all"
                  style={{
                    backgroundColor: unlocked
                      ? "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)"
                      : isSelected
                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)"
                      : "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                    borderColor: unlocked
                      ? "var(--glass-border, rgba(15,23,42,0.06))"
                      : isSelected
                      ? "var(--project-primary, #0ea5e9)"
                      : "var(--glass-border, rgba(15,23,42,0.1))",
                    cursor: unlocked ? "not-allowed" : "pointer",
                    opacity: unlocked ? 0.6 : 1,
                  }}
                >
                  <div className="space-y-2">
                    <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center relative">
                      {m.cover_image_url ? (
                        <img
                          src={m.cover_image_url}
                          alt={m.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">📖</span>
                      )}
                    </div>

                    <div className="font-extrabold text-xs leading-snug line-clamp-2">
                      {m.title}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.06))" }}>
                    {unlocked ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                        ✅ Доступ есть
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg"
                        style={{
                          backgroundColor: isSelected
                            ? "var(--project-primary, #0ea5e9)"
                            : "color-mix(in srgb, var(--project-text, #0f172a) 8%, transparent)",
                          color: isSelected ? "#ffffff" : "var(--project-text, #0f172a)",
                        }}
                      >
                        {isSelected ? "✅ Выбрано" : "➕ Выбрать"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Кнопки модалки */}
        <div
          className="flex justify-end gap-3 pt-3 border-t"
          style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
              borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
              color: "var(--project-text, #0f172a)",
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmitChoice}
            disabled={submitting || selectedMaterialIds.length < requiredChoiceCount}
            className="px-5 py-2 font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-md"
            style={{
              backgroundColor: "var(--project-primary, #0ea5e9)",
              color: "#ffffff",
            }}
          >
            {submitting ? "Сохранение..." : "Подтвердить выбор"}
          </button>
        </div>
      </div>
    </div>
  );
}
