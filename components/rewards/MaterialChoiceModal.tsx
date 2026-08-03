"use client";

import React, { useState, useEffect } from "react";

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
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const activeProjects = data.projects || [];
        setProjects(activeProjects);
        if (activeProjects.length > 0) {
          setSelectedProjectId(activeProjects[0].id);
          loadMaterialsForProject(activeProjects[0].slug);
        }
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterialsForProject = async (projectSlug: string) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/materials`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
      }
    } catch (e) {
      console.error("Failed to load materials:", e);
    }
  };

  const handleToggleMaterial = (id: string) => {
    if (selectedMaterialIds.includes(id)) {
      setSelectedMaterialIds(selectedMaterialIds.filter((mId) => mId !== id));
    } else {
      if (selectedMaterialIds.length < requiredChoiceCount) {
        setSelectedMaterialIds([...selectedMaterialIds, id]);
      }
    }
  };

  const handleSubmitChoice = async () => {
    if (selectedMaterialIds.length < requiredChoiceCount) {
      alert(`Пожалуйста, выберите ${requiredChoiceCount} материалов.`);
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
        alert("🎉 Материалы успешно разблокированы!");
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения выбора");
      }
    } catch (e) {
      alert(" Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-white">
              🎓 Выберите награду по промокоду
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Выберите **{requiredChoiceCount}** материал(а), которые хотите получить бесплатно:
            </p>
          </div>
          <span className="font-mono text-xs font-bold px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
            Выбрано: {selectedMaterialIds.length} / {requiredChoiceCount}
          </span>
        </div>

        {/* Выбор проекта */}
        {projects.length > 1 && (
          <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProjectId(p.id);
                  loadMaterialsForProject(p.slug);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  selectedProjectId === p.id
                    ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Список материалов */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Загрузка доступных материалов...
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              В этом проекте нет доступных материалов
            </div>
          ) : (
            materials.map((m) => {
              const isSelected = selectedMaterialIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleMaterial(m.id)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-950/20 border-emerald-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📚</span>
                    <div>
                      <div className="font-bold text-xs">{m.title}</div>
                      {m.is_secret && (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          ★ Секретный материал
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-5 h-5 rounded-md border border-slate-700 flex items-center justify-center text-xs">
                    {isSelected && "✓"}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Кнопка подтверждения */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmitChoice}
            disabled={
              submitting || selectedMaterialIds.length < requiredChoiceCount
            }
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20"
          >
            {submitting ? "Сохранение..." : "Подтвердить выбор"}
          </button>
        </div>
      </div>
    </div>
  );
}