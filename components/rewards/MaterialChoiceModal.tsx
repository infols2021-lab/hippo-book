"use client";

import React, { useState, useEffect } from "react";

interface MaterialItem {
  id: string;
  title: string;
  price?: number;
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
  mode?: "promocode" | "referral";
  promocodeCode?: string;
  referralMilestoneId?: string;
  maxPrice?: number;
  requiredChoiceCount: number;
  onClose: () => void;
  onSuccess: (result: MaterialChoiceSuccessResult) => void;
}

export default function MaterialChoiceModal({
  isOpen,
  mode = "promocode",
  promocodeCode = "",
  referralMilestoneId = "",
  maxPrice = 0,
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
      let res;

      if (mode === "referral") {
        res = await fetch("/api/profile/referrals/claim-milestone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            milestoneId: referralMilestoneId,
            chosenMaterialIds: skipChoice ? [] : selectedMaterialIds,
          }),
        });
      } else {
        res = await fetch("/api/promocodes/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: promocodeCode,
            chosenMaterialIds: skipChoice ? [] : selectedMaterialIds,
            allowSkipIfAllUnlocked: skipChoice,
          }),
        });
      }

      const data = await res.json().catch(() => null);

      if (res.ok && data && (data.ok || data.success)) {
        // Убрали "отсебятину" фронтенда. Берем только то, что реально выдал и подтвердил сервер.
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
          unboxItems: rewardItems,
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

  // Фильтруем материалы, которые подходят под вкладку, уровень и ЦЕНУ (maxPrice)
  const filteredMaterials = materials.filter((m) => {
    const matchTab =
      activeTabSlug === "all" ||
      (activeTab ? m.project_tab_id === activeTab.id : true);

    const levels = [...(m.target_levels || []), ...(m.class_levels || [])];
    const matchLevel =
      selectedLevelFilter === "all" ||
      levels.some((l) => l.toLowerCase() === selectedLevelFilter.toLowerCase());

    const matchPrice =
      mode === "referral" && maxPrice > 0
        ? (m.price || 0) <= maxPrice
        : true;

    return matchTab && matchLevel && matchPrice;
  });

  // Логика умного скипа: считаем только те материалы, которые подходят по цене (доступны)
  const availableForChoiceByPrice = materials.filter((m) => {
    if (mode === "referral" && maxPrice > 0) {
      return (m.price || 0) <= maxPrice;
    }
    return true;
  });

  const lockedMaterials = availableForChoiceByPrice.filter((m) => !isAlreadyUnlocked(m));
  const cannotFulfillChoice = availableForChoiceByPrice.length > 0 && lockedMaterials.length < requiredChoiceCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Шапка модалки */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-5 shrink-0">
          <div>
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-800">
              {mode === "referral" ? "Выбор материалов за этап" : "Выбор материалов по промокоду"}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">
              Выберите {requiredChoiceCount} материал(а) для получения доступа:
            </p>
          </div>
          <div className="font-mono text-xs sm:text-sm font-black px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl uppercase tracking-wider shrink-0 ml-4">
            {selectedMaterialIds.length} / {requiredChoiceCount}
          </div>
        </div>

        {cannotFulfillChoice && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-800 font-bold text-center shrink-0 shadow-sm">
            У вас уже открыто большинство или все доступные материалы. Вы можете пропустить выбор и получить остальные призы.
          </div>
        )}

        {/* Скроллируемая область фильтров и материалов */}
        <div className="overflow-y-auto pr-2 space-y-5 min-h-[50vh]">
          
          {/* Выбор проекта */}
          {projects.length > 1 && (
            <div className="flex gap-2 border-b border-slate-100 pb-3 overflow-x-auto no-scrollbar shrink-0">
              {projects.map((p) => {
                const active = isProjectSelected(p);
                return (
                  <button
                    key={p.id || p.slug}
                    type="button"
                    onClick={() => {
                      if (!active) void selectProject(p);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${
                      active 
                        ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20" 
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Фильтры */}
          <div className="space-y-3 shrink-0">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTabSlug("all")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeTabSlug === "all"
                    ? "bg-slate-800 border-slate-800 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Все категории
              </button>
              {projectTabs.map((tab) => (
                <button
                  key={tab.id || tab.slug}
                  type="button"
                  onClick={() => setActiveTabSlug(tab.slug)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    activeTabSlug === tab.slug
                      ? "bg-slate-800 border-slate-800 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.title}
                </button>
              ))}
            </div>

            {availableLevels.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedLevelCode("all")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    selectedLevelFilter === "all"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-transparent border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Все уровни
                </button>
                {availableLevels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevelCode(lvl)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      selectedLevelFilter === lvl
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-transparent border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Список материалов */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start pb-4">
            {loading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-50">
                <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4"></div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Загрузка каталога...</div>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="col-span-full text-center py-16 text-sm font-bold text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
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
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-200 ${
                      unlocked
                        ? "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed grayscale-[0.5]"
                        : isSelected
                        ? "bg-blue-50 border-blue-400 cursor-pointer shadow-sm shadow-blue-500/10"
                        : "bg-white border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 bg-slate-100 text-slate-400">
                        {m.cover_image_url ? (
                          <img
                            src={m.cover_image_url}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          m.kind === "crossword" ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                          )
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-extrabold text-xs sm:text-sm truncate text-slate-800">
                          {m.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {m.is_secret && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200">
                              Секретный
                            </span>
                          )}
                          {unlocked && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded border border-slate-300">
                              Доступ есть
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : unlocked
                          ? "bg-slate-200 border-slate-300 text-slate-400"
                          : "bg-white border-slate-300 text-transparent hover:border-blue-400"
                      }`}
                    >
                      {(isSelected || unlocked) ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center font-bold shrink-0">
            {submitError}
          </div>
        )}

        {/* Кнопки футера */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border border-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors bg-white hover:bg-slate-50 text-slate-600 w-full sm:w-auto"
          >
            Отмена
          </button>

          {cannotFulfillChoice ? (
            <button
              type="button"
              onClick={() => handleSubmitChoice(true)}
              disabled={submitting}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-md w-full sm:w-auto"
            >
              {submitting ? "Сохранение..." : "Пропустить выбор"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmitChoice(false)}
              disabled={submitting || selectedMaterialIds.length < requiredChoiceCount}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Сохранение...
                </>
              ) : (
                "Подтвердить выбор"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}