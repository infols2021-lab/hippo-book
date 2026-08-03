"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ColorSettings = {
  label: string;
  key: "primary" | "secondary" | "pageBg" | "cardBg" | "textColor";
  value: string;
};

type FeatureKey =
  | "leaderboard"
  | "avatars"
  | "profileProgress"
  | "requestMode";

// ============================================================
// 🖼️ Живое превью – точная копия движка Glassmorphism
// ============================================================
function LivePreview({ colors }: { colors: Record<string, string> }) {
  const primary = colors.primary || "#0ea5e9";
  const secondary = colors.secondary || "#38bdf8";
  const bg = colors.pageBg || "#f8fafc";
  const cardBg = colors.cardBg || "#ffffff";
  const text = colors.textColor || "#0f172a";

  const previewStyles = {
    "--project-primary": primary,
    "--project-secondary": secondary,
    "--project-bg": bg,
    "--project-card-bg": cardBg,
    "--project-text": text,
    "--glass-bg": `color-mix(in srgb, ${cardBg} 75%, transparent)`,
    "--glass-border": `color-mix(in srgb, ${text} 8%, transparent)`,
    "--glass-highlight": `color-mix(in srgb, #ffffff 70%, transparent)`,
    "--glass-shadow": `0 12px 40px -12px color-mix(in srgb, ${text} 12%, transparent)`,
    backgroundColor: bg,
    color: text,
    fontFamily: "Inter, ui-sans-serif, sans-serif",
    padding: "24px",
    borderRadius: "24px",
    minHeight: "450px",
    border: "1px solid rgba(0,0,0,0.04)",
    transition: "all 0.4s ease",
  } as React.CSSProperties;

  return (
    <div style={previewStyles}>
      {/* Шапка превью */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderRadius: "20px",
          background: "var(--glass-bg)",
          backdropFilter: "blur(24px)",
          border: "1px solid var(--glass-border)",
          boxShadow: "inset 0 1px 1px var(--glass-highlight), var(--glass-shadow)",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "var(--project-primary)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "16px",
              boxShadow:
                "inset 0 1px 1px rgba(255,255,255,0.3), 0 8px 16px -4px color-mix(in srgb, var(--project-primary) 50%, transparent)",
            }}
          >
            EK
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--project-text)" }}>
              Экзамены
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "color-mix(in srgb, var(--project-text) 60%, transparent)",
                fontWeight: 600,
              }}
            >
              Профиль ученика
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div
            style={{
              padding: "8px 16px",
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--project-text) 5%, transparent)",
              color: "var(--project-text)",
              fontWeight: 700,
              fontSize: "12px",
              border: "1px solid var(--glass-border)",
            }}
          >
            Меню
          </div>
          <div
            style={{
              padding: "8px 16px",
              borderRadius: "12px",
              background: "color-mix(in srgb, #ef4444 10%, transparent)",
              color: "#ef4444",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            Выйти
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "20px" }}>
        {/* Левая панель (Сайдбар превью) */}
        <div
          style={{
            borderRadius: "24px",
            background: "var(--glass-bg)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--glass-border)",
            boxShadow: "inset 0 1px 1px var(--glass-highlight), var(--glass-shadow)",
            padding: "24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--project-primary) 10%, transparent)",
              border: "4px solid color-mix(in srgb, var(--project-primary) 20%, transparent)",
              boxShadow:
                "0 12px 32px -8px color-mix(in srgb, var(--project-primary) 30%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              marginBottom: "16px",
            }}
          >
            👤
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: "20px",
              color: "var(--project-text)",
              marginBottom: "4px",
            }}
          >
            Ученик
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "color-mix(in srgb, var(--project-text) 60%, transparent)",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            student@mail.ru
          </div>
          <div
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              background: "var(--project-primary)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "13px",
              boxShadow:
                "inset 0 1px 1px rgba(255,255,255,0.3), 0 8px 20px -6px color-mix(in srgb, var(--project-primary) 50%, transparent)",
            }}
          >
            Редактировать
          </div>
        </div>

        {/* Правая панель превью */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              borderRadius: "24px",
              background: "var(--glass-bg)",
              backdropFilter: "blur(24px)",
              border: "1px solid var(--glass-border)",
              boxShadow: "inset 0 1px 1px var(--glass-highlight), var(--glass-shadow)",
              padding: "24px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "color-mix(in srgb, var(--project-text) 60%, transparent)",
                marginBottom: "16px",
              }}
            >
              Статистика
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div
                style={{
                  background: "color-mix(in srgb, var(--project-primary) 6%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--project-primary) 15%, transparent)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    color: "var(--project-primary)",
                  }}
                >
                  12
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "color-mix(in srgb, var(--project-text) 60%, transparent)",
                    marginTop: "4px",
                  }}
                >
                  МАТЕРИАЛОВ
                </div>
              </div>
              <div
                style={{
                  background: "color-mix(in srgb, var(--project-primary) 6%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--project-primary) 15%, transparent)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    color: "var(--project-primary)",
                  }}
                >
                  84%
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "color-mix(in srgb, var(--project-text) 60%, transparent)",
                    marginTop: "4px",
                  }}
                >
                  ПРОГРЕСС
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Основной редактор
// ============================================================
export default function ProjectEditor({
  project,
  onClose,
  onSaved,
}: {
  project: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const initialPrimaryColor =
    project?.theme?.colors?.primary || project?.theme?.primaryColor || project?.theme_color || "#0ea5e9";
  const initialSecondaryColor = project?.theme?.colors?.secondary || project?.theme?.secondaryColor || "#38bdf8";
  const initialPageBg = project?.theme?.colors?.pageBg || project?.theme?.backgroundColor || "#f8fafc";
  const initialCardBg = project?.theme?.colors?.cardBg || project?.theme?.cardBg || "#ffffff";
  const initialTextColor = project?.theme?.colors?.textColor || project?.theme?.textColor || "#0f172a";

  const [formData, setFormData] = useState({
    name: project?.name || "",
    slug: project?.slug || "",
    description: project?.description || "",
    sheet_name: project?.sheet_name || "",
    is_active: project?.is_active ?? true,
    theme: {
      colors: {
        primary: initialPrimaryColor,
        secondary: initialSecondaryColor,
        pageBg: initialPageBg,
        cardBg: initialCardBg,
        textColor: initialTextColor,
      },
    },
    features: {
      leaderboard: project?.features?.leaderboard || project?.features?.hasLeaderboard || false,
      avatars: project?.features?.avatars || project?.features?.hasAvatars || false,
      profileProgress: project?.features?.profileProgress || false,
      requestMode: project?.features?.requestMode || "target_levels",
    },
  });

  const [levels, setLevels] = useState<any[]>([]);
  const [editingLevel, setEditingLevel] = useState<any | null>(null);

  const [tabs, setTabs] = useState<any[]>([]);
  const [editingTab, setEditingTab] = useState<any | null>(null);

  // Стейты для удаления проекта
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteConfirmWord, setDeleteConfirmWord] = useState("");
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  useEffect(() => {
    if (project?.id) {
      Promise.all([
        fetch(`/api/admin/projects/${project.id}/levels`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/admin/projects/${project.id}/tabs`, { cache: "no-store" }).then((r) => r.json()),
      ])
        .then(([levelsData, tabsData]) => {
          setLevels(levelsData.levels || levelsData.data || []);
          setTabs(tabsData.tabs || []);
        })
        .catch((err) => {
          console.error("Ошибка загрузки данных:", err);
        });
    }
  }, [project]);

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = project?.id ? `/api/admin/projects/${project.id}` : "/api/admin/projects";

    try {
      const res = await fetch(url, {
        method: project?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }

      onSaved();
    } catch (err: any) {
      alert("❌ Ошибка сохранения проекта: " + err.message);
    }
  };

  const saveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLevel?.code || !editingLevel?.label || !project?.id) {
      alert("Заполните код и название уровня.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: editingLevel.id,
          code: editingLevel.code,
          label: editingLevel.label,
          order_index: editingLevel.order_index ?? levels.length * 10,
          is_active: editingLevel.is_active ?? true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка сохранения");
      }

      const refreshRes = await fetch(`/api/admin/projects/${project.id}/levels`, { cache: "no-store" });
      const refreshData = await refreshRes.json();

      setLevels(refreshData.levels || refreshData.data || []);
      setEditingLevel(null);
    } catch (err: any) {
      alert("❌ Ошибка: " + err.message);
    }
  };

  const deleteLevel = async (levelId: string) => {
    if (!project?.id) return;
    if (!window.confirm("Удалить этот уровень?")) return;

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/levels?id=${levelId}`, {
        method: "DELETE",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Ошибка удаления");
      }

      setLevels(levels.filter((l) => l.id !== levelId));
    } catch (err: any) {
      alert("❌ Ошибка: " + err.message);
    }
  };

  const saveTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id || !editingTab) return;

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/tabs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(editingTab),
      });

      if (!res.ok) {
        throw new Error("Ошибка сохранения");
      }

      setEditingTab(null);
      const refreshRes = await fetch(`/api/admin/projects/${project.id}/tabs`, { cache: "no-store" });
      const refreshData = await refreshRes.json();

      setTabs(refreshData.tabs || []);
    } catch (err: any) {
      alert("❌ Ошибка: " + err.message);
    }
  };

  const deleteTab = async (tabId: string) => {
    if (!project?.id) return;
    if (!window.confirm("Удалить этот раздел? (Убедитесь, что в нём нет материалов)")) return;

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/tabs?id=${tabId}`, {
        method: "DELETE",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Ошибка удаления");
      }

      setTabs(tabs.filter((t) => t.id !== tabId));
    } catch (err: any) {
      alert("❌ Ошибка: " + err.message);
    }
  };

  const toggleFeature = (key: FeatureKey) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features[key],
      },
    }));
  };

  const handleRequestModeChange = (mode: "class_level" | "target_levels") => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        requestMode: mode,
      },
    }));
  };

  const handleThemeChange = (
    colorKey: "primary" | "secondary" | "pageBg" | "cardBg" | "textColor",
    colorValue: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        colors: {
          ...prev.theme.colors,
          [colorKey]: colorValue,
        },
      },
    }));
  };

  const handleDeleteProject = async () => {
    if (!project?.id) return;
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "DELETE",
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }

      alert("✅ Проект успешно удален");
      onClose();
      router.refresh();
      onSaved();
    } catch (err: any) {
      alert("❌ Ошибка удаления проекта: " + err.message);
    }
  };

  const applyPreset = (preset: Record<string, string>) => {
    setFormData((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        colors: {
          ...prev.theme.colors,
          ...preset,
        },
      },
    }));
  };

  const presets = [
    { name: "Apple Blue", colors: { primary: "#0ea5e9", secondary: "#38bdf8", pageBg: "#f8fafc", cardBg: "#ffffff", textColor: "#0f172a" } },
    { name: "Dark Premium", colors: { primary: "#3b82f6", secondary: "#8b5cf6", pageBg: "#0a0a0a", cardBg: "#171717", textColor: "#f8fafc" } },
    { name: "Emerald", colors: { primary: "#10b981", secondary: "#34d399", pageBg: "#ecfdf5", cardBg: "#ffffff", textColor: "#064e3b" } },
    { name: "Sunset", colors: { primary: "#f97316", secondary: "#f43f5e", pageBg: "#fff7ed", cardBg: "#ffffff", textColor: "#431407" } },
    { name: "Indigo Night", colors: { primary: "#6366f1", secondary: "#a78bfa", pageBg: "#0f0f1a", cardBg: "#1e1e2e", textColor: "#e0e7ff" } },
    { name: "Soft Lavender", colors: { primary: "#8b5cf6", secondary: "#c4b5fd", pageBg: "#faf5ff", cardBg: "#ffffff", textColor: "#4c1d95" } },
    { name: "Mint Breeze", colors: { primary: "#14b8a6", secondary: "#5eead4", pageBg: "#f0fdfa", cardBg: "#ffffff", textColor: "#134e4a" } },
    { name: "Warm Sand", colors: { primary: "#d97706", secondary: "#fcd34d", pageBg: "#fffbeb", cardBg: "#ffffff", textColor: "#78350f" } },
    { name: "Midnight Slate", colors: { primary: "#64748b", secondary: "#94a3b8", pageBg: "#0f172a", cardBg: "#1e293b", textColor: "#f1f5f9" } },
    { name: "Rose Gold", colors: { primary: "#e11d48", secondary: "#fda4af", pageBg: "#fff1f2", cardBg: "#ffffff", textColor: "#4c0519" } },
    { name: "Ocean Depth", colors: { primary: "#0e7490", secondary: "#22d3ee", pageBg: "#f0f9ff", cardBg: "#ffffff", textColor: "#082f49" } },
    { name: "Forest Night", colors: { primary: "#15803d", secondary: "#4ade80", pageBg: "#0f172a", cardBg: "#1e293b", textColor: "#f0fdf4" } },
    { name: "Peach Cream", colors: { primary: "#f97316", secondary: "#fdba74", pageBg: "#fff7ed", cardBg: "#ffffff", textColor: "#431407" } },
    { name: "Arctic Frost", colors: { primary: "#06b6d4", secondary: "#67e8f9", pageBg: "#ecfeff", cardBg: "#ffffff", textColor: "#164e63" } },
    { name: "Amethyst Haze", colors: { primary: "#7c3aed", secondary: "#c084fc", pageBg: "#faf5ff", cardBg: "#1e1b4b", textColor: "#e0e7ff" } },
    { name: "Crimson Night", colors: { primary: "#b91c1c", secondary: "#f87171", pageBg: "#0a0a0a", cardBg: "#171717", textColor: "#fecaca" } },
    { name: "Lilac Dream", colors: { primary: "#d8b4fe", secondary: "#ede9fe", pageBg: "#faf5ff", cardBg: "#ffffff", textColor: "#4c1d95" } },
  ];

  const colorSettings: ColorSettings[] = [
    { label: "Основной акцент", key: "primary", value: formData.theme.colors.primary },
    { label: "Вторичный акцент", key: "secondary", value: formData.theme.colors.secondary },
    { label: "Фон страницы", key: "pageBg", value: formData.theme.colors.pageBg },
    { label: "Фон карточек", key: "cardBg", value: formData.theme.colors.cardBg },
    { label: "Цвет текста", key: "textColor", value: formData.theme.colors.textColor },
  ];

  const canDeleteProject = deleteConfirmName === project?.name && deleteConfirmWord === "DELETE";

  return (
    <div className="bg-white p-6 rounded-[28px] border shadow-xl max-w-[1200px] mx-auto space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800">
          {project ? `Настройка ветки: ${project.name}` : "Новая образовательная ветка"}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 font-bold hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors"
        >
          Закрыть
        </button>
      </div>

      <form onSubmit={saveProject} className="space-y-8">
        {/* БАЗОВЫЕ НАСТРОЙКИ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">
              Название ветки
            </label>
            <input
              required
              className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Английский для детей"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">
              URL (Slug)
            </label>
            <input
              required
              className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 font-mono"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="kids-english"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">
              Google Sheets <span className="text-gray-400 font-normal text-xs">(Опционально)</span>
            </label>
            <input
              className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500"
              value={formData.sheet_name}
              onChange={(e) => setFormData({ ...formData, sheet_name: e.target.value })}
              placeholder="Напр: Заявки Hippo"
            />
          </div>
          <div className="col-span-1 md:col-span-3">
            <label className="block text-sm font-bold mb-2 text-gray-700">
              Описание на портале
            </label>
            <textarea
              className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Краткое описание ветки..."
            />
          </div>
          <div className="col-span-1 md:col-span-3">
            <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl border hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span className="font-bold text-gray-800">Проект активен (виден ученикам)</span>
            </label>
          </div>
        </div>

        {/* ДИЗАЙН СИСТЕМА И ЖИВОЕ ПРЕВЬЮ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t pt-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-black mb-2 text-gray-800">🎨 Цвета и Тема</h3>
              <p className="text-sm text-gray-500 mb-4 font-medium">
                Создайте уникальный стиль. Движок сам рассчитает прозрачность, тени и матовое стекло.
              </p>

              {/* Пресеты */}
              <div className="flex flex-wrap gap-2 mb-6">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p.colors)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border hover:scale-105 transition-transform"
                    style={{
                      background: p.colors.pageBg,
                      color: p.colors.textColor,
                      borderColor: p.colors.primary,
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {colorSettings.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between p-3.5 bg-gray-50 border rounded-2xl hover:border-gray-300 transition-colors"
                >
                  <span className="text-sm font-bold text-gray-700">{c.label}</span>
                  <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border shadow-sm">
                    <input
                      type="text"
                      className="w-20 text-xs font-mono font-bold text-gray-600 outline-none uppercase"
                      value={c.value}
                      onChange={(e) => handleThemeChange(c.key, e.target.value)}
                    />
                    <input
                      type="color"
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                      value={c.value}
                      onChange={(e) => handleThemeChange(c.key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-black mb-1 text-gray-800">👀 Живое превью</h3>
            <p className="text-sm text-gray-500 mb-4 font-medium">Так интерфейс выглядит для ученика в реальном времени.</p>
            <LivePreview colors={formData.theme.colors} />
          </div>
        </div>

        {/* ФИЧИ */}
        <div className="bg-blue-50/50 p-6 rounded-[24px] border border-blue-100 border-t pt-8">
          <h3 className="font-black text-blue-900 mb-2 text-xl">🎮 Модули платформы</h3>
          <p className="text-sm text-blue-800/70 mb-6 font-medium">Включите геймификацию и выберите режим заявок.</p>

          <div className="flex flex-wrap gap-4 mb-8">
            <label className="flex items-center gap-3 cursor-pointer bg-white p-4 rounded-2xl border shadow-sm hover:border-blue-300 transition-all">
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded"
                checked={formData.features.leaderboard}
                onChange={() => toggleFeature("leaderboard")}
              />
              <span className="font-bold text-gray-800">🏆 Лидерборд</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer bg-white p-4 rounded-2xl border shadow-sm hover:border-blue-300 transition-all">
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded"
                checked={formData.features.avatars}
                onChange={() => toggleFeature("avatars")}
              />
              <span className="font-bold text-gray-800">🖼️ Аватарки</span>
            </label>
          </div>

          <div className="pt-6 border-t border-blue-200/50">
            <div className="text-sm font-bold text-gray-800 mb-4">Режим выбора уровня в заявках:</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-3 cursor-pointer bg-white p-4 rounded-2xl border shadow-sm hover:border-blue-300 transition-all">
                <input
                  type="radio"
                  name="requestMode"
                  value="class_level"
                  checked={formData.features.requestMode === "class_level"}
                  onChange={() => handleRequestModeChange("class_level")}
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <div className="font-bold text-gray-800">📚 Класс (одиночный)</div>
                  <div className="text-xs text-gray-500 font-medium">Пользователь выбирает только 1 класс</div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-white p-4 rounded-2xl border shadow-sm hover:border-blue-300 transition-all">
                <input
                  type="radio"
                  name="requestMode"
                  value="target_levels"
                  checked={formData.features.requestMode === "target_levels"}
                  onChange={() => handleRequestModeChange("target_levels")}
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <div className="font-bold text-gray-800">🎯 Уровни (множественный)</div>
                  <div className="text-xs text-gray-500 font-medium">Массив уровней (как в Gatehouse)</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-gray-900 hover:bg-black transition-transform hover:-translate-y-1 text-white font-black text-lg py-4 rounded-2xl shadow-xl"
        >
          💾 Сохранить ядро проекта
        </button>
      </form>

      {/* УРОВНИ И ТАБЫ */}
      {project?.id && (
        <div className="space-y-8 border-t pt-8">
          <div className="bg-gray-50/50 p-8 rounded-[28px] border relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-800">Уровни (Классы)</h3>
              {!editingLevel && (
                <button
                  type="button"
                  onClick={() => setEditingLevel({ code: "", label: "", order_index: levels.length * 10, is_active: true })}
                  className="bg-white hover:bg-gray-100 border shadow-sm transition-colors text-gray-800 px-5 py-2.5 rounded-xl font-bold text-sm"
                >
                  + Создать уровень
                </button>
              )}
            </div>

            {editingLevel ? (
              <form onSubmit={saveLevel} className="bg-white p-6 rounded-2xl border shadow-xl mb-8 relative">
                <h4 className="font-black text-lg mb-6 text-gray-800">
                  {editingLevel.id ? "Редактирование уровня" : "Новый уровень"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Название (Label)</label>
                    <input
                      required
                      className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500"
                      placeholder="Hippo 1"
                      value={editingLevel.label}
                      onChange={(e) => setEditingLevel({ ...editingLevel, label: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Код (Code)</label>
                    <input
                      required
                      className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 font-mono"
                      placeholder="hippo-1"
                      value={editingLevel.code}
                      onChange={(e) => setEditingLevel({ ...editingLevel, code: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-3 rounded-xl font-bold shadow-md"
                  >
                    Сохранить уровень
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLevel(null)}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors px-6 py-3 rounded-xl font-bold"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {levels.map((l) => (
                  <div
                    key={l.id}
                    className="bg-white border shadow-sm p-4 rounded-2xl flex items-center justify-between hover:border-blue-300 transition-colors group"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-gray-800">{l.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded-lg">
                        {l.code}
                      </span>
                      <div className="hidden group-hover:flex gap-1 ml-2">
                        <button
                          onClick={() => setEditingLevel(l)}
                          className="bg-blue-50 text-blue-600 p-1.5 rounded hover:bg-blue-100 transition-colors"
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteLevel(l.id)}
                          className="bg-red-50 text-red-600 p-1.5 rounded hover:bg-red-100 transition-colors"
                          title="Удалить"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {levels.length === 0 && (
                  <div className="text-sm text-gray-500 font-medium col-span-full">
                    Уровней пока нет
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50/50 p-8 rounded-[28px] border">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-800">Разделы (Табы)</h3>
              {!editingTab && (
                <button
                  type="button"
                  onClick={() => setEditingTab({
                    title: "", slug: "", icon: "📄", order_index: tabs.length * 10,
                    is_active: true, component_type: "materials"
                  })}
                  className="bg-white hover:bg-gray-100 border shadow-sm transition-colors text-gray-800 px-5 py-2.5 rounded-xl font-bold text-sm"
                >
                  + Создать раздел
                </button>
              )}
            </div>

            {editingTab && (
              <form onSubmit={saveTab} className="bg-white p-6 rounded-2xl border shadow-xl mb-8 relative">
                <h4 className="font-black text-lg mb-6 text-gray-800">
                  {editingTab.id ? "Редактирование раздела" : "Новый раздел"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Название (Title)</label>
                    <input
                      required
                      className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500"
                      value={editingTab.title}
                      onChange={(e) => setEditingTab({ ...editingTab, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">URL (Slug)</label>
                    <input
                      required
                      className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 font-mono"
                      value={editingTab.slug}
                      onChange={(e) => setEditingTab({ ...editingTab, slug: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Иконка (Emoji)</label>
                    <input
                      className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 text-xl"
                      value={editingTab.icon || ""}
                      onChange={(e) => setEditingTab({ ...editingTab, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Порядок</label>
                    <input
                      type="number"
                      required
                      className="w-full border-2 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500"
                      value={editingTab.order_index}
                      onChange={(e) => setEditingTab({ ...editingTab, order_index: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer font-bold mt-6 p-4 bg-gray-50 rounded-xl border w-fit hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={editingTab.is_active}
                    onChange={(e) => setEditingTab({ ...editingTab, is_active: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800">Активен</span>
                </label>
                <div className="flex gap-3 mt-8">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-3 rounded-xl font-bold shadow-md"
                  >
                    Сохранить раздел
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTab(null)}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors px-6 py-3 rounded-xl font-bold"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}

            {!editingTab && tabs.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-4 font-bold text-gray-600">Раздел</th>
                      <th className="p-4 font-bold text-gray-600 text-center w-24">Порядок</th>
                      <th className="p-4 font-bold text-gray-600 text-center w-32">Статус</th>
                      <th className="p-4 w-48"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tabs.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-base text-gray-800 flex items-center gap-3">
                            <span className="text-xl">{t.icon}</span> {t.title}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-1">/{t.slug}</div>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-600">{t.order_index}</td>
                        <td className="p-4 text-center">
                          {t.is_active ? (
                            <span className="text-green-700 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg">
                              Активен
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg">
                              Скрыт
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingTab(t)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTab(t.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* КРАСНАЯ ЗОНА: Удаление проекта */}
          <div className="border-t-4 border-red-100 pt-10 mt-10">
            <div className="bg-red-50 p-8 rounded-[28px] border border-red-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-black text-red-800 mb-2">Удаление проекта</h3>
                  <p className="text-sm text-red-600 font-medium max-w-2xl">
                    Внимание! Это действие необратимо. Будут удалены все материалы, доступы, заявки и статистика учеников, связанные с этим проектом.
                  </p>
                </div>
                {!showDeleteZone && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteZone(true)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm"
                  >
                    Удалить проект...
                  </button>
                )}
              </div>

              {showDeleteZone && (
                <div className="mt-6 bg-white p-6 rounded-2xl border border-red-100 shadow-sm animate-in fade-in slide-in-from-top-4">
                  <p className="font-bold text-gray-800 mb-4">
                    Для подтверждения удаления введите название проекта <span className="bg-gray-100 px-2 py-1 rounded font-mono text-red-600">{project.name}</span> и слово <span className="bg-gray-100 px-2 py-1 rounded font-mono text-red-600">DELETE</span>
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Название проекта</label>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        className="w-full border-2 border-red-100 focus:border-red-500 rounded-xl px-4 py-2.5 font-medium outline-none"
                        placeholder={project.name}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Слово DELETE</label>
                      <input
                        type="text"
                        value={deleteConfirmWord}
                        onChange={(e) => setDeleteConfirmWord(e.target.value)}
                        className="w-full border-2 border-red-100 focus:border-red-500 rounded-xl px-4 py-2.5 font-medium outline-none font-mono"
                        placeholder="DELETE"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={handleDeleteProject}
                      disabled={!canDeleteProject}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all"
                    >
                      Я понимаю риски, удалить навсегда
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteZone(false);
                        setDeleteConfirmName("");
                        setDeleteConfirmWord("");
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}