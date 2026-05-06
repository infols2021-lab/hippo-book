"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import * as Roadmap from "@/lib/streaks/roadmap";

type StreakSnapshotLike =
  | {
      today?: string;
      raw_current_streak?: number;
      display_current_streak?: number;
      longest_streak?: number;
      last_completed_date?: string | null;
      done_today?: boolean;
      can_save_today?: boolean;
      tier_code?: string;
    }
  | null;

type NormalizedMilestone = {
  kind: "icon" | "title";

  code: string;
  dbCode?: string | null;

  label: string;
  day: number;
  description?: string;

  emoji?: string;
  publicUrl?: string | null;
  candidatePublicUrls?: string[] | null;
  cacheTag?: string | null;
};

type RoadmapRow = {
  day: number;
  title?: NormalizedMilestone;
  icon?: NormalizedMilestone;
};

type ApiIconRow = Record<string, any>;
type ApiTitleRow = Record<string, any>;

type Props = {
  open: boolean;
  onClose: () => void;

  streak?: StreakSnapshotLike;
  loading?: boolean;
  error?: string | null;

  equippedTitleLabel?: string | null;

  unlockedIconCodes?: string[] | null;
  selectedIconCode?: string | null;
  onSelectIconCode?: (code: string) => void;
};

const ROADMAP_BG_BUCKET =
  process.env.NEXT_PUBLIC_STREAK_ROADMAP_BG_BUCKET ||
  process.env.NEXT_PUBLIC_STREAK_ROADMAP_BG_BUCKET_NAME ||
  "streak-roadmap-bg";

const ROADMAP_BG_WEBP_PATH = "v1/defaults/roadmap-bg(1).webp";
const ROADMAP_BG_PNG_PATH = "v1/defaults/roadmap-bg(1).png";

let ROADMAP_BG_CACHED_URL: string | null | undefined = undefined;

function tryLoadImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      resolve(true);
    }
  });
}

async function resolveRoadmapBgUrl(): Promise<string | null> {
  if (ROADMAP_BG_CACHED_URL !== undefined) return ROADMAP_BG_CACHED_URL ?? null;

  const webp = getStoragePublicUrl(ROADMAP_BG_BUCKET, ROADMAP_BG_WEBP_PATH);
  const png = getStoragePublicUrl(ROADMAP_BG_BUCKET, ROADMAP_BG_PNG_PATH);

  if (webp) {
    const ok = await tryLoadImage(webp);
    if (ok) {
      ROADMAP_BG_CACHED_URL = webp;
      return webp;
    }
  }

  if (png) {
    const ok = await tryLoadImage(png);
    if (ok) {
      ROADMAP_BG_CACHED_URL = png;
      return png;
    }
  }

  ROADMAP_BG_CACHED_URL = null;
  return null;
}

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function titleCaseFromCode(code: string) {
  return String(code || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function guessIconEmoji(code: string, label?: string) {
  const s = `${code} ${label ?? ""}`.toLowerCase();
  if (s.includes("start") || s.includes("старт")) return "✨";
  if (s.includes("bronze") || s.includes("бронз")) return "🥉";
  if (s.includes("silver") || s.includes("сереб")) return "🥈";
  if (s.includes("gold") || s.includes("золот")) return "🥇";
  if (s.includes("diamond") || s.includes("алмаз")) return "💎";
  if (s.includes("legend") || s.includes("легенд")) return "👑";
  if (s.includes("platinum") || s.includes("платин") || s.includes("prism")) return "🌌";
  if (s.includes("hippo") || s.includes("бегем")) return "🦛";
  return "🎖️";
}

function normalizeDbIconCode(code: string | null | undefined): string | null {
  if (!code) return null;

  let s = String(code).trim();
  if (!s) return null;

  s = s.split("#")[0] ?? s;
  s = s.split("?")[0] ?? s;

  s = s.replace(/\\/g, "/");
  const base = s.split("/").filter(Boolean).at(-1) ?? s;

  const noExt = base.replace(/\.(webp|png|jpg|jpeg|svg)$/i, "").trim();

  return noExt ? noExt : null;
}

function resolveTierCodeForUi(currentStreak: number, serverTierCode?: string) {
  const fn = (Roadmap as any).getTierCodeByStreak;

  if (typeof fn === "function") {
    try {
      const t = fn(currentStreak);
      if (typeof t === "string" && t.trim()) return t.trim();
    } catch {}
  }

  return String(serverTierCode || "").trim().toLowerCase();
}

function getTierBadge(tierCode?: string, streakValue?: number) {
  const s = String(tierCode || "").toLowerCase();
  const v = Math.max(0, num(streakValue));

  if (s === "legendary") return { icon: "👑", label: "Легендарный" };
  if (s === "diamond") return { icon: "💎", label: "Алмазный" };
  if (s === "platinum") return { icon: "🌌", label: "Платиновый" };
  if (s === "gold") return { icon: "🥇", label: "Золотой" };
  if (s === "silver") return { icon: "🥈", label: "Серебряный" };
  if (s === "bronze") return { icon: "🥉", label: "Бронзовый" };

  return { icon: v > 0 ? "🔥" : "✨", label: v > 0 ? "Серия" : "Нет серии" };
}

function buildRoadmapRows(icons: NormalizedMilestone[], titles: NormalizedMilestone[]): RoadmapRow[] {
  const map = new Map<number, RoadmapRow>();

  const put = (m: NormalizedMilestone) => {
    const day = Math.max(1, Math.floor(num(m.day, 0)));
    const row = map.get(day) ?? { day };

    if (m.kind === "title") {
      if (!row.title) row.title = m;
    } else {
      if (!row.icon) row.icon = m;
    }

    map.set(day, row);
  };

  titles.forEach(put);
  icons.forEach(put);

  return [...map.values()].sort((a, b) => a.day - b.day);
}

function computeRailProgressPercent(currentStreak: number, rows: RoadmapRow[]) {
  const s = Math.max(0, num(currentStreak));

  if (!rows.length) return 0;
  if (rows.length === 1) return s >= rows[0].day ? 100 : 0;

  const firstDay = rows[0].day;
  const lastDay = rows[rows.length - 1].day;

  if (s <= firstDay) {
    return clamp((s / Math.max(1, firstDay)) * (100 / Math.max(1, rows.length - 1)) * 0.35, 0, 100);
  }

  if (s >= lastDay) return 100;

  let prevIndex = 0;

  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].day <= s) prevIndex = i;
    else break;
  }

  const nextIndex = Math.min(rows.length - 1, prevIndex + 1);
  const prevDay = rows[prevIndex].day;
  const nextDay = rows[nextIndex].day;

  if (nextIndex === prevIndex) return 100;

  const segmentProgress = clamp((s - prevDay) / Math.max(1, nextDay - prevDay), 0, 1);
  const virtualIndex = prevIndex + segmentProgress;
  const totalSegments = Math.max(1, rows.length - 1);

  return clamp((virtualIndex / totalSegments) * 100, 0, 100);
}

function normalizeDbTitleRow(row: ApiTitleRow, idx: number): NormalizedMilestone | null {
  if (!row || typeof row !== "object") return null;

  const code = String(row.code ?? row.title_code ?? row.titleCode ?? row.id ?? `title_${idx + 1}`).trim();
  if (!code) return null;

  const day = Math.max(
    0,
    Math.floor(
      num(
        row.unlockAt ??
          row.unlock_at ??
          row.day ??
          row.days ??
          row.requiredDays ??
          row.required_days,
        0,
      ),
    ),
  );

  if (day <= 0) return null;

  const label = String(
    row.label ?? row.title ?? row.name ?? row.display_name ?? row.displayName ?? titleCaseFromCode(code),
  ).trim();

  const description = String(row.description ?? row.desc ?? row.subtitle ?? row.note ?? "").trim() || undefined;

  return { kind: "title", code, label, day, description };
}

function normalizeDbIconRow(row: ApiIconRow, idx: number): NormalizedMilestone | null {
  if (!row || typeof row !== "object") return null;

  const rawDbCode = String(row.code ?? row.icon_code ?? row.iconCode ?? row.id ?? row.key ?? `icon_${idx + 1}`).trim();
  const dbCode = normalizeDbIconCode(rawDbCode);

  if (!dbCode) return null;

  const day = Math.max(
    0,
    Math.floor(
      num(
        row.unlockAt ??
          row.unlock_at ??
          row.unlockDay ??
          row.unlock_day ??
          row.day ??
          row.days ??
          row.requiredDays ??
          row.required_days ??
          (row.meta && (row.meta.unlock_at ?? row.meta.unlockAt ?? row.meta.day)) ??
          0,
        0,
      ),
    ),
  );

  if (day <= 0) return null;

  const label = String(row.label ?? row.title ?? row.name ?? row.fullLabel ?? row.display_name ?? dbCode).trim();

  const emojiFallback = String(row.emojiFallback ?? row.emoji_fallback ?? row.emoji ?? "").trim();
  const emoji = emojiFallback || guessIconEmoji(dbCode, label);

  const publicUrl = typeof row.publicUrl === "string" ? row.publicUrl : null;
  const candidatePublicUrls = Array.isArray(row.candidatePublicUrls) ? row.candidatePublicUrls : null;
  const cacheTag = typeof row.cacheTag === "string" ? row.cacheTag : null;

  return {
    kind: "icon",
    code: dbCode,
    dbCode,
    label,
    day,
    description: String(row.description ?? row.desc ?? row.subtitle ?? "").trim() || undefined,
    emoji,
    publicUrl,
    candidatePublicUrls,
    cacheTag,
  };
}

function dedupeByDayKeepFirst<T extends { day: number }>(list: T[]) {
  const map = new Map<number, T>();

  for (const item of list) {
    if (!map.has(item.day)) map.set(item.day, item);
  }

  return [...map.values()].sort((a, b) => a.day - b.day);
}

function safeUniqUrls(urls: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const u of urls) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s || seen.has(s)) continue;

    seen.add(s);
    out.push(s);
  }

  return out;
}

function getSelectableCodeForIcon(m: NormalizedMilestone) {
  return normalizeDbIconCode(m.dbCode ?? null) ?? normalizeDbIconCode(m.code) ?? m.code;
}

function IconThumb({
  urls,
  emoji,
  alt,
  size,
  radius = 14,
}: {
  urls: string[];
  emoji: string;
  alt: string;
  size: number;
  radius?: number;
}) {
  const urlKey = urls.join("|");
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [urlKey]);

  const currentUrl = urls[idx] ?? "";
  const showImg = Boolean(currentUrl);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: Math.round(size * 0.52),
          opacity: loaded ? 0 : 1,
          transition: "opacity 140ms ease",
          lineHeight: 1,
        }}
      >
        {emoji}
      </div>

      {showImg ? (
        <img
          key={currentUrl}
          src={currentUrl}
          alt={alt}
          draggable={false}
          loading="eager"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: loaded ? 1 : 0,
            transition: "opacity 140ms ease",
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.10))",
          }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (idx + 1 < urls.length) setIdx(idx + 1);
          }}
        />
      ) : null}
    </div>
  );
}

type DbRoadmapPayload = {
  iconCatalog?: any[] | null;
  titleCatalog?: any[] | null;
};

async function fetchDbRoadmap(): Promise<DbRoadmapPayload> {
  const res = await fetch("/api/profile-streak", { method: "GET", cache: "no-store" });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Не удалось загрузить дорожку");
  }

  return {
    iconCatalog: Array.isArray(json.iconCatalog) ? json.iconCatalog : null,
    titleCatalog: Array.isArray(json.titleCatalog) ? json.titleCatalog : null,
  };
}

export default function StreakRoadmapModal({
  open,
  onClose,
  streak,
  loading = false,
  error = null,
  equippedTitleLabel = null,
  unlockedIconCodes = null,
  selectedIconCode = null,
  onSelectIconCode,
}: Props) {
  const currentStreak = Math.max(0, num(streak?.display_current_streak));
  const longestStreak = Math.max(0, num(streak?.longest_streak));
  const doneToday = Boolean(streak?.done_today);

  const resolvedTierCode = resolveTierCodeForUi(currentStreak, streak?.tier_code);
  const tierBadge = getTierBadge(resolvedTierCode, currentStreak);

  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [dbIconsRaw, setDbIconsRaw] = useState<any[] | null>(null);
  const [dbTitlesRaw, setDbTitlesRaw] = useState<any[] | null>(null);

  const [roadmapBgUrl, setRoadmapBgUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!open) return;

    resolveRoadmapBgUrl()
      .then((url) => {
        if (!alive) return;
        setRoadmapBgUrl(url);
      })
      .catch(() => {
        if (!alive) return;
        setRoadmapBgUrl(null);
      });

    setDbError(null);
    setDbLoading(true);

    setDbIconsRaw(null);
    setDbTitlesRaw(null);

    fetchDbRoadmap()
      .then((payload) => {
        if (!alive) return;

        setDbIconsRaw(Array.isArray(payload.iconCatalog) ? payload.iconCatalog : []);
        setDbTitlesRaw(Array.isArray(payload.titleCatalog) ? payload.titleCatalog : []);
        setDbLoading(false);
      })
      .catch((e: any) => {
        if (!alive) return;

        setDbLoading(false);
        setDbError(String(e?.message || "Не удалось загрузить дорожку"));
        setDbIconsRaw([]);
        setDbTitlesRaw([]);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  const { icons, titles } = useMemo(() => {
    if (dbIconsRaw === null && dbTitlesRaw === null) {
      return { icons: [] as NormalizedMilestone[], titles: [] as NormalizedMilestone[] };
    }

    const iconsDb = Array.isArray(dbIconsRaw)
      ? (dbIconsRaw.map(normalizeDbIconRow).filter(Boolean) as NormalizedMilestone[])
      : [];

    const titlesDb = Array.isArray(dbTitlesRaw)
      ? (dbTitlesRaw.map(normalizeDbTitleRow).filter(Boolean) as NormalizedMilestone[])
      : [];

    return {
      icons: dedupeByDayKeepFirst(iconsDb.sort((a, b) => a.day - b.day || a.label.localeCompare(b.label, "ru"))),
      titles: titlesDb.sort((a, b) => a.day - b.day || a.label.localeCompare(b.label, "ru")),
    };
  }, [dbIconsRaw, dbTitlesRaw]);

  const roadmapRows = useMemo(() => buildRoadmapRows(icons, titles), [icons, titles]);

  const mergedRoadmap = useMemo(() => {
    return [...titles, ...icons].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.kind !== b.kind) return a.kind === "title" ? -1 : 1;
      return a.label.localeCompare(b.label, "ru");
    });
  }, [icons, titles]);

  const unlockedSet = useMemo(() => {
    const set = new Set<string>();

    if (Array.isArray(unlockedIconCodes)) {
      for (const c of unlockedIconCodes) {
        const n = normalizeDbIconCode(c);
        if (n) set.add(n);
      }
    }

    return set;
  }, [unlockedIconCodes]);

  const effectiveSelectedIconCode = useMemo(() => {
    const sel = normalizeDbIconCode(selectedIconCode);

    if (sel) {
      const found = icons.find((m) => getSelectableCodeForIcon(m) === sel);
      if (found) return getSelectableCodeForIcon(found);
    }

    const latestUnlocked = [...icons]
      .filter((m) => m.day <= longestStreak)
      .sort((a, b) => a.day - b.day)
      .at(-1);

    return latestUnlocked ? getSelectableCodeForIcon(latestUnlocked) : null;
  }, [selectedIconCode, icons, longestStreak]);

  const selectedIcon = useMemo(() => {
    if (!effectiveSelectedIconCode) return null;

    return icons.find((m) => getSelectableCodeForIcon(m) === effectiveSelectedIconCode) ?? null;
  }, [icons, effectiveSelectedIconCode]);

  const nextReward = useMemo(() => {
    const next = mergedRoadmap.find((m) => longestStreak < m.day) ?? null;

    if (!next) return null;

    return { ...next, left: Math.max(0, next.day - currentStreak) };
  }, [mergedRoadmap, longestStreak, currentStreak]);

  const lineProgressPercent = useMemo(
    () => computeRailProgressPercent(currentStreak, roadmapRows),
    [currentStreak, roadmapRows],
  );

  const showAnyError = error || dbError;
  const roadmapBgCss = roadmapBgUrl ? `url('${roadmapBgUrl}')` : "none";

  return (
    <Modal open={open} onClose={onClose} title="🔥 Дорожка серии" maxWidth={1180}>
      <div className="streak-roadmap-modal">
        <div className="srm-top-grid">
          <div className="srm-stat-card srm-stat-card--warm">
            <div className="srm-stat-icon">🔥</div>
            <div className="srm-stat-content">
              <div className="srm-stat-value">{loading ? "…" : `${currentStreak} дн.`}</div>
              <div className="srm-stat-label">Текущая серия</div>
            </div>
          </div>

          <div className="srm-stat-card srm-stat-card--cool">
            <div className="srm-stat-icon">🏆</div>
            <div className="srm-stat-content">
              <div className="srm-stat-value">{loading ? "…" : `${longestStreak} дн.`}</div>
              <div className="srm-stat-label">Рекорд</div>
            </div>
          </div>

          <div className={`srm-stat-card ${doneToday ? "srm-stat-card--done" : "srm-stat-card--todo"}`}>
            <div className="srm-stat-icon">{doneToday ? "✅" : "📅"}</div>
            <div className="srm-stat-content">
              <div className="srm-stat-value">{doneToday ? "Засчитано" : "Не засчитано"}</div>
              <div className="srm-stat-label">{loading ? "..." : doneToday ? "Сегодня" : "Сделай задание сегодня"}</div>
            </div>
          </div>
        </div>

        <div className="srm-status-line">
          <div className="srm-status-pill">
            <span>{tierBadge.icon}</span>
            <b>{tierBadge.label}</b>
          </div>

          <div className="srm-status-pill">
            <span>🏷️</span>
            <b>{equippedTitleLabel?.trim() || "Титул не выбран"}</b>
          </div>

          {dbLoading ? (
            <div className="srm-status-pill">
              <span>🔄</span>
              <b>Синхронизация с БД…</b>
            </div>
          ) : null}

          {showAnyError ? (
            <div className="srm-status-pill srm-status-pill--error">
              <span>⚠️</span>
              <b>{error || dbError}</b>
            </div>
          ) : null}
        </div>

        <section className="srm-panel srm-next-panel">
          <div className="srm-panel-title">Следующая награда</div>

          {!nextReward ? (
            <div className="srm-next-final">
              <div className="srm-next-final-icon">🚀</div>
              <div>
                <div className="srm-next-final-title">Все награды в текущей дорожке уже открыты</div>
                <div className="srm-next-final-sub">Позже можно добавить новые уровни (иконки / титулы / фоны)</div>
              </div>
            </div>
          ) : (
            <div className="srm-next-card">
              <div className="srm-next-kind">{nextReward.kind === "title" ? "🏷️ Титул" : "🎖️ Иконка"}</div>

              <div className="srm-next-main">
                <div className="srm-next-name">{nextReward.label}</div>
                <div className="srm-next-sub">
                  На <b>{nextReward.day}</b> дне • осталось <b>{nextReward.left}</b>{" "}
                  {nextReward.left === 1 ? "день" : nextReward.left >= 2 && nextReward.left <= 4 ? "дня" : "дней"}
                </div>
              </div>

              <div className="srm-next-badge">+{nextReward.left}</div>
            </div>
          )}
        </section>

        <section className="srm-panel">
          <div className="srm-panel-header">
            <div>
              <div className="srm-panel-title">Иконки серии</div>
              <div className="srm-panel-subtitle">
                Дни/названия берутся из БД. Отключённые/удалённые иконки не показываются.
              </div>
            </div>
          </div>

          {dbLoading && icons.length === 0 ? (
            <div style={{ fontWeight: 800, color: "rgba(49,68,87,0.65)" }}>🔄 Загружаем иконки из БД…</div>
          ) : null}

          <div className="srm-icons-grid">
            {icons.map((m) => {
              const selectCode = getSelectableCodeForIcon(m);
              const unlockedByDay = longestStreak >= m.day;
              const unlockedByList = unlockedSet.has(selectCode);
              const unlocked = unlockedByDay || unlockedByList;
              const selected = effectiveSelectedIconCode === selectCode;

              const urls = safeUniqUrls([m.publicUrl, ...(m.candidatePublicUrls ?? [])]);
              const emoji = m.emoji || guessIconEmoji(m.code, m.label);

              return (
                <button
                  key={`icon-${selectCode}-${m.day}`}
                  type="button"
                  className={["srm-icon-tile", unlocked ? "is-unlocked" : "is-locked", selected ? "is-selected" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (!unlocked) return;
                    onSelectIconCode?.(selectCode);
                  }}
                  disabled={!unlocked}
                  title={unlocked ? `${m.label} • ${m.day} дн.` : `${m.label} • откроется на ${m.day} дне`}
                >
                  <div className="srm-icon-tile-top">
                    <div className="srm-icon-ball" aria-hidden="true">
                      <IconThumb urls={urls} emoji={emoji} alt={m.label} size={44} radius={14} />
                    </div>

                    {!unlocked ? <div className="srm-lock-badge">🔒</div> : null}
                  </div>

                  <div className="srm-icon-title">{m.label}</div>
                  <div className="srm-icon-day">{m.day}д</div>

                  <div className="srm-icon-meta">{selected ? "Выбрано" : unlocked ? "Разблокировано" : "Заблокировано"}</div>
                </button>
              );
            })}
          </div>

          <div className="srm-selected-row">
            <span className="srm-selected-label">Текущая выбранная:</span>

            <span className="srm-selected-pill">
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                {selectedIcon ? (
                  <IconThumb
                    urls={safeUniqUrls([selectedIcon.publicUrl, ...(selectedIcon.candidatePublicUrls ?? [])])}
                    emoji={selectedIcon.emoji || "🎖️"}
                    alt={selectedIcon.label}
                    size={18}
                    radius={6}
                  />
                ) : (
                  "—"
                )}
              </span>
              <b>{selectedIcon?.label || "—"}</b>
            </span>

            {selectedIcon?.description ? <span className="srm-selected-sub">{selectedIcon.description}</span> : null}
          </div>
        </section>

        <section className="srm-panel">
          <div className="srm-panel-title">Дорожка наград</div>
          <div className="srm-panel-subtitle">
            Полоса серии по центру. <b>Титулы — слева</b>, <b>иконки — справа</b>. Награды одного дня идут в одной
            строке. Дни/названия — из БД.
          </div>

          <div className="srm-roadmap-wrap" style={{ ["--srm-roadmap-bg" as any]: roadmapBgCss }}>
            <div className="srm-center-rail" aria-hidden="true">
              <div className="srm-center-rail-track" />
              <div className="srm-center-rail-progress" style={{ height: `${lineProgressPercent}%` }} />
              <div
                className="srm-center-progress-bubble"
                style={{ top: `clamp(0px, calc(${lineProgressPercent}% - 18px), calc(100% - 36px))` }}
                title={`Текущий стрик: ${currentStreak} дн.`}
              >
                🔥 {loading ? "…" : `${currentStreak}д`}
              </div>
            </div>

            <div className="srm-roadmap-list">
              {roadmapRows.map((row) => {
                const rowUnlockedByLongest = longestStreak >= row.day;
                const rowReachedByCurrent = currentStreak >= row.day;
                const isCurrentTarget = !!nextReward && nextReward.day === row.day;
                const nodeEmoji = row.icon?.emoji || (row.title ? "🏷️" : "🎯");

                return (
                  <div
                    key={`day-${row.day}`}
                    className={`srm-road-row ${rowUnlockedByLongest ? "is-unlocked" : ""} ${isCurrentTarget ? "is-next" : ""}`}
                  >
                    <div className="srm-road-side srm-road-side--left">
                      {row.title ? (
                        <div className="srm-road-card srm-road-card--title">
                          <div className="srm-road-card-top">
                            <span className="srm-kind-chip srm-kind-chip--title">🏷️ Титул</span>
                            <span className={`srm-state-chip ${longestStreak >= row.title.day ? "ok" : "lock"}`}>
                              {longestStreak >= row.title.day ? "Открыт" : `На ${row.title.day} дне`}
                            </span>
                          </div>

                          <div className="srm-road-card-day">{row.title.day} дн.</div>
                          <div className="srm-road-card-title">{row.title.label}</div>
                          <div className="srm-road-card-desc">{row.title.description || "Награда за поддержание серии"}</div>
                        </div>
                      ) : (
                        <div className="srm-road-placeholder" />
                      )}
                    </div>

                    <div className="srm-road-center">
                      <div className={`srm-node ${rowReachedByCurrent ? "is-reached" : ""} ${isCurrentTarget ? "is-next" : ""}`}>
                        {nodeEmoji}
                      </div>
                      <div className="srm-node-day">{row.day}д</div>
                    </div>

                    <div className="srm-road-side srm-road-side--right">
                      {row.icon ? (
                        <div className="srm-road-card srm-road-card--icon">
                          <div className="srm-road-card-top">
                            <span className="srm-kind-chip srm-kind-chip--icon">🎖️ Иконка</span>
                            <span className={`srm-state-chip ${longestStreak >= row.icon.day ? "ok" : "lock"}`}>
                              {longestStreak >= row.icon.day ? "Открыта" : `На ${row.icon.day} дне`}
                            </span>
                          </div>

                          <div className="srm-road-card-inline">
                            <div className="srm-road-card-iconBall">
                              <IconThumb
                                urls={safeUniqUrls([row.icon.publicUrl, ...(row.icon.candidatePublicUrls ?? [])])}
                                emoji={row.icon.emoji || "🎖️"}
                                alt={row.icon.label}
                                size={52}
                                radius={16}
                              />
                            </div>

                            <div className="srm-road-card-inlineText">
                              <div className="srm-road-card-day">{row.icon.day} дн.</div>
                              <div className="srm-road-card-title">{row.icon.label}</div>
                              <div className="srm-road-card-desc">{row.icon.description || "Новая иконка профиля"}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="srm-road-placeholder" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .streak-roadmap-modal {
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #273444;
        }

        .srm-panel {
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,250,255,0.92));
          border: 1px solid rgba(136, 170, 196, 0.18);
          border-radius: 20px;
          padding: 16px;
          box-shadow:
            0 10px 28px rgba(56, 88, 120, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.75);
        }

        .srm-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .srm-panel-title {
          font-size: 20px;
          font-weight: 900;
          line-height: 1.15;
          color: #314457;
        }

        .srm-panel-subtitle {
          margin-top: 6px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(49, 68, 87, 0.68);
          line-height: 1.35;
        }

        .srm-top-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .srm-stat-card {
          border-radius: 18px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(116, 145, 174, 0.16);
          box-shadow: 0 8px 22px rgba(39, 58, 83, 0.06);
          min-height: 84px;
        }

        .srm-stat-card--warm {
          background: linear-gradient(135deg, rgba(255,247,236,0.96), rgba(255,240,224,0.9));
        }

        .srm-stat-card--cool {
          background: linear-gradient(135deg, rgba(243,248,255,0.97), rgba(236,244,255,0.92));
        }

        .srm-stat-card--done {
          background: linear-gradient(135deg, rgba(235,252,240,0.98), rgba(223,247,231,0.93));
        }

        .srm-stat-card--todo {
          background: linear-gradient(135deg, rgba(255,249,232,0.98), rgba(255,244,214,0.92));
        }

        .srm-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(116,145,174,0.16);
          font-size: 24px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
          flex: 0 0 auto;
        }

        .srm-stat-content {
          min-width: 0;
        }

        .srm-stat-value {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #263a4e;
        }

        .srm-stat-label {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 800;
          color: rgba(38, 58, 78, 0.62);
        }

        .srm-status-line {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: -2px;
        }

        .srm-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(116,145,174,0.16);
          font-size: 13px;
          font-weight: 800;
          color: #33475c;
        }

        .srm-status-pill--error {
          background: rgba(255, 241, 241, 0.92);
          border-color: rgba(220, 65, 65, 0.18);
          color: #a53030;
        }

        .srm-next-panel {
          padding-top: 14px;
        }

        .srm-next-card {
          margin-top: 10px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(240,247,255,0.98), rgba(232,244,255,0.94));
          border: 1px solid rgba(111, 154, 201, 0.16);
        }

        .srm-next-kind {
          font-size: 12px;
          font-weight: 900;
          color: #3f5a76;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(111,154,201,0.14);
          padding: 8px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .srm-next-main {
          min-width: 0;
        }

        .srm-next-name {
          font-size: 19px;
          font-weight: 900;
          color: #2d4156;
          line-height: 1.1;
        }

        .srm-next-sub {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(45,65,86,0.72);
        }

        .srm-next-badge {
          font-size: 18px;
          font-weight: 900;
          color: #2f6fb5;
          background: rgba(255,255,255,0.86);
          border: 1px solid rgba(111,154,201,0.14);
          border-radius: 12px;
          padding: 8px 12px;
        }

        .srm-next-final {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(242,255,245,0.97), rgba(236,251,240,0.93));
          border: 1px solid rgba(88, 176, 114, 0.14);
        }

        .srm-next-final-icon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(255,255,255,0.86);
          font-size: 22px;
        }

        .srm-next-final-title {
          font-size: 16px;
          font-weight: 900;
          color: #2f4b3c;
        }

        .srm-next-final-sub {
          margin-top: 3px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(47,75,60,0.68);
        }

        .srm-icons-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .srm-icon-tile {
          border-radius: 16px;
          border: 1px solid rgba(129, 157, 183, 0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,251,255,0.95));
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-height: 136px;
          cursor: pointer;
          transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
          box-shadow: 0 6px 18px rgba(57, 89, 122, 0.06);
        }

        .srm-icon-tile:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(57, 89, 122, 0.1);
        }

        .srm-icon-tile:disabled {
          cursor: not-allowed;
        }

        .srm-icon-tile.is-locked {
          opacity: 0.72;
          filter: grayscale(0.15);
        }

        .srm-icon-tile.is-selected {
          border-color: rgba(74, 180, 220, 0.58);
          box-shadow:
            0 0 0 3px rgba(87, 208, 226, 0.15),
            0 10px 28px rgba(60, 153, 194, 0.14);
          background: linear-gradient(180deg, rgba(246,252,255,1), rgba(236,249,255,0.98));
        }

        .srm-icon-tile-top {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          min-height: 44px;
        }

        .srm-icon-ball {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(129,157,183,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.82);
        }

        .srm-lock-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          font-size: 14px;
          background: rgba(255,255,255,0.95);
          border-radius: 999px;
          padding: 2px 5px;
          border: 1px solid rgba(129,157,183,0.18);
        }

        .srm-icon-title {
          margin-top: 2px;
          font-size: 13px;
          line-height: 1.15;
          font-weight: 900;
          text-align: center;
          color: #34485e;
        }

        .srm-icon-day {
          font-size: 12px;
          font-weight: 900;
          color: rgba(52,72,94,0.64);
        }

        .srm-icon-meta {
          margin-top: auto;
          font-size: 11px;
          font-weight: 800;
          color: rgba(52,72,94,0.6);
          text-align: center;
        }

        .srm-icon-tile.is-selected .srm-icon-meta {
          color: #3fa7c6;
        }

        .srm-selected-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .srm-selected-label {
          font-size: 13px;
          font-weight: 800;
          color: rgba(47,64,82,0.72);
        }

        .srm-selected-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(238,249,255,0.96);
          border: 1px solid rgba(78,181,219,0.2);
          color: #35607a;
          font-size: 13px;
        }

        .srm-selected-sub {
          font-size: 12px;
          font-weight: 700;
          color: rgba(53,96,122,0.72);
        }

        .srm-roadmap-wrap {
          position: relative;
          margin-top: 14px;
          background-image:
            var(--srm-roadmap-bg, none),
            radial-gradient(circle at 20% 0%, rgba(135, 206, 235, 0.08), transparent 40%),
            radial-gradient(circle at 80% 0%, rgba(161, 193, 255, 0.08), transparent 42%),
            linear-gradient(180deg, rgba(248,252,255,0.86), rgba(243,250,255,0.9));
          background-repeat: repeat, no-repeat, no-repeat, no-repeat;
          background-position: center, center, center, center;
          background-size: 1024px 1024px, cover, cover, cover;
          border: 1px solid rgba(136,170,196,0.14);
          border-radius: 22px;
          padding: 18px 14px;
          overflow: hidden;
        }

        .srm-center-rail {
          position: absolute;
          left: 50%;
          top: 18px;
          bottom: 18px;
          width: 0;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 1;
        }

        .srm-center-rail-track {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          transform: translateX(-50%);
          width: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(209,225,240,0.85), rgba(197,219,238,0.7));
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.75);
        }

        .srm-center-rail-progress {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          width: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffd16e 0%, #ff9e43 45%, #ff6a3a 100%);
          box-shadow:
            0 0 0 4px rgba(255, 154, 67, 0.08),
            0 6px 16px rgba(255, 120, 63, 0.2);
        }

        .srm-center-progress-bubble {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(255, 139, 64, 0.2);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          color: #be5c22;
          box-shadow: 0 8px 22px rgba(255, 129, 55, 0.14);
          white-space: nowrap;
        }

        .srm-roadmap-list {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .srm-road-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr);
          align-items: stretch;
          gap: 12px;
          min-height: 124px;
        }

        .srm-road-side {
          min-height: 1px;
          display: flex;
          align-items: center;
        }

        .srm-road-side > * {
          width: 100%;
        }

        .srm-road-placeholder {
          height: 1px;
        }

        .srm-road-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 124px;
        }

        .srm-node {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-size: 20px;
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(136,170,196,0.2);
          box-shadow: 0 6px 16px rgba(58, 87, 117, 0.08);
          transition: transform 0.15s ease;
        }

        .srm-node.is-reached {
          border-color: rgba(255, 145, 68, 0.25);
          box-shadow:
            0 0 0 4px rgba(255, 155, 85, 0.09),
            0 8px 20px rgba(255, 142, 77, 0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.99), rgba(255,247,240,0.98));
        }

        .srm-node.is-next {
          transform: scale(1.06);
        }

        .srm-node-day {
          font-size: 11px;
          font-weight: 900;
          color: rgba(44, 63, 82, 0.66);
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(136,170,196,0.14);
          padding: 4px 8px;
          border-radius: 999px;
          line-height: 1;
        }

        .srm-road-card {
          border-radius: 18px;
          border: 1px solid rgba(136,170,196,0.16);
          background: rgba(255,255,255,0.94);
          padding: 12px;
          box-shadow: 0 8px 22px rgba(56, 86, 116, 0.06);
          min-height: 104px;
        }

        .srm-road-card--title {
          background: linear-gradient(135deg, rgba(246,250,255,0.98), rgba(241,248,255,0.95));
        }

        .srm-road-card--icon {
          background: linear-gradient(135deg, rgba(255,250,242,0.98), rgba(255,247,235,0.94));
        }

        .srm-road-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .srm-kind-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          border: 1px solid rgba(136,170,196,0.14);
          white-space: nowrap;
        }

        .srm-kind-chip--title {
          background: rgba(236,244,255,0.98);
          color: #45617d;
        }

        .srm-kind-chip--icon {
          background: rgba(255,243,227,0.98);
          color: #8a5a2c;
        }

        .srm-state-chip {
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .srm-state-chip.ok {
          background: rgba(231, 250, 236, 0.98);
          color: #2d8b52;
          border-color: rgba(45, 139, 82, 0.12);
        }

        .srm-state-chip.lock {
          background: rgba(244,247,251,0.98);
          color: #6a7f96;
          border-color: rgba(106,127,150,0.12);
        }

        .srm-road-card-day {
          font-size: 18px;
          font-weight: 900;
          color: #2c4155;
          line-height: 1.1;
        }

        .srm-road-card-title {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 900;
          color: #2f465d;
          line-height: 1.15;
        }

        .srm-road-card-desc {
          margin-top: 5px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(47,70,93,0.66);
          line-height: 1.3;
        }

        .srm-road-card-inline {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .srm-road-card-iconBall {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          font-size: 26px;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(136,170,196,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
          overflow: hidden;
        }

        .srm-road-card-inlineText {
          min-width: 0;
        }

        @media (max-width: 1100px) {
          .srm-icons-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .srm-top-grid {
            grid-template-columns: 1fr;
          }

          .srm-icons-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .srm-roadmap-wrap {
            padding-left: 10px;
            padding-right: 10px;
            background-size: 820px 820px, cover, cover, cover;
          }

          .srm-road-row {
            grid-template-columns: 1fr;
            gap: 8px;
            padding-left: 52px;
            position: relative;
            min-height: unset;
          }

          .srm-center-rail {
            left: 26px;
          }

          .srm-road-center {
            position: absolute;
            left: 0;
            top: 12px;
            width: 52px;
            min-height: unset;
          }

          .srm-road-side--left,
          .srm-road-side--right {
            width: 100%;
          }

          .srm-road-placeholder {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .srm-icons-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .srm-next-card {
            grid-template-columns: 1fr;
            align-items: start;
          }

          .srm-next-badge {
            justify-self: start;
          }

          .srm-road-card-top {
            flex-wrap: wrap;
          }

          .srm-roadmap-wrap {
            background-size: 700px 700px, cover, cover, cover;
          }
        }
      `}</style>
    </Modal>
  );
}