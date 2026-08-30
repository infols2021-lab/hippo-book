// app/(app)/projects/[slug]/profile/ProfileClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import Modal from "@/components/Modal";
import StreakLeaderboardModal from "@/components/rewards/StreakLeaderboardModal";
import { ReferralStats, ReferralMilestone } from "@/components/rewards/ReferralTimeline";
import { useTour } from "@/components/tour/TourProvider";
import {
  dispatchTourPageReady,
  dispatchTourRewardsForceTab,
} from "@/lib/tour/tourMobile";
import { saveTourProgress, clearTourProgress } from "@/lib/tour/tourPersistence";
import ProjectHeader from "@/components/projects/ProjectHeader";

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
  const [unreadProfileSlugs, setUnreadProfileSlugs] = useState<Set<string>>(new Set());
  
  const [bgLoading, setBgLoading] = useState<boolean>(Boolean(backgroundProxyUrl));
  const [bgReady, setBgReady] = useState<boolean>(false);
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false); // Модалка поддержки для мобилок
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  
  const [editFullName, setEditFullName] = useState(profile.full_name ?? "");
  const [editPhone, setEditPhone] = useState(profile.contact_phone ?? "");
  const [editRegion, setEditRegion] = useState(profile.region ?? "");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    dispatchTourPageReady();
  }, []);

  useEffect(() => {
    fetch("/api/notifications/unread", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const arr = Array.isArray(j?.notifications) ? j.notifications : [];
        const s = new Set<string>();
        for (const n of arr) {
          if (n?.project_slug) s.add(String(n.project_slug));
        }
        setUnreadProfileSlugs(s);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (stage === "materials_profile_gate") {
      advanceTour("rewards_gate");
    }
  }, [stage, advanceTour]);

  useEffect(() => {
    if (stage === "rewards_gate" || stage === "rewards_tour" || stage === "profile_requests_gate") {
      dispatchTourPageReady();
    }
  }, [stage]);

  // Fallback при «Назад» в браузере
  useEffect(() => {
    const onPopState = () => {
      if (stage === "tour_complete" && /\/profile\/?$/.test(window.location.pathname)) {
        dispatchTourPageReady();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [stage]);

  useEffect(() => {
    if (stage === "rewards_tour") {
      clearTourProgress();
      saveTourProgress("rewards_tour", 0, window.location.pathname + `/rewards`);
      dispatchTourRewardsForceTab("wardrobe");
      if (!/\/rewards\/?$/.test(window.location.pathname)) {
        router.replace(`/projects/${projectSlug}/rewards`);
      }
    }
    if (stage === "tour_complete") {
      dispatchTourPageReady();
    }
    if (stage === "profile_requests_gate") {
      if (window.location.pathname.includes("/rewards")) {
        router.replace(`/projects/${projectSlug}/profile`);
      }
    }
  }, [stage, router, projectSlug]);

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
    // Награды теперь на отдельной странице. При первом открытии из тура —
    // сохраняем прогресс тура и переходим в "rewards_tour".
    if (stage === "rewards_gate") {
      clearTourProgress();
      saveTourProgress("rewards_tour", 0, window.location.pathname + `/rewards`);
      advanceTour("rewards_tour");
    }
    const tabParam = tab === "wardrobe" ? "" : `?tab=${tab}`;
    router.push(`/projects/${projectSlug}/rewards${tabParam}`);
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
        const tabTitleLower = item.tabTitle.toLowerCase().trim();
        if (!map.has(tabTitleLower)) {
          map.set(tabTitleLower, item.tabTitle.trim());
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
      return m.tabTitle?.toLowerCase().trim() === selectedCategory;
    });

    return {
      filteredActive: filtered.filter((m) => m.progressPercent < 100),
      filteredCompleted: filtered.filter((m) => m.progressPercent === 100),
    };
  }, [materialsProgress, selectedCategory]);

  const overlayCss = backgroundProxyUrl && (bgReady || !bgLoading) ? `url('${backgroundProxyUrl}')` : "none";
  const brandMark = projectName.substring(0, 2).toUpperCase() || "EK";
  const titleText = streakData?.equippedTitle?.trim() || "Без титула";

  // Универсальный компонент выбора ветки
  const ProjectSwitcherUI = (
    <div className="brand-switcher-wrapper" style={{ flex: 1, minWidth: 0 }}>
      <button 
        type="button" 
        className={`brand brand-interactive ${switcherOpen ? "open" : ""}`} data-tour="project-switcher"
        onClick={() => {
          if (stage === "profile_stats") advanceTour("materials_gate");
          setSwitcherOpen(!switcherOpen);
        }}
        style={{ width: "100%", justifyContent: "space-between", padding: "8px 12px 8px 8px", boxSizing: "border-box" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div className="brand-mark" style={{ flexShrink: 0 }}>{brandMark}</div>
          <div className="brand-text-wrapper" style={{ alignItems: "flex-start", minWidth: 0, overflow: "hidden" }}>
            <div className="brand-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{projectName}</div>
            <div className="brand-subtitle">Профиль ученика</div>
          </div>
        </div>
        <div className="switcher-chevron" style={{ flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </button>

      {switcherOpen && (
        <>
          <div className="switcher-overlay" onClick={() => setSwitcherOpen(false)} />
          <div className="project-switcher-menu" style={{ width: "100%" }}>
            <div className="switcher-header">Сменить направление</div>
            <div className="switcher-list">
              {availableProjects.map((p) => {
                const isActive = p.slug === projectSlug;
                const dotColor = p.theme?.primaryColor || p.theme_color || "#6366f1";
                const hasNew = unreadProfileSlugs.has(p.slug);
                
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.slug}/profile`}
                    className={`project-switcher-item ${isActive ? "active" : ""} ${hasNew ? "has-new" : ""}`}
                    onClick={() => setSwitcherOpen(false)}
                  >
                    <div className="switcher-dot" style={{ backgroundColor: dotColor }} />
                    <div className="switcher-item-name">{p.name}</div>
                    {hasNew && <div className="switcher-item-new" title="">!</div>}
                    {isActive && <div className="switcher-item-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>}
                  </Link>
                );
              })}
            </div>
            {unreadProfileSlugs.size > 0 && (
              <div className="switcher-legend">
                <span className="legend-red">• Красная метка ! - доступен новый материал</span>
              </div>
            )}
            <div className="switcher-footer">
              <Link href="/portal" className="switcher-portal-link">
                ← На главный портал
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );

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

      {/* Модалка Службы поддержки для мобилок */}
      <Modal open={supportOpen} onClose={() => setSupportOpen(false)} title="Служба поддержки" maxWidth={400}>
        <div style={{ color: "var(--project-text)", fontSize: "15px", lineHeight: "1.5" }}>
          <p style={{ marginBottom: "24px", fontWeight: 500 }}>
            Обычно администратор отвечает в течение 2 часов. Выберите удобный способ связи:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <a
              href="https://t.me/skebobingg"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                padding: "14px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #24a1de, #208ec4)",
                color: "#fff",
                fontWeight: 800,
                textAlign: "center",
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(36, 161, 222, 0.2)",
              }}
            >
              Написать в Telegram
            </a>
            <a
              href="https://vk.com/bluntokyr"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                padding: "14px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #0077ff, #0066da)",
                color: "#fff",
                fontWeight: 800,
                textAlign: "center",
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(0, 119, 255, 0.2)",
              }}
            >
              Написать во ВКонтакте
            </a>
          </div>
        </div>
      </Modal>

      {/* Модалка подтверждения выхода из аккаунта */}
      <Modal open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} title="Выход из аккаунта" maxWidth={420}>
        <div style={{ textAlign: "center" }} data-tour="logout-confirm-modal">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)",
              color: "#ef4444",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </div>
          <p style={{ margin: "0 0 24px", fontWeight: 700, fontSize: "16px", lineHeight: 1.45, color: "var(--project-text)" }}>
            Вы уверены, что хотите выйти из аккаунта?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={() => void logout()}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                background: "#ef4444",
                color: "#fff",
                fontWeight: 900,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(239, 68, 68, 0.3)",
              }}
            >
              Да, выйти
            </button>
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(false)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                background: "color-mix(in srgb, var(--project-text) 6%, transparent)",
                color: "var(--project-text)",
                fontWeight: 800,
                fontSize: "14px",
                border: "1px solid var(--glass-border)",
                cursor: "pointer",
              }}
            >
              Нет, остаться
            </button>
          </div>
        </div>
      </Modal>

      {leaderboardOpen && (
        <StreakLeaderboardModal
          isOpen={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}

      <div className="profile-container">
        
        {/* ========================================================= */}
        {/* MOBILIE PROFILE HEADER (TELEGRAM STYLE) - HIDDEN ON DESKTOP */}
        {/* ========================================================= */}
        <div className="md:hidden flex flex-col items-center w-full pt-4 pb-2">
          
          <div className="w-full mb-6 relative z-40 flex items-center gap-2">
            <div className="flex-1 min-w-0">{ProjectSwitcherUI}</div>
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              aria-label="Выйти из аккаунта"
              title="Выйти из аккаунта"
              className="flex-shrink-0 w-[46px] h-[46px] rounded-2xl flex items-center justify-center transition-all active:scale-95"
              style={{
                backgroundColor: "color-mix(in srgb, #ef4444 10%, var(--project-card-bg))",
                border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
                color: "#ef4444",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>

          <div
            className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-[3px] shadow-lg mb-4"
            onClick={() => openRewards("wardrobe")}
            data-tour="profile-avatar"
            style={{ 
              borderColor: "var(--project-card-bg)", 
              backgroundColor: "color-mix(in srgb, var(--project-text) 5%, transparent)",
            }}
          >
            {streakData?.equippedAvatarUrl ? (
              <img src={streakData.equippedAvatarUrl} alt="Аватар" className="w-full h-full object-cover" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </div>

          <h1 className="text-[22px] font-black leading-tight text-center px-4" style={{ color: "var(--project-text)" }}>
            {nameLabel(profile.full_name)}
          </h1>

          {/* Премиальный мобильный титул (плашка-табличка, без эмодзи) */}
          <button
            type="button"
            onClick={() => openRewards("wardrobe")}
            data-tour="profile-title"
            className="mobile-title-plate"
            style={{ marginTop: "14px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="6"></circle>
              <path d="M15.5 13 17 22l-5-3-5 3 1.5-9"></path>
            </svg>
            <span>{titleText}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {/* Премиальный мобильный стрик (огонёк серии, как на ПК) */}
          {features?.streaks && (
            <button
              type="button"
              onClick={() => openRewards("streaks")}
              className="mobile-streak-chip"
              style={{ marginTop: "14px" }}
            >
              <span className="mobile-streak-chip-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                </svg>
              </span>
              <span className="mobile-streak-main">
                <span className="mobile-streak-value">
                  {streakLoading ? "…" : streakData?.currentStreak ?? 0}
                </span>
                <span className="mobile-streak-unit">дн.</span>
              </span>
              <span className="mobile-streak-sub">
                {streakLoading ? "загрузка" : streakData?.doneToday ? "сделано" : "серия"}
              </span>
            </button>
          )}

          <div className="flex w-full gap-3 mt-6">
            <button 
              className="flex-1 py-3 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95" 
              onClick={openEdit}
              style={{ backgroundColor: "var(--project-card-bg)", border: "1px solid var(--glass-border)", color: "var(--project-text)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Изменить
            </button>
            <button 
              className="flex-1 py-3 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95" 
              onClick={() => setSupportOpen(true)}
              style={{ backgroundColor: "var(--project-card-bg)", border: "1px solid var(--glass-border)", color: "var(--project-text)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              Поддержка
            </button>
          </div>

          <div 
            className="w-full mt-5 rounded-[20px] p-5 flex flex-col gap-4 shadow-sm"
            style={{ backgroundColor: "var(--project-card-bg)", border: "1px solid var(--glass-border)" }}
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)" }}>Телефон</span>
              <span className="text-[16px] font-bold" style={{ color: "var(--project-text)" }}>{phoneLabel(profile.contact_phone)}</span>
            </div>
            <div className="h-px w-full" style={{ backgroundColor: "var(--glass-border)" }} />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)" }}>Email</span>
              <span className="text-[16px] font-bold" style={{ color: "var(--project-text)" }}>{userEmail || "—"}</span>
            </div>
            <div className="h-px w-full" style={{ backgroundColor: "var(--glass-border)" }} />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)" }}>Регион</span>
              <span className="text-[16px] font-bold" style={{ color: "var(--project-text)" }}>{regionLabel(profile.region)}</span>
            </div>
          </div>
        </div>
        {/* ========================================================= */}

        {/* DESKTOP TOPBAR (единая шапка со всеми страницами) */}
        <ProjectHeader
          slug={projectSlug}
          projectName={projectName}
          markText={brandMark}
          subtitle="Профиль ученика"
          left={
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1, minWidth: 0 }}>
              <span className="skills-wordmark">skilLS</span>
              {ProjectSwitcherUI}
            </div>
          }
        />

        <div className="profile-grid">
          
          {/* DESKTOP SIDEBAR */}
          <aside className="profile-panel profile-sidebar hidden md:flex">
            <div
              className="profile-avatar-wrapper"
              data-tour="profile-avatar"
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
                data-tour="profile-title"
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

            <div className="details-list" data-tour="profile-details" style={{ width: "100%", marginBottom: "16px" }}>
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
              {profile.is_admin && (
                <Link className="btn info" href="/admin">
                  Панель управления
                </Link>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="profile-panel" style={{ paddingTop: 0 }}>
            
            {/* Статистика скрыта на смартфонах */}
            <div className="section-title desktop-stats-title hidden md:block mt-6">
              Статистика <b>материалов</b>
            </div>
            <div className="stats-grid hidden md:grid" data-tour="profile-stats">
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

            <div 
              className="referral-promo-banner" 
              onClick={() => openRewards("referrals")}
              style={{
                background: "linear-gradient(135deg, var(--project-primary) 0%, #818cf8 100%)",
                borderRadius: "20px",
                padding: "16px 20px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "16px",
                marginBottom: "24px",
                boxShadow: "0 10px 25px color-mix(in srgb, var(--project-primary) 30%, transparent)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
            >
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.2 0-2.12.8-2.5 1.9"></path><path d="M8.5 7.5A3.5 3.5 0 1 1 12 11a3.5 3.5 0 0 1-3.5-3.5z"></path><path d="M20 8v6"></path><path d="M23 11h-6"></path></svg>
                  Пригласи друга
                </h3>
                <p style={{ margin: 0, fontSize: "13px", opacity: 0.95, fontWeight: 500, maxWidth: "400px", lineHeight: 1.4 }}>
                  Делись ссылкой, зови друзей на платформу и получай эксклюзивные титулы, вещи для маскота и бесплатные материалы.
                </p>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.2)",
                padding: "10px 16px",
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: "13px",
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

            <div className="section-title support-title hidden md:block" style={{ marginTop: "32px" }}>
              Служба <b>поддержки</b>
            </div>
            <ul className="info-list hidden md:block">
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