"use client";

import React, { useState, useEffect } from "react";

interface MaterialItem {
  id: string;
  title: string;
  is_secret?: boolean;
  kind?: "textbook" | "crossword" | string;
  hasAccess?: boolean;
  cover_image_url?: string | null;
  target_levels?: string[] | null;
  class_levels?: string[] | null;
  project_tab_id?: string | null;
}

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
}

interface ProjectTab {
  id: string;
  slug: string;
  title: string;
  icon?: string | null;
  orderIndex?: number;
}

export interface MaterialChoiceUnboxItem {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  asset_url?: string | null;
  meta?: Record<string, any>;
}

export interface MaterialChoiceSuccessResult {
  unboxItems: MaterialChoiceUnboxItem[];
  physicalPrize?: any | null;
}

interface MaterialChoiceModalProps {
  isOpen: boolean;
  promocodeCode: string;
  requiredChoiceCount: number;
  onClose: () => void;
  onSuccess: (result: MaterialChoiceSuccessResult) => void;
}

export default function MaterialChoiceModal({
  isOpen,
  promocodeCode,
  requiredChoiceCount,
  onClose,
  onSuccess,
}: MaterialChoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string>("");

  const [projectTabs, setProjectTabs] = useState<ProjectTab[]>([]);
  const [activeTabSlug, setActiveTabSlug] = useState<string>("all");

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [selectedLevelFilter, setSelectedLevelCode] = useState<string>("all");

  useEffect(() => {
    if (isOpen) {
      setSelectedMaterialIds([]);
      setSubmitError(null);
      void loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const activeProjects: ProjectItem[] = Array.isArray(data.projects)
          ? data.projects
          : Array.isArray(data)
          ? data
          : [];

        setProjects(activeProjects);

        if (activeProjects.length > 0) {
          await selectProject(activeProjects[0]);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
      setLoading(false);
    }
  };

  const isProjectSelected = (p: ProjectItem): boolean => {
    if (selectedProjectId && p.id && selectedProjectId === p.id) return true;
    if (selectedProjectSlug && p.slug && selectedProjectSlug === p.slug) return true;
    return false;
  };

  const selectProject = async (project: ProjectItem) => {
    const projId = project.id || project.slug || "";
    const projSlug = project.slug || project.id || "";

    setSelectedProjectId(projId);
    setSelectedProjectSlug(projSlug);
    setActiveTabSlug("all");
    setSelectedLevelCode("all");
    setLoading(true);

    try {
      const [tabsRes, materialsRes] = await Promise.all([
        fetch(`/api/projects/${projSlug}`),
        fetch(`/api/projects/${projSlug}/materials`),
      ]);

      if (tabsRes.ok) {
        const tabsData = await tabsRes.json();
        const rawTabs = tabsData?.project?.tabs || tabsData?.tabs || [];
        const tabs: ProjectTab[] = Array.isArray(rawTabs)
          ? rawTabs.slice().sort((a: ProjectTab, b: ProjectTab) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          : [];
        setProjectTabs(tabs);
      } else {
        setProjectTabs([]);
      }

      if (materialsRes.ok) {
        const materialsData = await materialsRes.json();
        const rawList = materialsData?.materials || materialsData?.data || [];
        setMaterials(Array.isArray(rawList) ? rawList : []);
      } else {
        setMaterials([]);
      }
    } catch (e) {
      console.error("Failed to load project tabs/materials:", e);
      setProjectTabs([]);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyUnlocked = (m: MaterialItem): boolean => {
    return Boolean(m.hasAccess);
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

  const handleSubmitChoice = async (skipChoice: boolean = false) => {
    if (!skipChoice && selectedMaterialIds.length < requiredChoiceCount) {
      setSubmitError(`Пожалуйста, выберите ${requiredChoiceCount} материал(а).`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/promocodes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promocodeCode,
          chosenMaterialIds: skipChoice ? [] : selectedMaterialIds,
          allowSkipIfAllUnlocked: skipChoice,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data && (data.ok || data.success)) {
        const chosenMaterials = materials.filter((m) =>
          selectedMaterialIds.includes(m.id)
        );

        const materialItems: MaterialChoiceUnboxItem[] = chosenMaterials.map((m) => ({
          id: m.id,
          title: m.title,
          type: "material",
          description:
            m.kind === "crossword"
              ? "Открыт доступ к кроссворду"
              : "Открыт доступ к материалу",
          asset_url: m.cover_image_url || null,
        }));

        const rewardItems: MaterialChoiceUnboxItem[] = Array.isArray(data.grantedRewards)
          ? data.grantedRewards.map((r: any) => ({
              id: r.id,
              title: r.title,
              type: r.type,
              description: r.description,
              asset_url: r.asset_url,
              meta: r.meta,
            }))
          : [];

        onSuccess({
          unboxItems: [...materialItems, ...rewardItems],
          physicalPrize: data.physicalPrize || null,
        });
        onClose();
      } else {
        setSubmitError(data?.error || "Ошибка сохранения выбора");
      }
    } catch (e) {
      setSubmitError("Ошибка соединения с сервером");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const availableLevels = Array.from(
    new Set(
      materials.flatMap((m) => [
        ...(m.target_levels || []),
        ...(m.class_levels || []),
      ])
    )
  ).filter(Boolean);

  const activeTab = projectTabs.find((t) => t.slug === activeTabSlug) || null;

  const filteredMaterials = materials.filter((m) => {
    const matchTab =
      activeTabSlug === "all" ||
      (activeTab ? m.project_tab_id === activeTab.id : true);

    const levels = [...(m.target_levels || []), ...(m.class_levels || [])];
    const matchLevel =
      selectedLevelFilter === "all" ||
      levels.some((l) => l.toLowerCase() === selectedLevelFilter.toLowerCase());

    return matchTab && matchLevel;
  });

  const lockedMaterials = materials.filter((m) => !isAlreadyUnlocked(m));
  const cannotFulfillChoice = materials.length > 0 && lockedMaterials.length < requiredChoiceCount;

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

        {cannotFulfillChoice && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-800 font-bold text-center">
            🎉 У вас уже открыто большинство или все материалы этого раздела! Вы можете пропустить выбор материалов и получить остальные призы из промокода.
          </div>
        )}

        {/* Выбор проекта */}
        {projects.length > 1 && (
          <div
            className="flex gap-2 border-b pb-3 overflow-x-auto"
            style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
          >
            {projects.map((p) => {
              const active = isProjectSelected(p);

              return (
                <button
                  key={p.id || p.slug}
                  type="button"
                  onClick={() => {
                    if (!active) void selectProject(p);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border"
                  style={{
                    backgroundColor: active
                      ? "var(--project-primary, #0ea5e9)"
                      : "#f1f5f9",
                    borderColor: active
                      ? "var(--project-primary, #0ea5e9)"
                      : "#cbd5e1",
                    color: active ? "#ffffff" : "var(--project-text, #0f172a)",
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Фильтры */}
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTabSlug("all")}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border"
              style={{
                backgroundColor: activeTabSlug === "all" ? "var(--project-primary, #0ea5e9)" : "#f1f5f9",
                borderColor: activeTabSlug === "all" ? "var(--project-primary, #0ea5e9)" : "#cbd5e1",
                color: activeTabSlug === "all" ? "#ffffff" : "var(--project-text, #0f172a)",
              }}
            >
              Все категории
            </button>
            {projectTabs.map((tab) => (
              <button
                key={tab.id || tab.slug}
                type="button"
                onClick={() => setActiveTabSlug(tab.slug)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border"
                style={{
                  backgroundColor: activeTabSlug === tab.slug ? "var(--project-primary, #0ea5e9)" : "#f1f5f9",
                  borderColor: activeTabSlug === tab.slug ? "var(--project-primary, #0ea5e9)" : "#cbd5e1",
                  color: activeTabSlug === tab.slug ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                {tab.icon ? `${tab.icon} ` : ""}
                {tab.title}
              </button>
            ))}
          </div>

          {availableLevels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedLevelCode("all")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
                style={{
                  backgroundColor: selectedLevelFilter === "all" ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 20%, transparent)" : "#f8fafc",
                  borderColor: selectedLevelFilter === "all" ? "var(--project-primary, #0ea5e9)" : "#cbd5e1",
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
                    backgroundColor: selectedLevelFilter === lvl ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 20%, transparent)" : "#f8fafc",
                    borderColor: selectedLevelFilter === lvl ? "var(--project-primary, #0ea5e9)" : "#cbd5e1",
                    color: "var(--project-text, #0f172a)",
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Список материалов (сетка с верным выравниванием) */}
        <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1 items-start">
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
                      ? "#f8fafc"
                      : isSelected
                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, #ffffff)"
                      : "#ffffff",
                    borderColor: isSelected
                      ? "var(--project-primary, #0ea5e9)"
                      : "#e2e8f0",
                    opacity: unlocked ? 0.6 : 1,
                    cursor: unlocked ? "not-allowed" : "pointer",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border bg-slate-100"
                      style={{ borderColor: "#e2e8f0" }}
                    >
                      {m.cover_image_url ? (
                        <img
                          src={m.cover_image_url}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">
                          {m.kind === "crossword" ? "🧩" : "📚"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-extrabold text-xs truncate" style={{ color: "var(--project-text, #0f172a)" }}>
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

                  <div
                    className="w-7 h-7 rounded-xl border flex items-center justify-center flex-shrink-0 font-bold text-xs transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? "var(--project-primary, #0ea5e9)"
                        : "transparent",
                      borderColor: isSelected
                        ? "var(--project-primary, #0ea5e9)"
                        : "#cbd5e1",
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

        {submitError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 text-center font-bold">
            {submitError}
          </div>
        )}

        {/* Кнопки */}
        <div
          className="flex justify-end gap-3 pt-3 border-t"
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border font-bold text-xs uppercase tracking-wider rounded-xl transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Отмена
          </button>

          {cannotFulfillChoice ? (
            <button
              type="button"
              onClick={() => handleSubmitChoice(true)}
              disabled={submitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-md"
            >
              {submitting ? "Сохранение..." : "Пропустить выбор материалов"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmitChoice(false)}
              disabled={submitting || selectedMaterialIds.length < requiredChoiceCount}
              className="px-5 py-2 text-white font-black text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-md"
              style={{
                backgroundColor: "var(--project-primary, #0ea5e9)",
              }}
            >
              {submitting ? "Сохранение..." : "Подтвердить выбор"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}