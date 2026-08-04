"use client";

import React, { useState, useEffect } from "react";

interface MaterialItem {
  id: string;
  title: string;
  is_secret?: boolean;
  kind?: "textbook" | "crossword" | string;
  has_access?: boolean;
  is_unlocked?: boolean;
  unlocked?: boolean;
  already_unlocked?: boolean;
  cover_image_url?: string | null;
  target_levels?: string[] | null;
  class_levels?: string[] | null;
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

  // Фильтры в стиле Заявок
  const [activeKind, setActiveKind] = useState<string>("all");
  const [selectedLevelFilter, setSelectedLevelCode] = useState<string>("all");

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

  // Рассчитываем уникальные уровни для фильтра чипсов (Hippo 1-4, CEFR, и т.д.)
  const availableLevels = Array.from(
    new Set(
      materials.flatMap((m) => [...(m.target_levels || []), ...(m.class_levels || [])])
    )
  ).filter(Boolean);

  // Отфильтрованные материалы
  const filteredMaterials = materials.filter((m) => {
    const matchKind = activeKind === "all" || m.kind === activeKind;
    const levels = [...(m.target_levels || []), ...(m.class_levels || [])];
    const matchLevel =
      selectedLevelFilter === "all" ||
      levels.some((l) => l.toLowerCase() === selectedLevelFilter.toLowerCase());

    return matchKind && matchLevel;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className="rounded-[32px] max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden relative border transition-all"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
        }}
      >
        {/* Шапка модалки */}
        <div
          className="flex justify-between items-start border-b pb-4"
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider">
              Выбор материалов по промокоду
            </h3>
            <p className="text-xs font-medium opacity-60 mt-1">
              Выберите {requiredChoiceCount} материал(а) для получения доступа:
            </p>
          </div>
          <div
            className="font-mono text-xs font-black px-3 py-1.5 border rounded-xl uppercase tracking-wider"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
              borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
              color: "var(--project-primary, #0ea5e9)",
            }}
          >
            Выбрано: {selectedMaterialIds.length} / {requiredChoiceCount}
          </div>
        </div>

        {/* Выбор проекта/раздела */}
        {projects.length > 1 && (
          <div
            className="flex gap-2 border-b pb-3 overflow-x-auto"
            style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
          >
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
                      : "var(--glass-border, rgba(15, 23, 42, 0.1))",
                  color:
                    selectedProjectId === p.id ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Фильтры в стиле Заявок (Витрина / Чипсы уровней) */}
        <div className="space-y-3">
          {/* Чипсы категорий (Учебники / Кроссворды) */}
          <div className="flex gap-2">
            {[
              { id: "all", label: "Все категории" },
              { id: "textbook", label: "📚 Учебники" },
              { id: "crossword", label: "🧩 Кроссворды" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveKind(tab.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border"
                style={{
                  backgroundColor:
                    activeKind === tab.id
                      ? "var(--project-primary, #0ea5e9)"
                      : "color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent)",
                  borderColor:
                    activeKind === tab.id
                      ? "var(--project-primary, #0ea5e9)"
                      : "var(--glass-border, rgba(15, 23, 42, 0.1))",
                  color: activeKind === tab.id ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Чипсы уровней (Hippo 1-4, CEFR...) */}
          {availableLevels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedLevelCode("all")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
                style={{
                  backgroundColor:
                    selectedLevelFilter === "all"
                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 20%, transparent)"
                      : "transparent",
                  borderColor:
                    selectedLevelFilter === "all"
                      ? "var(--project-primary, #0ea5e9)"
                      : "var(--glass-border, rgba(15, 23, 42, 0.1))",
                  color: "var(--project-text, #0f172a)",
                }}
              >
                Все уровни
              </button>
              {availableLevels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevelCode(lvl)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
                  style={{
                    backgroundColor:
                      selectedLevelFilter === lvl
                        ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 20%, transparent)"
                        : "transparent",
                    borderColor:
                      selectedLevelFilter === lvl
                        ? "var(--project-primary, #0ea5e9)"
                        : "var(--glass-border, rgba(15, 23, 42, 0.1))",
                    color: "var(--project-text, #0f172a)",
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Список материалов в виде карточек */}
        <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
          {loading ? (
            <div className="col-span-full text-center py-12 text-xs font-bold uppercase tracking-wider opacity-60">
              Загрузка каталога материалов...
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="col-span-full text-center py-12 text-xs font-bold uppercase tracking-wider opacity-60">
              Материалы не найдены
            </div>
          ) : (
            filteredMaterials.map((m) => {
              const unlocked = isAlreadyUnlocked(m);
              const isSelected = selectedMaterialIds.includes(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleMaterial(m)}
                  className="p-3.5 rounded-2xl border flex items-center justify-between transition-all"
                  style={{
                    backgroundColor: unlocked
                      ? "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)"
                      : isSelected
                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)"
                      : "color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent)",
                    borderColor: isSelected
                      ? "var(--project-primary, #0ea5e9)"
                      : "var(--glass-border, rgba(15, 23, 42, 0.1))",
                    opacity: unlocked ? 0.6 : 1,
                    cursor: unlocked ? "not-allowed" : "pointer",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {/* Обложка / Иконка */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
                        borderColor: "var(--glass-border, rgba(15, 23, 42, 0.1))",
                      }}
                    >
                      {m.cover_image_url ? (
                        <img
                          src={m.cover_image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">
                          {m.kind === "crossword" ? "🧩" : "📚"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-extrabold text-xs truncate">
                        {m.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {m.is_secret && (
                          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                            ★ Секретный
                          </span>
                        )}
                        {unlocked && (
                          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                            ✓ Доступ есть
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Чекбокс кнопка */}
                  <div
                    className="w-7 h-7 rounded-xl border flex items-center justify-center flex-shrink-0 font-bold text-xs transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? "var(--project-primary, #0ea5e9)"
                        : "transparent",
                      borderColor: isSelected
                        ? "var(--project-primary, #0ea5e9)"
                        : "var(--glass-border, rgba(15, 23, 42, 0.2))",
                      color: isSelected ? "#ffffff" : "var(--project-text, #0f172a)",
                    }}
                  >
                    {unlocked ? "✓" : isSelected ? "✓" : "+"}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Панель действий */}
        <div
          className="flex justify-end gap-3 pt-3 border-t"
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
              borderColor: "var(--glass-border, rgba(15, 23, 42, 0.1))",
              color: "var(--project-text, #0f172a)",
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmitChoice}
            disabled={
              submitting || selectedMaterialIds.length < requiredChoiceCount
            }
            className="px-5 py-2 text-white font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-md"
            style={{
              backgroundColor: "var(--project-primary, #0ea5e9)",
            }}
          >
            {submitting ? "Сохранение..." : "Подтвердить выбор"}
          </button>
        </div>
      </div>
    </div>
  );
}
