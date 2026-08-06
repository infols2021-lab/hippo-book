"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import Modal from "@/components/Modal";
import RewardsModal from "@/components/rewards/RewardsModal";
import StreakLeaderboardModal from "@/components/rewards/StreakLeaderboardModal";

import "./profile.css";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ProfileData = {
  full_name: string;
  contact_phone: string;
  region: string;
  is_admin: boolean;
};

export type Stats = {
  totalMaterials: number;
  completedMaterials: number;
  successRate: number;
  totalAvailableAssignments: number;
  completedAvailableAssignments: number;
};

export type MaterialProgressItem = {
  kind: "textbook" | "crossword";
  id: string;
  title: string;
  completed: number;
  total: number;
  progressPercent: number;
  href: string;
  tabTitle?: string;
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  doneToday: boolean;
  tierCode: string;
  equippedTitle?: string | null;
  equippedAvatarUrl?: string | null;
};

type ProfileUpdateApiResponse = {
  ok?: boolean;
  error?: string;
  profile?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    contact_phone?: string | null;
    region?: string | null;
    is_admin?: boolean | null;
  } | null;
};

type AvailableProject = {
  id: string;
  name: string;
  slug: string;
  theme?: any;
  theme_color?: string;
};

type Props = {
  projectName: string;
  projectSlug: string;
  availableProjects: AvailableProject[];
  features: {
    streaks?: boolean;
    titles?: boolean;
    leaderboard?: boolean;
    [key: string]: any;
  };
  userId: string;
  userEmail: string;
  initialProfile: ProfileData;
  backgroundUrl: string | null;
  stats?: Stats | null;
  materialsProgress?: MaterialProgressItem[] | null;
  streak?: StreakData | null;
  equippedTitleLabel?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function regionLabel(region: string) {
  return region?.trim() ? region : "Не указана";
}
function phoneLabel(phone: string) {
  return phone?.trim() ? phone : "Не указан";
}
function nameLabel(name: string) {
  return name?.trim() ? name : "Ученик";
}

function toStorageProxyUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/api/storage/public/")) return value;
  if (value.startsWith("data:")) return value;
  const marker = "/storage/v1/object/public/";
  const idx = value.indexOf(marker);
  if (idx === -1) return value;
  const restWithQuery = value.slice(idx + marker.length);
  const cleanRest = restWithQuery.split("?")[0]?.split("#")[0] ?? "";
  const parts = cleanRest.split("/").filter(Boolean);
  const bucket = parts.shift();
  const path = parts.join("/");
  if (!bucket || !path) return value;
  return getStoragePublicUrl(bucket, path);
}

function normalizeUiErrorMessage(error: unknown, fallback = "Произошла ошибка") {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : error == null
      ? ""
      : String(error);
  const msg = raw.trim();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout")
  ) {
    return "Ошибка соединения с сервером";
  }
  return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileClient({
  projectName,
  projectSlug,
  availableProjects,
  features,
  userEmail,
  initialProfile,
  backgroundUrl,
  stats: statsProp,
  materialsProgress: progressProp,
  streak: streakProp,
  equippedTitleLabel = null,
}: Props) {
  const router = useRouter();
  const backgroundProxyUrl = useMemo(() => toStorageProxyUrl(backgroundUrl), [backgroundUrl]);

  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bgLoading, setBgLoading] = useState<boolean>(Boolean(backgroundProxyUrl));
  const [bgReady, setBgReady] = useState<boolean>(false);
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile.full_name ?? "");
  const [editPhone, setEditPhone] = useState(profile.contact_phone ?? "");
  const [editRegion, setEditRegion] = useState(profile.region ?? "");
  const [saving, setSaving] = useState(false);

  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const [stats, setStats] = useState<Stats | null>(statsProp ?? null);
  const [materialsProgress, setMaterialsProgress] = useState<MaterialProgressItem[] | null>(progressProp ?? null);
  const [progressLoading, setProgressLoading] = useState<boolean>(!statsProp && !progressProp);
  const [progressError, setProgressError] = useState<string | null>(null);

  // Категории материалов и аккордеон завершенных
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [completedExpanded, setCompletedExpanded] = useState<boolean>(false);

  const [streakData, setStreakData] = useState<StreakData | null>(
    streakProp ?? {
      currentStreak: 0,
      longestStreak: 0,
      doneToday: false,
      tierCode: "none",
      equippedTitle: equippedTitleLabel ?? null,
    }
  );
  const [streakLoading, setStreakLoading] = useState<boolean>(!streakProp);

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 3500);
  }

  const fetchStreakData = async () => {
    try {
      setStreakLoading(true);
      const res = await fetch("/api/streaks", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && (json.ok || json.success)) {
        const curr = json.streak?.currentStreak ?? json.currentStreak ?? json.stats?.currentStreak ?? 0;
        const longest = json.streak?.longestStreak ?? json.longestStreak ?? json.stats?.longestStreak ?? json.stats?.maxStreak ?? 0;
        const done = json.streak?.doneToday ?? json.stats?.doneToday ?? json.stats?.completedToday ?? false;
        const tier = json.streak?.tierCode ?? "none";
        const title = json.equippedTitle?.label ?? json.equippedTitle ?? null;
        const avatar = json.equippedAvatarUrl ?? null;

        setStreakData({
          currentStreak: Number(curr),
          longestStreak: Number(longest),
          doneToday: Boolean(done),
          tierCode: String(tier),
          equippedTitle: title ? String(title) : null,
          equippedAvatarUrl: avatar ? String(avatar) : null,
        });
      }
    } catch (e) {
      console.error("Ошибка получения стриков:", e);
    } finally {
      setStreakLoading(false);
    }
  };

  useEffect(() => {
    void fetchStreakData();
  }, []);

  useEffect(() => {
    const currProject = availableProjects.find(p => p.slug === projectSlug);
    const themeColor = currProject?.theme?.primaryColor || currProject?.theme_color || "#0ea5e9";

    document.body.style.setProperty('--project-primary', themeColor);
    document.body.style.setProperty('--accent2', themeColor);

    return () => {
      document.body.style.removeProperty('--project-primary');
      document.body.style.removeProperty('--accent2');
    };
  }, [projectSlug, availableProjects]);

  useEffect(() => {
    if (!backgroundProxyUrl) {
      setBgLoading(false);
      setBgReady(false);
      return;
    }
    setBgLoading(true);
    const img = new Image();
    img.onload = () => {
      setBgLoading(false);
      setBgReady(true);
    };
    img.onerror = () => {
      setBgLoading(false);
      setBgReady(false);
    };
    img.src = backgroundProxyUrl;
    const t = setTimeout(() => setBgLoading(false), 6000);
    return () => clearTimeout(t);
  }, [backgroundProxyUrl]);

  useEffect(() => {
    if (statsProp && progressProp) return;

    async function loadProgress() {
      try {
        setProgressLoading(true);
        setProgressError(null);
        const res = await fetch(`/api/profile-progress?slug=${projectSlug}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить прогресс");

        setStats(json.stats as Stats);
        setMaterialsProgress(json.materialsProgress as MaterialProgressItem[]);
      } catch (e: any) {
        setProgressError(normalizeUiErrorMessage(e, "Не удалось загрузить прогресс"));
      } finally {
        setProgressLoading(false);
      }
    }

    void loadProgress();
  }, [statsProp, progressProp, projectSlug]);

  function openRewards() {
    setRewardsModalOpen(true);
  }

  function openEdit() {
    setEditFullName(profile.full_name || "");
    setEditPhone(profile.contact_phone || "");
    setEditRegion(profile.region || "");
    setEditOpen(true);
  }

  async function saveProfile() {
    const fullName = editFullName.trim();
    const phone = editPhone.trim();
    const region = editRegion.trim();

    if (!fullName || !phone || !region) {
      showNotification("Заполните все поля", "error");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ full_name: fullName, contact_phone: phone, region }),
      });

      const json = (await res.json()) as ProfileUpdateApiResponse;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Не удалось обновить профиль");

      const updated = json.profile;
      setProfile((p) => ({
        ...p,
        full_name: updated?.full_name ?? fullName,
        contact_phone: updated?.contact_phone ?? phone,
        region: updated?.region ?? region,
      }));

      showNotification("Профиль успешно обновлён!");
      setEditOpen(false);
    } catch (e: any) {
      showNotification("Ошибка обновления профиля: " + normalizeUiErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } finally {
      window.location.href = "/login";
    }
  }

  // Фильтрация и разделение материалов на Активные / Завершенные
  const { filteredActive, filteredCompleted } = useMemo(() => {
    if (!materialsProgress) return { filteredActive: [], filteredCompleted: [] };

    const filtered = materialsProgress.filter((m) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "textbook") return m.kind === "textbook";
      if (selectedCategory === "crossword") return m.kind === "crossword";
      return m.tabTitle?.toLowerCase() === selectedCategory.toLowerCase();
    });

    return {
      filteredActive: filtered.filter((m) => m.progressPercent < 100),
      filteredCompleted: filtered.filter((m) => m.progressPercent === 100),
    };
  }, [materialsProgress, selectedCategory]);

  const overlayCss = backgroundProxyUrl && (bgReady || !bgLoading) ? `url('${backgroundProxyUrl}')` : "none";
  const brandMark = projectName.substring(0, 2).toUpperCase() || "EK";
  const titleText = streakData?.equippedTitle?.trim() || "Без титула";

  return (
    <div id="profileBody" className="profile-page" style={{ ["--profile-overlay" as any]: overlayCss }}>
      {bgLoading && (
        <div className="background-loading" style={{ display: "block" }}>
          <span className="spinner" /> Загружаем фон...
        </div>
      )}

      {notif && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: notif.type === "success" ? "#4caf50" : "#f44336",
            color: "white",
            padding: "14px 18px",
            borderRadius: 12,
            boxShadow: "0 14px 35px rgba(0,0,0,0.18)",
            zIndex: 10001,
            fontWeight: 800,
          }}
        >
          {notif.text}
        </div>
      )}

      {/* Модалка редактирования личных данных */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Редактирование профиля" maxWidth={520}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div className="form-group">
            <label htmlFor="editFullName">ФИО:</label>
            <input id="editFullName" className="input" type="text" required value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="editPhone">Контактный телефон:</label>
            <input id="editPhone" className="input" type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="editRegion">Область проживания:</label>
            <select id="editRegion" className="input" required value={editRegion} onChange={(e) => setEditRegion(e.target.value)}>
              <option value="">-- Выберите область --</option>
              <option value="Белгородская">Белгородская область</option>
              <option value="Курская">Курская область</option>
              <option value="Тамбовская">Тамбовская область</option>
              <option value="Воронежская">Воронежская область</option>
              <option value="Липецкая">Липецкая область</option>
              <option value="Другое">Другая область</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>Email:</label>
            <input type="email" className="input" value={userEmail} disabled />
            <div className="small-muted">Email нельзя изменить</div>
          </div>
          <div className="modal-actions" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => setEditOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </Modal>

      {/* 🎭 ЦЕНТР НАГРАД */}
      {rewardsModalOpen && (
        <RewardsModal
          isOpen={rewardsModalOpen}
          onClose={() => {
            setRewardsModalOpen(false);
            void fetchStreakData();
          }}
        />
      )}

      {/* 🏅 ТОП-20 ЛИДЕРБОРД */}
      {leaderboardOpen && (
        <StreakLeaderboardModal
          isOpen={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}

      {/* 📱 ВЫЕЗЖАЮЩЕЕ СНИЗУ МОБИЛЬНОЕ МЕНЮ (BOTTOM SHEET) */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-bottom-sheet-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-bottom-sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">Меню профиля</div>
            <div className="sheet-menu-list">
              <button className="sheet-item" onClick={() => { setMobileMenuOpen(false); openRewards(); }}>
                🎭 Награды и маскот
              </button>
              <Link className="sheet-item" href={`/projects/${projectSlug}/materials`} onClick={() => setMobileMenuOpen(false)}>
                📚 Все материалы
              </Link>
              <button className="sheet-item" onClick={() => { setMobileMenuOpen(false); openEdit(); }}>
                ✏️ Редактировать профиль
              </button>
              <button className="sheet-item" onClick={() => { setMobileMenuOpen(false); router.push(`/projects/${projectSlug}/requests`); }}>
                📦 Заявки на покупку
              </button>
              {profile.is_admin && (
                <Link className="sheet-item" href="/admin" onClick={() => setMobileMenuOpen(false)}>
                  ⚙️ Панель управления
                </Link>
              )}
              <Link className="sheet-item" href="/portal" onClick={() => setMobileMenuOpen(false)}>
                🌐 Главный портал
              </Link>
              <button className="sheet-item sheet-item--danger" onClick={() => void logout()}>
                🚪 Выйти
              </button>
            </div>
          </div>
        </>
      )}

      <div className="profile-container">
        
        {/* 📱 1. МОБИЛЬНАЯ ШАПКА (видна только <= 768px) */}
        <div className="mobile-header-bar">
          <div className="mobile-header-left">
            <div className="mobile-avatar" onClick={openRewards}>
              {streakData?.equippedAvatarUrl ? (
                <img src={streakData.equippedAvatarUrl} alt="Аватар" />
              ) : (
                <span>🎭</span>
              )}
            </div>
            <div className="mobile-user-info">
              <div className="mobile-user-name">{nameLabel(profile.full_name)}</div>
              {features?.streaks && (
                <button type="button" className="mobile-streak-pill" onClick={openRewards}>
                  🔥 {streakData?.currentStreak ?? 0} дн. серия
                </button>
              )}
            </div>
          </div>
          <button className="mobile-burger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Открыть меню">
            ☰
          </button>
        </div>

        {/* 🖥️ 2. ДЕСКТОПНАЯ ШАПКА (видна только > 768px) */}
        <div className="profile-topbar">
          <div className="brand-switcher-wrapper">
            <button 
              type="button" 
              className={`brand brand-interactive ${switcherOpen ? "open" : ""}`}
              onClick={() => setSwitcherOpen(!switcherOpen)}
            >
              <div className="brand-mark">{brandMark}</div>
              <div className="brand-text-wrapper">
                <div className="brand-title">{projectName}</div>
                <div className="brand-subtitle">Профиль ученика</div>
              </div>
              <div className="switcher-chevron">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </button>

            {switcherOpen && (
              <>
                <div className="switcher-overlay" onClick={() => setSwitcherOpen(false)} />
                <div className="project-switcher-menu">
                  <div className="switcher-header">Сменить направление</div>
                  <div className="switcher-list">
                    {availableProjects.map((p) => {
                      const isActive = p.slug === projectSlug;
                      const dotColor = p.theme?.primaryColor || p.theme_color || "#6366f1";
                      
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.slug}/profile`}
                          className={`project-switcher-item ${isActive ? "active" : ""}`}
                          onClick={() => setSwitcherOpen(false)}
                        >
                          <div className="switcher-dot" style={{ backgroundColor: dotColor }} />
                          <div className="switcher-item-name">{p.name}</div>
                          {isActive && <div className="switcher-item-check">✓</div>}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="switcher-footer">
                    <Link href="/portal" className="switcher-portal-link">
                      ← На главный портал
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="top-actions">
            {features?.streaks && (
              <button
                type="button"
                className="streak-chip"
                onClick={openRewards}
                title="Открыть Центр Наград"
              >
                <span className="streak-chip-icon" aria-hidden="true">🔥</span>
                <span className="streak-chip-main">
                  <span className="streak-chip-value">{streakLoading ? "…" : streakData?.currentStreak ?? 0}</span>
                  <span className="streak-chip-unit">дн.</span>
                </span>
                <span className="streak-chip-sub">{streakData?.doneToday ? "сделано" : "серия"}</span>
              </button>
            )}

            <button type="button" className="nav-pill" onClick={openRewards}>
              🎭 Награды
            </button>

            <Link className="nav-pill" href={`/projects/${projectSlug}/materials`}>
              📚 Материалы
            </Link>
            <button className="nav-pill nav-pill--logout" type="button" onClick={() => void logout()}>
              🚪 Выйти
            </button>
          </div>
        </div>

        {/* ── СЕТКА ПРОФИЛЯ ── */}
        <div className="profile-grid">
          
          {/* 🖥️ ЛЕВАЯ КОЛОНКА (Сайдбар только на ПК) */}
          <aside className="profile-panel profile-sidebar">
            <div
              className="profile-avatar-wrapper"
              onClick={openRewards}
              style={{ cursor: "pointer" }}
              title="Открыть гардероб Маскота"
            >
              {streakData?.equippedAvatarUrl ? (
                <img src={streakData.equippedAvatarUrl} alt="Маскот" className="profile-avatar-img" />
              ) : (
                <span style={{ fontSize: "48px" }}>🎭</span>
              )}
            </div>

            <div className="profile-name">{nameLabel(profile.full_name)}</div>
            <div className="profile-email">{userEmail || "—"}</div>

            {features?.titles && (
              <button
                type="button"
                className="profile-title-slot"
                onClick={openRewards}
                title="Сменить титул в гардеробе"
                style={{ cursor: "pointer", border: "none", marginBottom: "24px" }}
              >
                <span className="profile-title-slot-icon">🏷️</span>
                <span className="profile-title-slot-text">{titleText}</span>
              </button>
            )}

            <div className="details-list" style={{ width: "100%", marginBottom: "16px" }}>
              <div className="detail-item">
                <span className="detail-label">Телефон</span>
                <span className="detail-value">{phoneLabel(profile.contact_phone)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Регион</span>
                <span className="detail-value">{regionLabel(profile.region)}</span>
              </div>
            </div>

            {features?.streaks && (
              <div className="details-list" style={{ width: "100%", marginBottom: "24px" }}>
                <div className="detail-item" style={{ cursor: "pointer" }} onClick={openRewards}>
                  <span className="detail-label">Текущая серия</span>
                  <span className="detail-value" style={{ color: "var(--project-primary)" }}>
                    {streakLoading ? "…" : `${streakData?.currentStreak ?? 0} дн.`}
                  </span>
                </div>
                <div className="detail-item" style={{ cursor: "pointer" }} onClick={openRewards}>
                  <span className="detail-label">Рекорд</span>
                  <span className="detail-value">{streakLoading ? "…" : `${streakData?.longestStreak ?? 0} дн.`}</span>
                </div>
              </div>
            )}

            <div className="profile-actions">
              <button className="btn ghost" onClick={openEdit} type="button">
                Редактировать профиль
              </button>
              <button
                className="btn secondary"
                onClick={() => router.push(`/projects/${projectSlug}/requests`)}
                type="button"
              >
                Заявки на покупку
              </button>
              {profile.is_admin && (
                <Link className="btn info" href="/admin">
                  Панель управления
                </Link>
              )}
            </div>
          </aside>

          {/* ПРАВАЯ КОЛОНКА (Статистика и Материалы) */}
          <main className="profile-panel">
            
            {/* 🖥️ ДЕСКТОП СТАТИСТИКА */}
            <div className="section-title desktop-stats-title">
              Статистика <b>материалов</b>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats?.totalMaterials ?? "—"}</div>
                <div className="stat-label">Доступно материалов</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.completedMaterials ?? "—"}</div>
                <div className="stat-label">Пройдено полностью</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats ? `${stats.successRate}%` : "—"}</div>
                <div className="stat-label">Общий прогресс</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.totalAvailableAssignments ?? "—"}</div>
                <div className="stat-label">Доступно заданий</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.completedAvailableAssignments ?? "—"}</div>
                <div className="stat-label">Решено заданий</div>
              </div>
            </div>

            {/* 📱 МОБИЛЬНАЯ КОМПАКТНАЯ СТАТИСТИКА (4 плашки в ряд как на скрине) */}
            <div className="mobile-stats-row">
              <div className="mobile-stat-card">
                <div className="mobile-stat-val">{stats ? `${stats.successRate}%` : "0%"}</div>
                <div className="mobile-stat-lbl">прогресс</div>
              </div>
              <div className="mobile-stat-card">
                <div className="mobile-stat-val">{stats?.totalMaterials ?? 0}</div>
                <div className="mobile-stat-lbl">материалов</div>
              </div>
              <div className="mobile-stat-card">
                <div className="mobile-stat-val">{stats?.completedAvailableAssignments ?? 0}</div>
                <div className="mobile-stat-lbl">решено</div>
              </div>
              <div className="mobile-stat-card">
                <div className="mobile-stat-val">{stats?.totalAvailableAssignments ?? 0}</div>
                <div className="mobile-stat-lbl">заданий</div>
              </div>
            </div>

            {/* 📱 МОБИЛЬНЫЕ ТАБЫ-ФИЛЬТРЫ (Как на скрине: Все, Учебники, Кроссворды) */}
            <div className="mobile-category-bar no-scrollbar">
              <button 
                className={`mobile-cat-pill ${selectedCategory === "all" ? "active" : ""}`}
                onClick={() => setSelectedCategory("all")}
              >
                Все
              </button>
              <button 
                className={`mobile-cat-pill ${selectedCategory === "textbook" ? "active" : ""}`}
                onClick={() => setSelectedCategory("textbook")}
              >
                Учебники
              </button>
              <button 
                className={`mobile-cat-pill ${selectedCategory === "crossword" ? "active" : ""}`}
                onClick={() => setSelectedCategory("crossword")}
              >
                Кроссворды
              </button>
            </div>

            {progressLoading && (
              <div style={{ marginBottom: 24, fontWeight: 700, color: "var(--project-muted)" }}>
                Подгружаем прогресс...
              </div>
            )}
            {progressError && (
              <div style={{ marginBottom: 24, fontWeight: 800, color: "#ef4444" }}>
                Прогресс не загрузился: {progressError}
              </div>
            )}

            <div className="section-title desktop-stats-title">
              Прогресс <b>обучения</b>
            </div>

            {!materialsProgress ? (
              <div style={{ fontWeight: 700, color: "var(--project-muted)" }}>Загрузка материалов...</div>
            ) : materialsProgress.length === 0 ? (
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--project-muted)",
                  textAlign: "center",
                  padding: "40px",
                  background: "color-mix(in srgb, var(--project-text) 2%, transparent)",
                  borderRadius: "20px",
                }}
              >
                Материалы пока не доступны
                <div style={{ marginTop: 8, fontSize: "14px" }}>Обратитесь к администратору для получения доступа</div>
              </div>
            ) : (
              <>
                {/* АКТИВНЫЕ МАТЕРИАЛЫ */}
                <div className="progress-list">
                  {filteredActive.map((m) => (
                    <Link key={`${m.kind}-${m.id}`} href={m.href} className="progress-row" style={{ textDecoration: "none" }}>
                      <div className="progress-left">
                        <div className="progress-type">
                          {m.tabTitle ? m.tabTitle.toUpperCase() : m.kind === "textbook" ? "УЧЕБНИКИ" : "КРОССВОРДЫ"}
                        </div>
                        <div className="progress-title">{m.title}</div>
                        <div className="progress-sub">
                          {m.kind === "textbook"
                            ? `${m.completed} из ${m.total} заданий выполнено`
                            : `${m.completed} из ${m.total} слов отгадано`}
                          {m.total === 0 ? " (нет заданий)" : ""}
                        </div>
                      </div>
                      <div className="progress-right">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${m.progressPercent}%` }} />
                        </div>
                        <div className="progress-percent">{m.progressPercent}%</div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* 📱 СВОРАЧИВАЕМЫЙ АККОРДЕОН ДЛЯ ЗАВЕРШЕННЫХ (100%) МАТЕРИАЛОВ */}
                {filteredCompleted.length > 0 && (
                  <div className="completed-accordion">
                    <button 
                      className="accordion-trigger"
                      onClick={() => setCompletedExpanded(!completedExpanded)}
                    >
                      <span>Завершено ({filteredCompleted.length})</span>
                      <span className={`accordion-chevron ${completedExpanded ? "open" : ""}`}>▼</span>
                    </button>

                    {completedExpanded && (
                      <div className="accordion-content">
                        {filteredCompleted.map((m) => (
                          <Link key={`${m.kind}-${m.id}`} href={m.href} className="progress-row" style={{ textDecoration: "none" }}>
                            <div className="progress-left">
                              <div className="progress-type">
                                {m.tabTitle ? m.tabTitle.toUpperCase() : m.kind === "textbook" ? "УЧЕБНИКИ" : "КРОССВОРДЫ"}
                              </div>
                              <div className="progress-title">{m.title}</div>
                            </div>
                            <div className="progress-right">
                              <div className="progress-percent">100%</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="section-title" style={{ marginTop: "32px" }}>
              Служба <b>поддержки</b>
            </div>
            <ul className="info-list">
              <li className="info-li">
                <span className="info-bullet" />
                <span>
                  Возникли вопросы по материалам или платформе? Свяжитесь с нами:{" "}
                  <b>
                    <a
                      href="https://t.me/skebobingg"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--project-primary)", textDecoration: "none" }}
                    >
                      Telegram
                    </a>
                  </b>{" "}
                  или{" "}
                  <b>
                    <a
                      href="https://vk.com/bluntokyr"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--project-primary)", textDecoration: "none" }}
                    >
                      ВКонтакте
                    </a>
                  </b>
                  .
                </span>
              </li>
            </ul>
          </main>
        </div>
      </div>
    </div>
  );
}