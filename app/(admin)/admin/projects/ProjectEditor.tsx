// app/(admin)/admin/projects/ProjectEditor.tsx
"use client";

import { useState, useEffect } from "react";

type ColorSettings = {
  label: string;
  key: "primary" | "secondary" | "pageBg" | "cardBg" | "textColor";
  value: string;
};

// Полностью удалены легаси-ключи (hasStreaks, hasTitles, hasLeaderboard)
type FeatureKey =
  | "streaks"
  | "titles"
  | "leaderboard"
  | "avatars"
  | "profileProgress"
  | "requestMode";

// ============================================================
// 🖼️ Живое превью – точная копия реального профиля
// ============================================================
function LivePreview({ colors }: { colors: Record<string, string> }) {
  const primary = colors.primary || "#3b82f6";
  const secondary = colors.secondary || "#1d4ed8";
  const bg = colors.pageBg || "#f8fafc";
  const cardBg = colors.cardBg || "#ffffff";
  const text = colors.textColor || "#0f172a";
  const muted = "#64748b";

  return (
    <div
      style={{
        backgroundColor: bg,
        color: text,
        fontFamily: "Inter, ui-sans-serif, sans-serif",
        padding: "20px",
        borderRadius: "20px",
        minHeight: "400px",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      {/* Шапка как в профиле */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: "16px",
          backgroundColor: cardBg,
          border: "1px solid rgba(15,23,42,0.08)",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "16px",
            }}
          >
            EK
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "16px" }}>Экзамены Gatehouse</div>
            <div style={{ fontSize: "12px", color: muted }}>Профиль ученика</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: "12px",
              background: primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            Топ серий
          </div>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: "12px",
              background: secondary,
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            Материалы
          </div>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: "12px",
              background: "#ff6b6b",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            Выйти
          </div>
        </div>
      </div>

      {/* Основная сетка – левая панель + правая */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "18px" }}>
        {/* Левая панель (профиль) */}
        <div
          style={{
            borderRadius: "20px",
            backgroundColor: cardBg,
            border: "1px solid rgba(15,23,42,0.08)",
            padding: "20px 16px",
            textAlign: "center",
          }}
        >
          {/* Аватар */}
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              margin: "0 auto 16px",
              background: `radial-gradient(circle at 30% 30%, ${primary}44, ${secondary}33)`,
              border: "4px solid #fff",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
            }}
          >
            🦛
          </div>
          <div style={{ fontWeight: 800, fontSize: "20px", marginBottom: "4px" }}>
            Солнцев Алексей
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              borderRadius: "999px",
              background: `${primary}22`,
              border: `1px solid ${primary}44`,
              fontSize: "13px",
              fontWeight: 700,
              color: primary,
              marginBottom: "12px",
            }}
          >
            🏷️ Легенда Хипполи
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
              alignItems: "stretch",
              background: cardBg,
              border: "1px solid rgba(15,23,42,0.06)",
              borderRadius: "12px",
              overflow: "hidden",
              marginBottom: "16px",
            }}
          >
            <div style={{ padding: "8px 4px" }}>
              <div style={{ fontSize: "11px", color: muted, fontWeight: 700 }}>EMAIL</div>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>aleksey@mail.ru</div>
            </div>
            <div style={{ width: "1px", background: "rgba(15,23,42,0.08)" }} />
            <div style={{ padding: "8px 4px" }}>
              <div style={{ fontSize: "11px", color: muted, fontWeight: 700 }}>ТЕЛЕФОН</div>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>+7 999 123-45-67</div>
            </div>
            <div style={{ width: "1px", background: "rgba(15,23,42,0.08)" }} />
            <div style={{ padding: "8px 4px" }}>
              <div style={{ fontSize: "11px", color: muted, fontWeight: 700 }}>РЕГИОН</div>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>Белгородская</div>
            </div>
          </div>

          {/* Streak summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.02)",
                borderRadius: "12px",
                padding: "8px",
              }}
            >
              <div style={{ fontSize: "11px", color: muted, fontWeight: 700 }}>Текущая серия</div>
              <div style={{ fontWeight: 900, fontSize: "18px", color: primary }}>47 дн.</div>
            </div>
            <div
              style={{
                background: "rgba(0,0,0,0.02)",
                borderRadius: "12px",
                padding: "8px",
              }}
            >
              <div style={{ fontSize: "11px", color: muted, fontWeight: 700 }}>Рекорд</div>
              <div style={{ fontWeight: 900, fontSize: "18px", color: secondary }}>47 дн.</div>
            </div>
          </div>

          <button
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "14px",
              border: "1px solid rgba(15,23,42,0.08)",
              background: cardBg,
              fontWeight: 700,
              marginBottom: "12px",
              cursor: "pointer",
            }}
          >
            Редактировать профиль
          </button>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <a
              href="#"
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "12px",
                background: "#2AABEE",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Telegram
            </a>
            <a
              href="#"
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "12px",
                background: "#0077FF",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              ВКонтакте
            </a>
          </div>

          <button
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "14px",
              border: "none",
              background: "#ff6b6b",
              color: "#fff",
              fontWeight: 700,
              marginBottom: "8px",
              cursor: "pointer",
            }}
          >
            Заявки на покупку
          </button>

          <button
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "14px",
              border: "1px solid rgba(15,23,42,0.08)",
              background: cardBg,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Панель управления
          </button>
        </div>

        {/* Правая панель – статистика и прогресс */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Статистика */}
          <div
            style={{
              borderRadius: "20px",
              backgroundColor: cardBg,
              border: "1px solid rgba(15,23,42,0.08)",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "20px" }}>📊</span>
              <span style={{ fontWeight: 800, fontSize: "18px" }}>
                Статистика по доступным <b style={{ color: primary }}>материалам</b>
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
              }}
            >
              <div
                style={{
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: "14px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "32px", fontWeight: 900, color: primary }}>14</div>
                <div style={{ fontSize: "12px", color: muted, fontWeight: 700 }}>
                  ДОСТУПНЫХ МАТЕРИАЛА
                </div>
              </div>
              <div
                style={{
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: "14px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "32px", fontWeight: 900, color: secondary }}>2</div>
                <div style={{ fontSize: "12px", color: muted, fontWeight: 700 }}>
                  ПРОЙДЕНО МАТЕРИАЛОВ
                </div>
              </div>
              <div
                style={{
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: "14px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "32px", fontWeight: 900, color: "#f59e0b" }}>9%</div>
                <div style={{ fontSize: "12px", color: muted, fontWeight: 700 }}>
                  ОБЩИЙ ПРОГРЕСС
                </div>
              </div>
            </div>
          </div>

          {/* Прогресс по материалам */}
          <div
            style={{
              borderRadius: "20px",
              backgroundColor: cardBg,
              border: "1px solid rgba(15,23,42,0.08)",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "20px" }}>📈</span>
              <span style={{ fontWeight: 800, fontSize: "18px" }}>
                Прогресс по доступным <b style={{ color: primary }}>материалам</b>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { title: "Little Hippo", completed: 3, total: 25 },
                { title: "hippo 2", completed: 0, total: 28 },
                { title: "hippo 3", completed: 2, total: 21 },
                { title: "hippo 4", completed: 1, total: 29 },
                { title: "baby hippo", completed: 5, total: 7 },
                { title: "hippo 1", completed: 3, total: 21 },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: "rgba(0,0,0,0.02)",
                    border: "1px solid rgba(15,23,42,0.04)",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px" }}>{item.title}</div>
                    <div style={{ fontSize: "12px", color: muted }}>
                      {item.completed} из {item.total} заданий выполнено
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "120px",
                        height: "8px",
                        background: "rgba(0,0,0,0.06)",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round((item.completed / item.total) * 100)}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${primary}, ${secondary})`,
                          borderRadius: "999px",
                        }}
                      />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: primary }}>
                      {Math.round((item.completed / item.total) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
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
  // Читаем цвета с обратной совместимостью (если в БД ещё лежат старые форматы),
  // но сохранять будем ИСКЛЮЧИТЕЛЬНО в новом едином формате `colors: {...}`
  const initialPrimaryColor =
    project?.theme?.colors?.primary || project?.theme?.primaryColor || "#3b82f6";
  const initialSecondaryColor =
    project?.theme?.colors?.secondary || project?.theme?.secondaryColor || "#1d4ed8";
  const initialPageBg =
    project?.theme?.colors?.pageBg || project?.theme?.backgroundColor || "#f8fafc";
  const initialCardBg = project?.theme?.colors?.cardBg || "#ffffff";
  const initialTextColor = project?.theme?.colors?.textColor || "#111827";

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
      // Мы полностью удалили дубликаты `primaryColor`, `secondaryColor`, `backgroundColor` отсюда.
    },
    features: {
      streaks: project?.features?.streaks || project?.features?.hasStreaks || false,
      titles: project?.features?.titles || project?.features?.hasTitles || false,
      leaderboard: project?.features?.leaderboard || project?.features?.hasLeaderboard || false,
      avatars: project?.features?.avatars || project?.features?.hasAvatars || false,
      profileProgress: project?.features?.profileProgress || false,
      requestMode: project?.features?.requestMode || "target_levels",
      // Мы полностью удалили дубликаты `hasStreaks`, `hasTitles`, `hasLeaderboard` отсюда.
    },
  });

  const [levels, setLevels] = useState<any[]>([]);
  const [newLevel, setNewLevel] = useState({ code: "", label: "" });

  const [tabs, setTabs] = useState<any[]>([]);
  const [editingTab, setEditingTab] = useState<any | null>(null);

  useEffect(() => {
    if (project?.id) {
      Promise.all([
        fetch(`/api/admin/projects/${project.id}/levels`, { cache: "no-store" }).then((r) =>
          r.json()
        ),
        fetch(`/api/admin/projects/${project.id}/tabs`, { cache: "no-store" }).then((r) =>
          r.json()
        ),
      ])
        .then(([levelsData, tabsData]) => {
          setLevels(levelsData.levels || levelsData.data || []);
          setTabs(tabsData.tabs || []);
        })
        .catch((err) => {
          console.error("Ошибка загрузки данных:", err);
          alert("Не удалось загрузить уровни или табы.");
        });
    }
  }, [project]);

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = project?.id
      ? `/api/admin/projects/${project.id}`
      : "/api/admin/projects";
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

  const addLevel = async () => {
    if (!newLevel.code || !newLevel.label || !project?.id) {
      alert("Заполните код и название уровня.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newLevel.code,
          label: newLevel.label,
          order_index: levels.length * 10,
          is_active: true,
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }
      const refreshRes = await fetch(`/api/admin/projects/${project.id}/levels`, {
        cache: "no-store",
      });
      const refreshData = await refreshRes.json();
      setLevels(refreshData.levels || refreshData.data || []);
      setNewLevel({ code: "", label: "" });
    } catch (err: any) {
      alert("❌ Ошибка добавления уровня: " + err.message);
    }
  };

  const saveTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id || !editingTab) return;

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/tabs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTab),
        cache: "no-store",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }
      setEditingTab(null);
      const refreshRes = await fetch(`/api/admin/projects/${project.id}/tabs`, {
        cache: "no-store",
      });
      const refreshData = await refreshRes.json();
      setTabs(refreshData.tabs || []);
    } catch (err: any) {
      alert("❌ Ошибка сохранения таба: " + err.message);
    }
  };

  const deleteTab = async (tabId: string) => {
    if (!project?.id) return;
    if (!window.confirm("Удалить этот раздел? (Убедитесь, что в нём нет материалов)")) return;

    try {
      const res = await fetch(
        `/api/admin/projects/${project.id}/tabs?id=${tabId}`,
        {
          method: "DELETE",
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка HTTP ${res.status}`);
      }
      setTabs(tabs.filter((t) => t.id !== tabId));
    } catch (err: any) {
      alert("❌ Ошибка удаления таба: " + err.message);
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

  const colorSettings: ColorSettings[] = [
    { label: "Основной (Кнопки, Акценты)", key: "primary", value: formData.theme.colors.primary },
    {
      label: "Второстепенный (Ховеры, Градиенты)",
      key: "secondary",
      value: formData.theme.colors.secondary,
    },
    { label: "Фон страницы", key: "pageBg", value: formData.theme.colors.pageBg },
    { label: "Фон карточек", key: "cardBg", value: formData.theme.colors.cardBg },
    { label: "Цвет текста", key: "textColor", value: formData.theme.colors.textColor },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">
          {project ? `Настройка ветки: ${project.name}` : "Новая ветка"}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 font-bold hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors"
        >
          Закрыть
        </button>
      </div>

      <form onSubmit={saveProject} className="space-y-8">
        {/* БАЗОВЫЕ НАСТРОЙКИ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">Название ветки</label>
            <input
              required
              className="w-full border-2 rounded-xl px-4 py-2"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Английский для детей"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">URL (Slug)</label>
            <input
              required
              className="w-full border-2 rounded-xl px-4 py-2"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="kids-english"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Лист Google Таблицы <span className="text-gray-400 font-normal text-xs">(Опционально)</span></label>
            <input
              className="w-full border-2 rounded-xl px-4 py-2"
              value={formData.sheet_name}
              onChange={(e) => setFormData({ ...formData, sheet_name: e.target.value })}
              placeholder="Напр: Заявки Hippo"
            />
            <p className="text-xs text-gray-400 mt-1">Оставьте пустым для записи в "Учёт"</p>
          </div>
          <div className="col-span-1 md:col-span-3">
            <label className="block text-sm font-bold mb-1">Описание на портале</label>
            <textarea
              className="w-full border-2 rounded-xl px-4 py-2"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Лучшие материалы для изучения..."
            />
          </div>
          {/* ✅ Фаза 2: переключатель is_active */}
          <div className="col-span-1 md:col-span-3">
            <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl border">
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span className="font-bold text-gray-800">Проект активен (виден на портале)</span>
            </label>
          </div>
        </div>

        {/* ДИЗАЙН СИСТЕМА И ЖИВОЕ ПРЕВЬЮ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold mb-1">🎨 Дизайн-система (Theme)</h3>
              <p className="text-sm text-gray-500 mb-4">
                Настройте цвета, которые будут применяться ко всей ветке.
              </p>
            </div>
            <div className="space-y-2">
              {colorSettings.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between p-3 bg-gray-50 border rounded-xl"
                >
                  <span className="text-sm font-bold text-gray-700">{c.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-500 uppercase">
                      {c.value}
                    </span>
                    <input
                      type="color"
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                      value={c.value}
                      onChange={(e) => handleThemeChange(c.key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold mb-1">👀 Живое превью</h3>
            <p className="text-sm text-gray-500 mb-4">
              Так будет выглядеть интерфейс для ученика.
            </p>
            <LivePreview colors={formData.theme.colors} />
          </div>
        </div>

        {/* ФИЧИ (ГЕЙМИФИКАЦИЯ) */}
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 border-t pt-6">
          <h3 className="font-bold text-blue-900 mb-1 text-lg">
            🎮 Модули платформы (Геймификация)
          </h3>
          <p className="text-sm text-blue-700/70 mb-4">
            Включите или отключите механики для этой ветки.
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded"
                checked={formData.features.streaks}
                onChange={() => toggleFeature("streaks")}
              />
              <span className="font-bold text-gray-800">🔥 Огненные стрики</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded"
                checked={formData.features.titles}
                onChange={() => toggleFeature("titles")}
              />
              <span className="font-bold text-gray-800">👑 Титулы</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded"
                checked={formData.features.leaderboard}
                onChange={() => toggleFeature("leaderboard")}
              />
              <span className="font-bold text-gray-800">🏆 Лидерборд</span>
            </label>
          </div>

          {/* ✅ Фаза 2: переключатель requestMode */}
          <div className="mt-6 pt-4 border-t border-blue-200/50">
            <div className="text-sm font-bold text-gray-800 mb-3">Режим выбора уровня в заявках:</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
                <input
                  type="radio"
                  name="requestMode"
                  value="class_level"
                  checked={formData.features.requestMode === "class_level"}
                  onChange={() => handleRequestModeChange("class_level")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-bold text-gray-800">📚 Класс (одиночный)</span>
                <span className="text-xs text-gray-500">(как в Олимпиаде)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border shadow-sm hover:shadow transition-all">
                <input
                  type="radio"
                  name="requestMode"
                  value="target_levels"
                  checked={formData.features.requestMode === "target_levels"}
                  onChange={() => handleRequestModeChange("target_levels")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-bold text-gray-800">🎯 Уровни (массив)</span>
                <span className="text-xs text-gray-500">(как в Gatehouse)</span>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-gray-900 hover:bg-gray-800 transition-colors text-white font-extrabold py-3.5 rounded-xl shadow-md"
        >
          💾 Сохранить ядро проекта
        </button>
      </form>

      {/* ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ (УРОВНИ И ТАБЫ) */}
      {project?.id && (
        <div className="space-y-8 border-t pt-8">
          {/* УПРАВЛЕНИЕ УРОВНЯМИ */}
          <div className="bg-gray-50/50 p-6 rounded-3xl border">
            <h3 className="text-xl font-bold mb-4">Уровни (Классы)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              {levels.map((l) => (
                <div
                  key={l.id}
                  className="bg-white border shadow-sm p-3 rounded-xl flex items-center justify-between"
                >
                  <span className="font-bold text-gray-800">{l.label}</span>
                  <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded-md">
                    {l.code}
                  </span>
                </div>
              ))}
              {levels.length === 0 && (
                <div className="text-sm text-gray-500 col-span-full">
                  Уровней пока нет
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 bg-white p-4 rounded-2xl border shadow-sm">
              <input
                className="border-2 rounded-xl px-4 py-2 flex-1 min-w-[150px] outline-none focus:border-blue-500 font-medium"
                placeholder="Код (например: hippo-1)"
                value={newLevel.code}
                onChange={(e) => setNewLevel({ ...newLevel, code: e.target.value })}
              />
              <input
                className="border-2 rounded-xl px-4 py-2 flex-1 min-w-[150px] outline-none focus:border-blue-500 font-medium"
                placeholder="Название (например: Hippo 1)"
                value={newLevel.label}
                onChange={(e) => setNewLevel({ ...newLevel, label: e.target.value })}
              />
              <button
                onClick={addLevel}
                type="button"
                className="bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold px-6 py-2.5 rounded-xl shadow-sm"
              >
                Добавить уровень
              </button>
            </div>
          </div>

          {/* УПРАВЛЕНИЕ ТАБАМИ (РАЗДЕЛАМИ) */}
          <div className="bg-gray-50/50 p-6 rounded-3xl border">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold">Разделы материалов (Табы)</h3>
              {!editingTab && (
                <button
                  type="button"
                  onClick={() =>
                    setEditingTab({
                      title: "",
                      slug: "",
                      icon: "📄",
                      order_index: tabs.length * 10,
                      is_active: true,
                      component_type: "materials",
                    })
                  }
                  className="bg-white hover:bg-gray-50 border shadow-sm transition-colors text-gray-800 px-5 py-2.5 rounded-xl font-bold text-sm"
                >
                  + Создать раздел
                </button>
              )}
            </div>

            {editingTab && (
              <form
                onSubmit={saveTab}
                className="bg-white p-6 rounded-2xl border shadow-md mb-6 relative"
              >
                <h4 className="font-bold text-lg mb-4 text-gray-800">
                  {editingTab.id ? "Редактирование раздела" : "Новый раздел"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Название (Title)
                    </label>
                    <input
                      required
                      className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500"
                      placeholder="Напр: Грамматика"
                      value={editingTab.title}
                      onChange={(e) =>
                        setEditingTab({ ...editingTab, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      URL (Slug)
                    </label>
                    <input
                      required
                      className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500 font-mono"
                      placeholder="grammar"
                      value={editingTab.slug}
                      onChange={(e) =>
                        setEditingTab({ ...editingTab, slug: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Иконка (Emoji)
                    </label>
                    <input
                      className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500 text-xl"
                      placeholder="📚"
                      value={editingTab.icon || ""}
                      onChange={(e) =>
                        setEditingTab({ ...editingTab, icon: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Порядок сортировки
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full border-2 rounded-xl px-4 py-2 font-medium outline-none focus:border-blue-500"
                      value={editingTab.order_index}
                      onChange={(e) =>
                        setEditingTab({
                          ...editingTab,
                          order_index: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer font-bold mt-5 p-3 bg-gray-50 rounded-xl border w-fit">
                  <input
                    type="checkbox"
                    checked={editingTab.is_active}
                    onChange={(e) =>
                      setEditingTab({ ...editingTab, is_active: e.target.checked })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">Отображать на сайте (Активен)</span>
                </label>

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-2.5 rounded-xl font-bold shadow-sm"
                  >
                    Сохранить раздел
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTab(null)}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors px-6 py-2.5 rounded-xl font-bold"
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
                      <th className="p-4 font-bold text-gray-600 text-center w-24">
                        Порядок
                      </th>
                      <th className="p-4 font-bold text-gray-600 text-center w-32">
                        Статус
                      </th>
                      <th className="p-4 w-48"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tabs.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-base text-gray-800 flex items-center gap-2">
                            <span className="text-xl">{t.icon}</span> {t.title}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">
                            /{t.slug}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-600">
                          {t.order_index}
                        </td>
                        <td className="p-4 text-center">
                          {t.is_active ? (
                            <span className="text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded-md">
                              Активен
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-md">
                              Скрыт
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingTab(t)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTab(t.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 transition-colors px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm"
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

            {!editingTab && tabs.length === 0 && (
              <div className="text-sm text-gray-500 bg-white border border-dashed rounded-2xl p-8 text-center font-bold">
                Вкладок пока нет. Создайте первую, чтобы начать загружать материалы!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}