// app/(app)/projects/[slug]/profile/ProfileClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import Modal from "@/components/Modal";
import RewardsModal from "@/components/rewards/RewardsModal";
import StreakLeaderboardModal from "@/components/rewards/StreakLeaderboardModal";
import { ReferralStats, ReferralMilestone } from "@/components/rewards/ReferralTimeline";
import { useTour } from "@/components/tour/TourProvider";

import "./profile.css";

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
  kind: "textbook" | "crossword" | string;
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

type RewardsTabType = "wardrobe" | "streaks" | "promocode" | "referrals";

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
  const { stage, advanceTour } = useTour();
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
  const [rewardsInitialTab, setRewardsInitialTab] = useState<RewardsTabType>("wardrobe");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const [stats, setStats] = useState<Stats | null>(statsProp ?? null);
  const [materialsProgress, setMaterialsProgress] = useState<MaterialProgressItem[] | null>(progressProp ?? null);
  const [progressLoading, setProgressLoading] = useState<boolean>(!statsProp && !progressProp);
  const [progressError, setProgressError] = useState<string | null>(null);

  const [refData, setRefData] = useState<{ link: string; stats: ReferralStats; track: ReferralMilestone[] } | null>(null);
  const [refLoading, setRefLoading] = useState(true);

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

  // Fallback: если пользователь вернулся из заявок через кнопку браузера "Назад"
  useEffect(() => {
    if (stage === "requests_info") {
      advanceTour("materials_gate");
    }
  }, [stage, advanceTour]);

  // На мобилке открываем меню, чтобы tour-таргеты были видимы
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile) return;

    if (stage === "profile_overview" || stage === "materials_gate" || stage === "rewards_gate") {
      setMobileMenuOpen(true);
    }
  }, [stage]);

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
    
    fetch('/api/profile/referrals', { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setRefData({
            link: data.referral_link,
            stats: data.stats,
            track: data.track
          });
        }
      })
      .catch(err => console.error("Ошибка загрузки рефералки:", err))
      .finally(() => setRefLoading(false));

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

  function openRewards(tab: RewardsTabType = "wardrobe") {
    setRewardsInitialTab(tab);
    setRewardsModalOpen(true);
    // Двигаем тур, если ждали клика по Наградам
    if (stage === "rewards_gate") {
      advanceTour("rewards_tour");
    }
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

  const dynamicCategories = useMemo(() => {
    if (!materialsProgress) return [];
    const map = new Map<string, string>(); 

    materialsProgress.forEach((item) => {
      if (item.tabTitle && item.tabTitle.trim()) {
        const id = item.tabTitle.toLowerCase().trim();
        if (!map.has(id)) {
          map.set(id, item.tabTitle.trim());
        }
      } else if (item.kind === "textbook") {
        if (!map.has("textbook")) map.set("textbook", "Учебники");
      } else if (item.kind === "crossword") {
        if (!map.has("crossword")) map.set("crossword", "Кроссворды");
      }
    });

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [materialsProgress]);

  const { filteredActive, filteredCompleted } = useMemo(() => {
    if (!materialsProgress) return { filteredActive: [], filteredCompleted: [] };

    const filtered = materialsProgress.filter((m) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "textbook") return m.kind === "textbook";
      if (selectedCategory === "crossword") return m.kind === "crossword";
      return m.tabTitle?.toLowerCase().trim() === selectedCategory.toLowerCase().trim();
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

      {rewardsModalOpen && (
        <RewardsModal
          isOpen={rewardsModalOpen}
          initialTab={rewardsInitialTab}
          onClose={() => {
            setRewardsModalOpen(false);
            void fetchStreakData();
          }}
        />
      )}

      {leaderboardOpen && (
        <StreakLeaderboardModal
          isOpen={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}

      {mobileMenuOpen && (
        <>
          <div className="mobile-bottom-sheet-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-bottom-sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">Меню профиля</div>
            <div className="sheet-menu-list">
              <button
                className="sheet-item"
                data-tour="rewards-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openRewards("wardrobe");
                }}
              >
                Награды и гардероб
              </button>
              <Link
                className="sheet-item"
                data-tour="materials-link"
                href={`/projects/${projectSlug}/materials`}
                onClick={() => {
                  if (stage === "materials_gate") advanceTour("rewards_gate");
                  setMobileMenuOpen(false);
                }}
              >
                Все материалы
              </Link>
              <button className="sheet-item" onClick={() => { setMobileMenuOpen(false); openEdit(); }}>
                Редактировать профиль
              </button>
              <button
                className="sheet-item"
                data-tour="requests-link"
                onClick={() => {
                  if (stage === "profile_overview") advanceTour("requests_info");
                  setMobileMenuOpen(false);
                  router.push(`/projects/${projectSlug}/requests`);
                }}
              >
                Заявки на покупку
              </button>
              {profile.is_admin && (
                <Link className="sheet-item" href="/admin" onClick={() => setMobileMenuOpen(false)}>
                  Панель управления
                </Link>
              )}
              <Link className="sheet-item" href="/portal" onClick={() => setMobileMenuOpen(false)}>
                Главный портал
              </Link>
              <button className="sheet-item sheet-item--danger" onClick={() => void logout()}>
                Выйти
              </button>
            </div>
          </div>
        </>
      )}

      <div className="profile-container">
        
        <div className="mobile-header-bar">
          <div className="mobile-header-left">
            <div className="mobile-avatar" onClick={() => openRewards("wardrobe")}>
              {streakData?.equippedAvatarUrl ? (
                <img src={streakData.equippedAvatarUrl} alt="Аватар" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              )}
            </div>
            <div className="mobile-user-info">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="skills-wordmark">skilLS</span>
                <span style={{ fontSize: "12px", opacity: 0.4 }}>•</span>
                <span className="mobile-user-name">{nameLabel(profile.full_name)}</span>
              </div>
              {features?.streaks && (
                <button type="button" className="mobile-streak-pill" onClick={() => openRewards("streaks")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '4px' }}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg> 
                  {streakData?.currentStreak ?? 0} дн. серия
                </button>
              )}
            </div>
          </div>
          <button className="mobile-burger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Открыть меню">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>

        <div className="profile-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span className="skills-wordmark">skilLS</span>
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
                            {isActive && <div className="switcher-item-check">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>}
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
          </div>

          <div className="top-actions">
            {features?.streaks && (
              <button
                type="button"
                className="streak-chip"
                onClick={() => openRewards("streaks")}
                title="Открыть Центр Наград"
              >
                <span className="streak-chip-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                </span>
                <span className="streak-chip-main">
                  <span className="streak-chip-value">{streakLoading ? "…" : streakData?.currentStreak ?? 0}</span>
                  <span className="streak-chip-unit">дн.</span>
                </span>
                <span className="streak-chip-sub">{streakData?.doneToday ? "сделано" : "серия"}</span>
              </button>
            )}

            <button
              data-tour="rewards-btn"
              type="button"
              className="nav-pill"
              onClick={() => openRewards("wardrobe")}
            >
              Награды
            </button>

            <Link
              data-tour="materials-link"
              className="nav-pill"
              href={`/projects/${projectSlug}/materials`}
              onClick={() => {
                if (stage === "materials_gate") advanceTour("rewards_gate");
              }}
            >
              Материалы
            </Link>
            <button className="nav-pill nav-pill--logout" type="button" onClick={() => void logout()}>
              Выйти
            </button>
          </div>
        </div>

        <div className="profile-grid">
          
          <aside className="profile-panel profile-sidebar">
            <div
              className="profile-avatar-wrapper"
              onClick={() => openRewards("wardrobe")}
              style={{ cursor: "pointer", display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Открыть гардероб Маскота"
            >
              {streakData?.equippedAvatarUrl ? (
                <img src={streakData.equippedAvatarUrl} alt="Маскот" className="profile-avatar-img" />
              ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              )}
            </div>

            <div className="profile-name">{nameLabel(profile.full_name)}</div>
            <div className="profile-email">{userEmail || "—"}</div>

            {features?.titles && (
              <button
                type="button"
                className="profile-title-slot"
                onClick={() => openRewards("wardrobe")}
                title="Сменить титул в гардеробе"
                style={{ cursor: "pointer", border: "none", marginBottom: "24px" }}
              >
                <span className="profile-title-slot-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                </span>
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
                <div className="detail-item" style={{ cursor: "pointer" }} onClick={() => openRewards("streaks")}>
                  <span className="detail-label">Текущая серия</span>
                  <span className="detail-value" style={{ color: "var(--project-primary)" }}>
                    {streakLoading ? "…" : `${streakData?.currentStreak ?? 0} дн.`}
                  </span>
                </div>
                <div className="detail-item" style={{ cursor: "pointer" }} onClick={() => openRewards("streaks")}>
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
                data-tour="requests-link"
                className="btn secondary"
                onClick={() => {
                  if (stage === "profile_overview") advanceTour("requests_info");
                  router.push(`/projects/${projectSlug}/requests`);
                }}
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

          <main className="profile-panel">
            
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

            <div 
              className="referral-promo-banner" 
              onClick={() => openRewards("referrals")}
              style={{
                background: "linear-gradient(135deg, var(--project-primary) 0%, #818cf8 100%)",
                borderRadius: "24px",
                padding: "24px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "32px",
                marginBottom: "32px",
                boxShadow: "0 10px 25px color-mix(in srgb, var(--project-primary) 30%, transparent)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
            >
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.2 0-2.12.8-2.5 1.9"></path><path d="M8.5 7.5A3.5 3.5 0 1 1 12 11a3.5 3.5 0 0 1-3.5-3.5z"></path><path d="M20 8v6"></path><path d="M23 11h-6"></path></svg>
                  Пригласи друга
                </h3>
                <p style={{ margin: 0, fontSize: "14px", opacity: 0.9, fontWeight: 500, maxWidth: "420px", lineHeight: 1.5 }}>
                  Делись ссылкой, зови друзей на платформу и получай эксклюзивные титулы, вещи для маскота и бесплатные материалы.
                </p>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.2)",
                padding: "10px 20px",
                borderRadius: "14px",
                fontWeight: 800,
                fontSize: "14px",
                backdropFilter: "blur(10px)",
                whiteSpace: "nowrap"
              }}>
                Открыть панель →
              </div>
            </div>

            <div className="category-filter-bar no-scrollbar">
              <button 
                type="button"
                className={`cat-pill ${selectedCategory === "all" ? "active" : ""}`}
                onClick={() => setSelectedCategory("all")}
              >
                Все
              </button>

              {dynamicCategories.map((cat) => (
                <button 
                  key={cat.id}
                  type="button"
                  className={`cat-pill ${selectedCategory === cat.id ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
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
                <div className="progress-list-scrollable no-scrollbar">
                  {filteredActive.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", fontWeight: 700, opacity: 0.6, fontSize: "14px" }}>
                      {filteredCompleted.length > 0
                        ? "Все материалы в этом разделе уже пройдены!"
                        : "В выбранной категории нет активных материалов"}
                    </div>
                  ) : (
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
                  )}
                </div>

                {filteredCompleted.length > 0 && (
                  <div className="completed-accordion">
                    <button 
                      type="button"
                      className="accordion-trigger"
                      onClick={() => setCompletedExpanded(!completedExpanded)}
                    >
                      <span>Завершено ({filteredCompleted.length})</span>
                      <span className={`accordion-chevron ${completedExpanded ? "open" : ""}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </span>
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
                              <div className="progress-percent" style={{ color: "#10b981" }}>100%</div>
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