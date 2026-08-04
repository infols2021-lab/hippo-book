"use client";

import React, { useState, useEffect } from "react";

interface MaterialItem {
  id: string;
  title: string;
  is_secret?: boolean;
  kind?: "textbook" | "crossword";
  has_access?: boolean;
  is_unlocked?: boolean;
  unlocked?: boolean;
  already_unlocked?: boolean;
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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--project-card-bg, #0f172a)",
          color: "var(--project-text, #ffffff)",
        }}
      >
        {/* Шапка модалки */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider">
              Выбор награды по промокоду
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Выберите {requiredChoiceCount} материал(а) для получения бессрочного доступа:
            </p>
          </div>
          <div className="font-mono text-xs font-black px-3 py-1.5 bg-slate-950 border border-slate-800 text-emerald-400 rounded-xl uppercase tracking-wider">
            Выбрано: {selectedMaterialIds.length} / {requiredChoiceCount}
          </div>
        </div>

        {/* Выбор проекта/раздела */}
        {projects.length > 1 && (
          <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(p.id);
                  void loadMaterialsForProject(p.slug);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  selectedProjectId === p.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Сообщение, если все материалы уже доступны */}
        {allUnlockedInProject && !loading && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl text-center">
            <div className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-1">
              Все материалы доступны
            </div>
            <div className="text-xs text-slate-300 font-medium">
              Все учебные материалы текущего раздела уже открыты на вашем аккаунте.
            </div>
          </div>
        )}

        {/* Список материалов */}
        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">
              Загрузка каталога материалов...
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">
              В данном разделе нет доступных материалов
            </div>
          ) : (
            materials.map((m) => {
              const unlocked = isAlreadyUnlocked(m);
              const isSelected = selectedMaterialIds.includes(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleMaterial(m)}
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    unlocked
                      ? "bg-slate-950/50 border-slate-800/60 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "bg-emerald-950/30 border-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-500/10"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <span className="text-[10px] font-black px-2 py-1 bg-slate-800 text-slate-300 rounded-md uppercase tracking-wider flex-shrink-0">
                      {m.kind === "crossword" ? "Кроссворд" : "Учебник"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {m.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {m.is_secret && (
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            [Секретный]
                          </span>
                        )}
                        {unlocked && (
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                            [Доступ уже есть]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${
                      unlocked
                        ? "border-slate-800 bg-slate-900 text-slate-600"
                        : isSelected
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-700 bg-slate-900"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-4 h-4 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Панель действий */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmitChoice}
            disabled={
              submitting || selectedMaterialIds.length < requiredChoiceCount
            }
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20"
          >
            {submitting ? "Сохранение..." : "Подтвердить выбор"}
          </button>
        </div>
      </div>
    </div>
  );
}