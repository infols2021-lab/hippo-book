// app/(app)/projects/[slug]/profile/ProfileClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import Modal from "@/components/Modal";
import RewardsModal from "@/components/rewards/RewardsModal";
import StreakLeaderboardModal, {
  type StreakLeaderboardRow,
} from "@/components/profile/StreakLeaderboardModal";
import { getTierCodeByStreak } from "@/lib/streaks/roadmap";

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

export type StreakSnapshot = {
  today: string;
  raw_current_streak: number;
  display_current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  done_today: boolean;
  can_save_today: boolean;
  tier_code:
    | "none"
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond"
    | "legendary"
    | string;
};

type IconVisualPayloadFromApi = {
  code?: string | null;
  publicUrl?: string | null;
  candidatePublicUrls?: string[] | null;
  cacheTag?: string | null;
  emojiFallback?: string | null;
  tierCode?: string | null;
  label?: string | null;
};

type ProfileStreakApiResponse = {
  ok?: boolean;
  error?: string;
  streak?: unknown | null;
  equippedTitle?: {
    code?: string | null;
    titleCode?: string | null;
    label?: string | null;
    unlockedAt?: string | null;
    sourceType?: string | null;
    sourceValue?: number | null;
  } | null;
  selectedTitle?: {
    code?: string | null;
    titleCode?: string | null;
    label?: string | null;
    unlockAt?: number | null;
    description?: string | null;
  } | null;
  unlockedIconCodes?: string[] | null;
  selectedIconCode?: string | null;
  effectiveIconCode?: string | null;
  appliedIconCode?: string | null;
  appliedIcon?: IconVisualPayloadFromApi | null;
  selectedIcon?: IconVisualPayloadFromApi | null;
  effectiveIcon?: IconVisualPayloadFromApi | null;
};

type LeaderboardApiResponse = {
  ok?: boolean;
  error?: string;
  top?: unknown;
  around?: unknown;
  myPlace?: unknown;
  myCurrent?: unknown;
  myLongest?: unknown;
  serverTs?: unknown;
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

type CustomUpdateDialogState = {
  open: boolean;
  mode: "loading" | "error";
  scope: "icon" | "title";
  title: string;
  message: string;
};

type Props = {
  projectName: string;
  projectSlug: string;
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
  streak?: StreakSnapshot | null;
  equippedTitleLabel?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS / CACHE
// ─────────────────────────────────────────────────────────────────────────────

const STREAK_ICON_BUCKET =
  process.env.NEXT_PUBLIC_STREAK_ICONS_BUCKET ||
  process.env.NEXT_PUBLIC_STREAK_ICON_ASSETS_BUCKET ||
  "streak-icons";

const STREAK_CACHE_KEY = "ek_profile_streak_cache_v3";
const PROGRESS_CACHE_KEY = "ek_profile_progress_cache_v1";

const STREAK_CACHE_TTL_MS = 60_000;
const PROGRESS_CACHE_TTL_MS = 5 * 60_000;
const LEADERBOARD_MIN_REFRESH_MS = 25_000;

const ICON_URL_RESOLVED_CACHE = new Map<string, string>();

type StreakClientCache = {
  ts: number;
  streak: StreakSnapshot | null;
  selectedIconServer: string | null;
  unlockedIconCodes: string[] | null;
  appliedIconCode: string | null;
  appliedIconUrls: string[];
  appliedIconCacheTag: string | null;
  appliedIconEmojiFallback?: string | null;
  appliedIconTierCode?: string | null;
  titleCode: string | null;
  titleLabel: string | null;
};

type ProgressClientCache = {
  ts: number;
  stats: Stats | null;
  materialsProgress: MaterialProgressItem[] | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function uniqStrings(values: (string | null | undefined)[]) {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    set.add(s);
  }
  return Array.from(set);
}

function getClosedCustomUpdateDialog(): CustomUpdateDialogState {
  return { open: false, mode: "loading", scope: "icon", title: "", message: "" };
}

function regionLabel(region: string) {
  return region?.trim() ? region : "Не указана";
}
function phoneLabel(phone: string) {
  return phone?.trim() ? phone : "Не указан";
}
function nameLabel(name: string) {
  return name?.trim() ? name : "Ученик";
}

function asInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function asBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(s)) return true;
    if (["0", "false", "no", "n"].includes(s)) return false;
  }
  return fallback;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function pick(obj: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readStreakCache(): StreakClientCache | null {
  if (typeof window === "undefined") return null;
  const cached = safeJsonParse<StreakClientCache>(
    sessionStorage.getItem(STREAK_CACHE_KEY)
  );
  if (!cached?.ts) return null;
  if (Date.now() - cached.ts > STREAK_CACHE_TTL_MS) return null;
  return cached;
}

function writeStreakCache(payload: StreakClientCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function readProgressCache(): ProgressClientCache | null {
  if (typeof window === "undefined") return null;
  const cached = safeJsonParse<ProgressClientCache>(
    sessionStorage.getItem(PROGRESS_CACHE_KEY)
  );
  if (!cached?.ts) return null;
  if (Date.now() - cached.ts > PROGRESS_CACHE_TTL_MS) return null;
  return cached;
}

function writeProgressCache(payload: ProgressClientCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function runWhenIdle(fn: () => void, timeout = 900) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.requestIdleCallback === "function")
    w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 50);
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
    lower.includes("terminated") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("socket") ||
    lower.includes("network")
  ) {
    return "Ошибка соединения с сервером";
  }
  return msg;
}

function normalizeDbIconCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  s = s.split("#")[0] ?? s;
  s = s.split("?")[0] ?? s;
  s = s.replace(/\\/g, "/");
  const base = s.split("/").filter(Boolean).at(-1) ?? s;
  const noExt = base.replace(/\.(webp|png|jpg|jpeg|svg)$/i, "").trim();
  if (!noExt) return null;
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(noExt) && !noExt.includes("-")) return null;
  return noExt;
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

function normalizeStreakSnapshotFromApi(rawInput: unknown): StreakSnapshot | null {
  if (!rawInput || typeof rawInput !== "object") return null;
  const raw = rawInput as Record<string, any>;
  const rawCurrent = asInt(
    pick(raw, [
      "raw_current_streak",
      "rawCurrentStreak",
      "current_streak",
      "currentStreak",
      "current",
      "streak",
    ]),
    0
  );
  const displayCurrent = asInt(
    pick(raw, [
      "display_current_streak",
      "displayCurrentStreak",
      "current_streak",
      "currentStreak",
    ]),
    rawCurrent
  );
  const longest = asInt(
    pick(raw, [
      "longest_streak",
      "longestStreak",
      "display_longest_streak",
      "displayLongestStreak",
    ]),
    displayCurrent
  );
  const doneToday = asBool(
    pick(raw, [
      "done_today",
      "today_completed",
      "todayCompleted",
      "is_today_completed",
      "isTodayCompleted",
    ]),
    false
  );
  const canSaveToday = asBool(
    pick(raw, ["can_save_today", "canSaveToday"]),
    !doneToday
  );
  const tierCode =
    asStringOrNull(pick(raw, ["tier_code", "tierCode"])) ??
    getTierCodeByStreak(displayCurrent);
  const today =
    asStringOrNull(pick(raw, ["today", "today_date", "todayDate"])) ??
    new Date().toISOString().slice(0, 10);
  const lastCompletedDate =
    asStringOrNull(
      pick(raw, [
        "last_completed_date",
        "lastCompletedDate",
        "activity_date",
        "lastActivityDate",
      ])
    ) ?? null;

  return {
    today,
    raw_current_streak: rawCurrent,
    display_current_streak: displayCurrent,
    longest_streak: longest,
    last_completed_date: lastCompletedDate,
    done_today: doneToday,
    can_save_today: canSaveToday,
    tier_code: tierCode,
  };
}

function getStreakTierUi(tierCode?: string, streakValue?: number) {
  const v = Math.max(0, Number(streakValue || 0));
  switch (tierCode) {
    case "legendary":
      return {
        icon: "Л",
        label: "Легендарный",
        className: "streak-chip--legendary",
        ringClassName: "streak-mini-badge--legendary",
      };
    case "diamond":
      return {
        icon: "А",
        label: "Алмазный",
        className: "streak-chip--diamond",
        ringClassName: "streak-mini-badge--diamond",
      };
    case "platinum":
      return {
        icon: "П",
        label: "Платиновый",
        className: "streak-chip--platinum",
        ringClassName: "streak-mini-badge--platinum",
      };
    case "gold":
      return {
        icon: "З",
        label: "Золотой",
        className: "streak-chip--gold",
        ringClassName: "streak-mini-badge--gold",
      };
    case "silver":
      return {
        icon: "С",
        label: "Серебряный",
        className: "streak-chip--silver",
        ringClassName: "streak-mini-badge--silver",
      };
    case "bronze":
      return {
        icon: "Б",
        label: "Бронзовый",
        className: "streak-chip--bronze",
        ringClassName: "streak-mini-badge--bronze",
      };
    default:
      return {
        icon: v > 0 ? "С" : "",
        label: v > 0 ? "Серия" : "Нет серии",
        className: "streak-chip--none",
        ringClassName: "streak-mini-badge--none",
      };
  }
}

function joinClasses(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeLeaderboardRows(input: unknown): StreakLeaderboardRow[] {
  if (!Array.isArray(input)) return [];
  const out: StreakLeaderboardRow[] = [];
  const seen = new Set<number>();

  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, any>;
    const place = asInt(r.place, 0);
    if (place <= 0) continue;
    if (seen.has(place)) continue;

    out.push({
      place,
      current: asInt(r.current, 0),
      longest: asInt(r.longest, 0),
      isMe: asBool(r.isMe, false),
    });
    seen.add(place);
  }
  out.sort((a, b) => a.place - b.place);
  return out;
}

function asIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON URL RESOLUTION & VISUAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function makeIconCacheKey(
  bucket: string,
  iconCode: string,
  cacheTag?: string | null
) {
  return `${bucket}::${iconCode}::${(cacheTag || "v0").trim() || "v0"}`;
}

function buildCandidateUrls(params: {
  preferredUrls?: string[] | null;
  iconCode: string | null;
  variant?: unknown;
}): string[] {
  const preferred = Array.isArray(params.preferredUrls)
    ? params.preferredUrls
    : [];
  const code = params.iconCode?.trim() || null;
  const fromCode = code
    ? [
        `${code}.webp`,
        `${code}.png`,
        `v1/defaults/${code}.webp`,
        `v1/defaults/${code}.png`,
      ]
    : [];
  const variantPaths: string[] = [];

  if (params.variant && typeof params.variant === "object") {
    const v = params.variant as any;
    if (typeof v.webpPath === "string") variantPaths.push(v.webpPath);
    if (typeof v.pngPath === "string") variantPaths.push(v.pngPath);
    if (v.meta && typeof v.meta === "object") {
      if (typeof v.meta.webpPath === "string") variantPaths.push(v.meta.webpPath);
      if (typeof v.meta.pngPath === "string") variantPaths.push(v.meta.pngPath);
    }
  }

  const toUrl = (p: string) => {
    const raw = p.trim();
    if (!raw) return null;
    if (
      /^https?:\/\//i.test(raw) ||
      raw.startsWith("data:") ||
      raw.startsWith("/api/storage/public/")
    ) {
      return toStorageProxyUrl(raw);
    }
    return getStoragePublicUrl(STREAK_ICON_BUCKET, raw.replace(/^\/+/, ""));
  };

  return uniqStrings([
    ...preferred
      .map((x) => (typeof x === "string" ? toStorageProxyUrl(x) : ""))
      .filter(Boolean),
    ...(variantPaths.map(toUrl).filter(Boolean) as string[]),
    ...(fromCode.map(toUrl).filter(Boolean) as string[]),
  ]);
}

function preloadIconByUrls(params: {
  iconCode: string | null;
  cacheTag?: string | null;
  preferredUrls?: string[] | null;
  variant?: unknown;
}) {
  if (!isNonEmptyString(params.iconCode)) return;
  const cacheKey = makeIconCacheKey(
    STREAK_ICON_BUCKET,
    params.iconCode,
    params.cacheTag
  );
  if (ICON_URL_RESOLVED_CACHE.has(cacheKey)) return;

  const candidates = buildCandidateUrls({
    preferredUrls: params.preferredUrls,
    iconCode: params.iconCode,
    variant: params.variant,
  });
  if (!candidates.length) return;

  let idx = 0;
  function tryNext() {
    if (idx >= candidates.length) {
      ICON_URL_RESOLVED_CACHE.set(cacheKey, "");
      return;
    }
    const url = candidates[idx++];
    const img = new Image();
    img.onload = () => ICON_URL_RESOLVED_CACHE.set(cacheKey, url);
    img.onerror = tryNext;
    img.src = url;
  }
  tryNext();
}

type StreakIconVisualProps = {
  iconCode: string | null;
  cacheTag?: string | null;
  preferredUrls?: string[] | null;
  variant?: unknown;
  emojiFallback: string;
  alt: string;
  wrapperClassName?: string;
  imgClassName?: string;
  emojiClassName?: string;
  priority?: boolean;
};

function StreakIconVisual({
  iconCode,
  cacheTag = null,
  preferredUrls = null,
  variant,
  emojiFallback,
  alt,
  wrapperClassName,
  imgClassName,
  emojiClassName,
  priority = false,
}: StreakIconVisualProps) {
  const cacheKey = iconCode
    ? makeIconCacheKey(STREAK_ICON_BUCKET, iconCode, cacheTag)
    : null;
  const preferredKey = Array.isArray(preferredUrls)
    ? preferredUrls.join("|")
    : "";

  const candidateUrls = useMemo(
    () => buildCandidateUrls({ preferredUrls, iconCode, variant }),
    [iconCode, cacheTag, preferredKey, variant]
  );
  const candidatesKey = useMemo(
    () => candidateUrls.join("|"),
    [candidateUrls]
  );

  const [shownSrc, setShownSrc] = useState<string | null>(() => {
    if (!cacheKey) return null;
    const cached = ICON_URL_RESOLVED_CACHE.get(cacheKey);
    return cached && cached !== "" ? cached : null;
  });

  const [pendingIndex, setPendingIndex] = useState(0);
  const lastKeyRef = useRef<string | null>(cacheKey);

  useEffect(() => {
    if (lastKeyRef.current !== cacheKey) {
      lastKeyRef.current = cacheKey;
      setShownSrc(() => {
        if (!cacheKey) return null;
        const cached = ICON_URL_RESOLVED_CACHE.get(cacheKey);
        return cached && cached !== "" ? cached : null;
      });
      setPendingIndex(0);
      return;
    }
    setPendingIndex(0);
  }, [cacheKey, candidatesKey]);

  useEffect(() => {
    if (!iconCode) {
      setShownSrc(null);
      return;
    }
    if (!candidateUrls.length) {
      if (cacheKey) ICON_URL_RESOLVED_CACHE.set(cacheKey, "");
      setShownSrc(null);
      return;
    }
    if (pendingIndex >= candidateUrls.length) {
      if (cacheKey) ICON_URL_RESOLVED_CACHE.set(cacheKey, "");
      setShownSrc(null);
      return;
    }

    const src = candidateUrls[pendingIndex] ?? null;
    if (!src) {
      setPendingIndex((i) => i + 1);
      return;
    }
    if (shownSrc === src) return;

    let alive = true;
    const img = new Image();
    img.decoding = "async";

    const markReady = () => {
      if (!alive) return;
      setShownSrc(src);
      if (cacheKey) ICON_URL_RESOLVED_CACHE.set(cacheKey, src);
    };

    img.onload = markReady;
    img.onerror = () => {
      if (!alive) return;
      setPendingIndex((i) => i + 1);
    };

    img.src = src;
    if (img.complete && img.naturalWidth > 0) markReady();

    return () => {
      alive = false;
    };
  }, [iconCode, cacheKey, candidateUrls, pendingIndex, shownSrc]);

  const hasImage = Boolean(shownSrc);

  return (
    <span
      className={joinClasses("streak-visual", wrapperClassName)}
      aria-hidden="true"
      style={{ position: "relative" }}
      title={alt}
    >
      <span
        className={joinClasses("streak-visual__emoji", emojiClassName)}
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          opacity: hasImage ? 0 : 1,
          transition: "opacity 140ms ease",
          pointerEvents: "none",
        }}
      >
        {emojiFallback}
      </span>
      {hasImage ? (
        <img
          key={shownSrc}
          className={joinClasses("streak-visual__img", imgClassName)}
          src={shownSrc!}
          alt=""
          loading="eager"
          decoding="async"
          {...(priority ? ({ fetchPriority: "high" } as any) : {})}
          draggable={false}
          style={{ opacity: 1, transition: "opacity 140ms ease" }}
        />
      ) : null}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileClient({
  projectName,
  projectSlug,
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
  const cachedStreak = typeof window !== "undefined" ? readStreakCache() : null;
  const cachedProgress = typeof window !== "undefined" ? readProgressCache() : null;

  const cachedSelectedIconServer = normalizeDbIconCode(
    cachedStreak?.selectedIconServer ?? null
  );
  const cachedAppliedIconCode = normalizeDbIconCode(
    cachedStreak?.appliedIconCode ?? null
  );

  const backgroundProxyUrl = useMemo(
    () => toStorageProxyUrl(backgroundUrl),
    [backgroundUrl]
  );

  const [profile, setProfile] = useState<ProfileData>(initialProfile);

  const [bgLoading, setBgLoading] = useState<boolean>(
    Boolean(backgroundProxyUrl)
  );
  const [bgReady, setBgReady] = useState<boolean>(false);

  const [notif, setNotif] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Стейты редактирования личных данных
  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile.full_name ?? "");
  const [editPhone, setEditPhone] = useState(profile.contact_phone ?? "");
  const [editRegion, setEditRegion] = useState(profile.region ?? "");
  const [saving, setSaving] = useState(false);

  // Центр Наград (Единая модалка)
  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);
  const [rewardsTab, setRewardsTab] = useState<
    "wardrobe" | "streaks" | "promocode"
  >("streaks");

  // Лидерборд
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardTop, setLeaderboardTop] = useState<
    StreakLeaderboardRow[] | null
  >(null);
  const [leaderboardAround, setLeaderboardAround] = useState<
    StreakLeaderboardRow[] | null
  >(null);
  const [leaderboardMyPlace, setLeaderboardMyPlace] = useState<number | null>(
    null
  );
  const [leaderboardMyCurrent, setLeaderboardMyCurrent] = useState<
    number | null
  >(null);
  const [leaderboardMyLongest, setLeaderboardMyLongest] = useState<
    number | null
  >(null);

  const lastLeaderboardFetchAtRef = useRef<number>(0);
  const leaderboardAbortRef = useRef<AbortController | null>(null);

  const [customUpdateDialog, setCustomUpdateDialog] =
    useState<CustomUpdateDialogState>(getClosedCustomUpdateDialog());

  // Статистика и Прогресс
  const [stats, setStats] = useState<Stats | null>(
    statsProp ?? cachedProgress?.stats ?? null
  );
  const [materialsProgress, setMaterialsProgress] = useState<
    MaterialProgressItem[] | null
  >(progressProp ?? cachedProgress?.materialsProgress ?? null);

  const [progressLoading, setProgressLoading] = useState<boolean>(
    Boolean(
      !statsProp &&
        !progressProp &&
        !(cachedProgress?.stats && cachedProgress?.materialsProgress)
    )
  );
  const [progressError, setProgressError] = useState<string | null>(null);

  // Стрики
  const [streak, setStreak] = useState<StreakSnapshot | null>(
    streakProp ?? cachedStreak?.streak ?? null
  );
  const [streakLoading, setStreakLoading] = useState<boolean>(
    Boolean(!streakProp && !cachedStreak?.streak)
  );
  const [streakError, setStreakError] = useState<string | null>(null);

  const [equippedTitleLabelState, setEquippedTitleLabelState] = useState<
    string | null
  >(cachedStreak?.titleLabel ?? equippedTitleLabel ?? null);
  const [equippedTitleCodeState, setEquippedTitleCodeState] = useState<
    string | null
  >(cachedStreak?.titleCode ?? null);

  const [unlockedIconCodesState, setUnlockedIconCodesState] = useState<
    string[] | null
  >(
    Array.isArray(cachedStreak?.unlockedIconCodes)
      ? cachedStreak!.unlockedIconCodes ?? null
      : null
  );
  const [appliedIconCodeState, setAppliedIconCodeState] = useState<
    string | null
  >(cachedAppliedIconCode ?? null);
  const [appliedIconUrlsState, setAppliedIconUrlsState] = useState<string[]>(
    Array.isArray(cachedStreak?.appliedIconUrls)
      ? cachedStreak.appliedIconUrls.map(toStorageProxyUrl).filter(Boolean)
      : []
  );
  const [appliedIconCacheTagState, setAppliedIconCacheTagState] = useState<
    string | null
  >(cachedStreak?.appliedIconCacheTag ?? null);
  const [appliedIconEmojiFallbackState, setAppliedIconEmojiFallbackState] =
    useState<string | null>(cachedStreak?.appliedIconEmojiFallback ?? null);
  const [appliedIconTierCodeState, setAppliedIconTierCodeState] = useState<
    string | null
  >(cachedStreak?.appliedIconTierCode ?? null);

  const [selectedStreakIconCodeLocal, setSelectedStreakIconCodeLocal] = useState<
    string | null
  >(null);
  const [selectedStreakIconCodeServer, setSelectedStreakIconCodeServer] =
    useState<string | null>(cachedSelectedIconServer ?? null);

  const lastStreakFetchAtRef = useRef<number>(0);
  const streakAbortRef = useRef<AbortController | null>(null);
  const progressAbortRef = useRef<AbortController | null>(null);

  const streakDisplay = Math.max(
    0,
    Number(streak?.display_current_streak ?? 0)
  );
  const longestStreakDisplay = Math.max(
    0,
    Number(streak?.longest_streak ?? 0)
  );

  const unlockedIconCodesForUi: string[] = useMemo(() => {
    if (Array.isArray(unlockedIconCodesState) && unlockedIconCodesState.length) {
      return unlockedIconCodesState
        .map((c) => normalizeDbIconCode(c))
        .filter(Boolean) as string[];
    }
    return [];
  }, [unlockedIconCodesState]);

  const effectiveSelectedStreakIconCode = useMemo(() => {
    const candidate = normalizeDbIconCode(
      selectedStreakIconCodeLocal ?? selectedStreakIconCodeServer
    );
    if (candidate && unlockedIconCodesForUi.includes(candidate)) return candidate;
    if (unlockedIconCodesForUi.length)
      return unlockedIconCodesForUi[unlockedIconCodesForUi.length - 1];
    return candidate ?? null;
  }, [selectedStreakIconCodeLocal, selectedStreakIconCodeServer, unlockedIconCodesForUi]);

  const uiTierCodeForColors = useMemo(() => {
    const fromIcon =
      effectiveSelectedStreakIconCode &&
      appliedIconCodeState === effectiveSelectedStreakIconCode &&
      typeof appliedIconTierCodeState === "string"
        ? appliedIconTierCodeState.trim().toLowerCase()
        : "";
    if (fromIcon) return fromIcon;
    const fromStreak =
      typeof streak?.tier_code === "string"
        ? streak.tier_code.trim().toLowerCase()
        : "";
    return fromStreak || getTierCodeByStreak(streakDisplay);
  }, [
    effectiveSelectedStreakIconCode,
    appliedIconCodeState,
    appliedIconTierCodeState,
    streak?.tier_code,
    streakDisplay,
  ]);

  const streakUiBase = getStreakTierUi(uiTierCodeForColors, streakDisplay);

  const emojiFallbackForCurrentIcon = useMemo(() => {
    if (
      effectiveSelectedStreakIconCode &&
      appliedIconCodeState === effectiveSelectedStreakIconCode
    ) {
      const e =
        typeof appliedIconEmojiFallbackState === "string"
          ? appliedIconEmojiFallbackState.trim()
          : "";
      if (e) return e;
    }
    return streakUiBase.icon || "С";
  }, [
    effectiveSelectedStreakIconCode,
    appliedIconCodeState,
    appliedIconEmojiFallbackState,
    streakUiBase.icon,
  ]);

  const avatarEmojiFallback = emojiFallbackForCurrentIcon;
  const chipEmojiFallback = emojiFallbackForCurrentIcon;

  const preferredUrlsForCurrentIcon = useMemo(() => {
    if (
      !effectiveSelectedStreakIconCode ||
      !appliedIconCodeState ||
      appliedIconCodeState !== effectiveSelectedStreakIconCode
    )
      return [];
    return (appliedIconUrlsState ?? []).map(toStorageProxyUrl).filter(Boolean);
  }, [effectiveSelectedStreakIconCode, appliedIconCodeState, appliedIconUrlsState]);

  const cacheTagForCurrentIcon = useMemo(() => {
    if (
      !effectiveSelectedStreakIconCode ||
      !appliedIconCodeState ||
      appliedIconCodeState !== effectiveSelectedStreakIconCode
    )
      return null;
    return appliedIconCacheTagState ?? null;
  }, [
    effectiveSelectedStreakIconCode,
    appliedIconCodeState,
    appliedIconCacheTagState,
  ]);

  // Функция открытия центра наград
  const openRewards = (
    tab: "wardrobe" | "streaks" | "promocode" = "streaks"
  ) => {
    setRewardsTab(tab);
    setRewardsModalOpen(true);
  };

  useEffect(() => {
    if (!effectiveSelectedStreakIconCode) return;
    preloadIconByUrls({
      iconCode: effectiveSelectedStreakIconCode,
      cacheTag: cacheTagForCurrentIcon,
      preferredUrls: preferredUrlsForCurrentIcon,
      variant: null,
    });
  }, [
    effectiveSelectedStreakIconCode,
    cacheTagForCurrentIcon,
    preferredUrlsForCurrentIcon,
  ]);

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 3500);
  }

  function closeCustomUpdateDialog() {
    setCustomUpdateDialog((prev) => {
      if (!prev.open || prev.mode === "loading") return prev;
      return getClosedCustomUpdateDialog();
    });
  }

  function openLeaderboardModal() {
    if (features?.leaderboard && !customUpdateDialog.open)
      setLeaderboardOpen(true);
  }

  function extractAppliedIconInfo(json: ProfileStreakApiResponse) {
    const appliedIcon = (json.appliedIcon ??
      json.selectedIcon ??
      json.effectiveIcon ??
      null) as IconVisualPayloadFromApi | null;
    const appliedIconCodeRaw =
      (typeof json.appliedIconCode === "string" && json.appliedIconCode) ||
      (typeof appliedIcon?.code === "string" && appliedIcon.code) ||
      null;
    const appliedIconCode = normalizeDbIconCode(appliedIconCodeRaw);
    const urls = uniqStrings([
      ...(Array.isArray(appliedIcon?.candidatePublicUrls)
        ? appliedIcon!.candidatePublicUrls!
        : []),
      appliedIcon?.publicUrl ?? null,
    ])
      .map(toStorageProxyUrl)
      .filter(Boolean);
    const cacheTag =
      typeof appliedIcon?.cacheTag === "string" ? appliedIcon.cacheTag : null;
    const emojiFallback =
      typeof appliedIcon?.emojiFallback === "string"
        ? appliedIcon.emojiFallback
        : null;
    const tierCode =
      typeof appliedIcon?.tierCode === "string" ? appliedIcon.tierCode : null;
    return { appliedIconCode, urls, cacheTag, emojiFallback, tierCode };
  }

  function applyStreakResponseToState(json: ProfileStreakApiResponse) {
    const normalizedStreak = normalizeStreakSnapshotFromApi(json.streak ?? null);
    if (normalizedStreak) setStreak(normalizedStreak);

    const rawTitleObj = (json.selectedTitle ??
      json.equippedTitle ??
      null) as Record<string, any> | null;
    const apiTitleLabel =
      rawTitleObj && typeof rawTitleObj.label === "string"
        ? rawTitleObj.label
        : null;
    const apiTitleCode =
      (rawTitleObj &&
        typeof rawTitleObj.titleCode === "string" &&
        rawTitleObj.titleCode) ||
      (rawTitleObj &&
        typeof rawTitleObj.code === "string" &&
        rawTitleObj.code) ||
      null;
    setEquippedTitleLabelState(apiTitleLabel ?? null);
    setEquippedTitleCodeState(apiTitleCode ?? null);

    if (Array.isArray(json.unlockedIconCodes)) {
      const norm = json.unlockedIconCodes
        .map((c) => normalizeDbIconCode(c))
        .filter(Boolean) as string[];
      setUnlockedIconCodesState(norm);
    }

    const apiSelected = normalizeDbIconCode(json.selectedIconCode ?? null);
    const apiEffective = normalizeDbIconCode(json.effectiveIconCode ?? null);
    const resolvedIcon = apiSelected ?? apiEffective ?? null;
    setSelectedStreakIconCodeServer(resolvedIcon);

    const applied = extractAppliedIconInfo(json);
    setAppliedIconCodeState(applied.appliedIconCode);
    setAppliedIconUrlsState(applied.urls);
    setAppliedIconCacheTagState(applied.cacheTag);
    setAppliedIconEmojiFallbackState(applied.emojiFallback);
    setAppliedIconTierCodeState(applied.tierCode);

    if (applied.appliedIconCode) {
      preloadIconByUrls({
        iconCode: applied.appliedIconCode,
        cacheTag: applied.cacheTag,
        preferredUrls: applied.urls,
        variant: null,
      });
    }

    setSelectedStreakIconCodeLocal((prev) => {
      if (!prev) return prev;
      const compareWith = apiSelected ?? apiEffective ?? null;
      if (compareWith && prev === compareWith) return null;
      return prev;
    });

    writeStreakCache({
      ts: Date.now(),
      streak: normalizedStreak,
      selectedIconServer: resolvedIcon,
      unlockedIconCodes: Array.isArray(json.unlockedIconCodes)
        ? (json.unlockedIconCodes as string[])
        : unlockedIconCodesState ?? null,
      appliedIconCode: applied.appliedIconCode,
      appliedIconUrls: applied.urls,
      appliedIconCacheTag: applied.cacheTag,
      appliedIconEmojiFallback: applied.emojiFallback,
      appliedIconTierCode: applied.tierCode,
      titleCode: apiTitleCode ?? null,
      titleLabel: apiTitleLabel ?? null,
    });
    try {
      sessionStorage.removeItem("profile-streak-dirty");
    } catch {}
  }

  async function refreshStreakFromApi(options?: {
    silent?: boolean;
    force?: boolean;
  }) {
    const silent = Boolean(options?.silent);
    const now = Date.now();
    if (!options?.force && now - lastStreakFetchAtRef.current < 12_000) return;

    lastStreakFetchAtRef.current = now;
    streakAbortRef.current?.abort();
    const controller = new AbortController();
    streakAbortRef.current = controller;

    try {
      if (!silent) setStreakLoading(true);
      setStreakError(null);
      const res = await fetch("/api/profile-streak", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      let json: ProfileStreakApiResponse | null = null;
      try {
        json = (await res.json()) as ProfileStreakApiResponse;
      } catch {
        json = null;
      }
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "Не удалось загрузить стрик");
      applyStreakResponseToState(json);
      if (!silent) setStreakLoading(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (!silent) setStreakLoading(false);
      setStreakError(normalizeUiErrorMessage(e, "Не удалось загрузить стрик"));
    }
  }

  async function refreshLeaderboardFromApi(options?: { force?: boolean }) {
    const now = Date.now();
    if (
      !options?.force &&
      now - lastLeaderboardFetchAtRef.current < LEADERBOARD_MIN_REFRESH_MS
    )
      return;

    lastLeaderboardFetchAtRef.current = now;
    leaderboardAbortRef.current?.abort();
    const controller = new AbortController();
    leaderboardAbortRef.current = controller;

    try {
      setLeaderboardLoading(true);
      setLeaderboardError(null);
      const res = await fetch("/api/profile-streak-leaderboard", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      let json: LeaderboardApiResponse | null = null;
      try {
        json = (await res.json()) as LeaderboardApiResponse;
      } catch {
        json = null;
      }
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "Не удалось загрузить рейтинг");
      setLeaderboardTop(normalizeLeaderboardRows(json?.top));
      setLeaderboardAround(normalizeLeaderboardRows(json?.around));
      setLeaderboardMyPlace(asIntOrNull(json?.myPlace));
      setLeaderboardMyCurrent(asIntOrNull(json?.myCurrent));
      setLeaderboardMyLongest(asIntOrNull(json?.myLongest));
      setLeaderboardLoading(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setLeaderboardLoading(false);
      setLeaderboardError(
        normalizeUiErrorMessage(e, "Не удалось загрузить рейтинг")
      );
    }
  }

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
    let cancelled = false;
    async function loadProgress() {
      if (statsProp && progressProp) {
        setProgressLoading(false);
        return;
      }
      progressAbortRef.current?.abort();
      const controller = new AbortController();
      progressAbortRef.current = controller;

      try {
        setProgressLoading(true);
        setProgressError(null);
        const res = await fetch(`/api/profile-progress?slug=${projectSlug}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok)
          throw new Error(json?.error || "Не удалось загрузить прогресс");
        if (cancelled) return;
        setStats(json.stats as Stats);
        setMaterialsProgress(json.materialsProgress as MaterialProgressItem[]);
        setProgressLoading(false);
        writeProgressCache({
          ts: Date.now(),
          stats: json.stats as Stats,
          materialsProgress: json.materialsProgress as MaterialProgressItem[],
        });
      } catch (e: any) {
        if (e?.name === "AbortError" || cancelled) return;
        setProgressLoading(false);
        setProgressError(
          normalizeUiErrorMessage(e, "Не удалось загрузить прогресс")
        );
      }
    }
    runWhenIdle(() => void loadProgress(), 1200);
    return () => {
      cancelled = true;
      progressAbortRef.current?.abort();
    };
  }, [statsProp, progressProp, projectSlug]);

  useEffect(() => {
    let cancelled = false;
    const dirty =
      typeof window !== "undefined"
        ? sessionStorage.getItem("profile-streak-dirty") === "1"
        : false;
    const hasFreshCache = Boolean(
      cachedStreak?.streak &&
        Date.now() - (cachedStreak?.ts ?? 0) < STREAK_CACHE_TTL_MS
    );

    if (streakProp || cachedStreak?.streak) setStreakLoading(false);

    const doFetch = async () => {
      if (!cancelled) {
        await refreshStreakFromApi({
          silent: true,
          force: dirty || !hasFreshCache,
        });
      }
    };
    if (dirty || !hasFreshCache) void doFetch();
    else runWhenIdle(() => void doFetch(), 900);

    const onFocus = () => void refreshStreakFromApi({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible")
        void refreshStreakFromApi({ silent: true });
    };
    const onCustomRefresh = () =>
      void refreshStreakFromApi({ silent: false, force: true });

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(
      "profile-streak-refresh",
      onCustomRefresh as EventListener
    );

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        "profile-streak-refresh",
        onCustomRefresh as EventListener
      );
      streakAbortRef.current?.abort();
    };
  }, [streakProp]);

  useEffect(() => {
    if (!leaderboardOpen) return;
    void refreshLeaderboardFromApi({ force: false });
    return () => {
      leaderboardAbortRef.current?.abort();
    };
  }, [leaderboardOpen]);

  function openEdit() {
    setEditFullName(profile.full_name || "");
    setEditPhone(profile.contact_phone || "");
    setEditRegion(profile.region || "");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
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
        body: JSON.stringify({
          full_name: fullName,
          contact_phone: phone,
          region,
        }),
      });
      let json: ProfileUpdateApiResponse | null = null;
      try {
        json = (await res.json()) as ProfileUpdateApiResponse;
      } catch {
        json = null;
      }
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "Не удалось обновить профиль");
      const updated = json.profile;
      setProfile((p) => ({
        ...p,
        full_name: updated?.full_name ?? fullName,
        contact_phone: updated?.contact_phone ?? phone,
        region: updated?.region ?? region,
        is_admin:
          typeof updated?.is_admin === "boolean" ? updated.is_admin : p.is_admin,
      }));
      showNotification("Профиль успешно обновлён!");
      closeEdit();
    } catch (e: any) {
      showNotification(
        "Ошибка обновления профиля: " + normalizeUiErrorMessage(e),
        "error"
      );
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

  const overlayCss =
    backgroundProxyUrl && (bgReady || !bgLoading)
      ? `url('${backgroundProxyUrl}')`
      : "none";

  const effectiveTitleLabelForUi = equippedTitleLabelState ?? null;
  const titleText =
    effectiveTitleLabelForUi?.trim() ||
    (streakDisplay >= 1 ? "Легенда центра" : "Без титула");

  const streakChipTitle = streakLoading
    ? "Загружаем стрик..."
    : streakError
    ? `Стрик временно недоступен: ${streakError}`
    : streak
    ? `Серия: ${streakDisplay} дн. • Рекорд: ${streak.longest_streak} дн.`
    : "Серия пока не началась";
  const streakChipSub = streakLoading
    ? "серия"
    : streak?.done_today
    ? "сделано сегодня"
    : streakDisplay > 0
    ? "сохранить сегодня"
    : "начни серию";

  const brandMark = projectName.substring(0, 2).toUpperCase() || "EK";

  return (
    <div
      id="profileBody"
      className="profile-page"
      style={{ ["--profile-overlay" as any]: overlayCss }}
    >
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
            maxWidth: 360,
            fontWeight: 800,
          }}
        >
          {notif.text}
        </div>
      )}

      {/* Модалка редактирования личных данных */}
      <Modal
        open={editOpen}
        onClose={closeEdit}
        title="Редактирование профиля"
        maxWidth={520}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div className="form-group">
            <label htmlFor="editFullName">ФИО:</label>
            <input
              id="editFullName"
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="editPhone">Контактный телефон:</label>
            <input
              id="editPhone"
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="editRegion">Область проживания:</label>
            <select
              id="editRegion"
              required
              value={editRegion}
              onChange={(e) => setEditRegion(e.target.value)}
            >
              <option value="">-- Выберите область --</option>
              <option value="Белгородская">Белгородская область</option>
              <option value="Курская">Курская область</option>
              <option value="Тамбовская">Тамбовская область</option>
              <option value="Воронежская">Воронежская область</option>
              <option value="Липецкая">Липецкая область</option>
              <option value="Другое">Другая область</option>
            </select>
          </div>
          <div className="form-group">
            <label>Email:</label>
            <input type="email" value={userEmail} disabled />
            <div className="small-muted" style={{ marginTop: 5 }}>
              Email нельзя изменить
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={closeEdit}
            >
              Отмена
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ЕДИНАЯ МОДАЛКА НАГРАД (Стрики, Гардероб, Промокоды) */}
      <RewardsModal
        isOpen={rewardsModalOpen}
        defaultTab={rewardsTab}
        onClose={() => setRewardsModalOpen(false)}
      />

      {/* МОДАЛКА ЛИДЕРБОРДА */}
      <StreakLeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        loading={leaderboardLoading}
        error={leaderboardError}
        top={leaderboardTop}
        around={leaderboardAround}
        myPlace={leaderboardMyPlace}
        myCurrent={leaderboardMyCurrent}
        myLongest={leaderboardMyLongest}
        onRetry={() => void refreshLeaderboardFromApi({ force: true })}
      />

      {/* ИНФОРМАЦИОННЫЙ ДИАЛОГ ОБНОВЛЕНИЯ */}
      <Modal
        open={customUpdateDialog.open}
        onClose={closeCustomUpdateDialog}
        title={customUpdateDialog.title || "Обновление"}
        maxWidth={460}
      >
        <div style={{ display: "grid", gap: 14 }}>
          {customUpdateDialog.mode === "loading" ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px 2px",
                  fontWeight: 800,
                  color: "var(--project-text)",
                }}
              >
                <span
                  className="spinner"
                  style={{
                    borderColor: "var(--glass-border)",
                    borderTopColor: "var(--project-primary)",
                  }}
                />
                <span>{customUpdateDialog.message || "Обновляем..."}</span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "var(--project-muted)",
                  background:
                    "color-mix(in srgb, var(--project-text) 5%, transparent)",
                  borderRadius: 12,
                  padding: "12px",
                }}
              >
                Пожалуйста, дождитесь завершения.
              </div>
              <div
                className="modal-actions"
                style={{ justifyContent: "flex-end" }}
              >
                <button type="button" className="btn secondary" disabled>
                  Обновление...
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  background:
                    "color-mix(in srgb, #ef4444 8%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
                  borderRadius: 14,
                  padding: "12px 14px",
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    fontWeight: 900,
                    color: "#ef4444",
                  }}
                >
                  !
                </span>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900, color: "#ef4444" }}>
                    Не удалось обновить
                  </div>
                  <div
                    style={{
                      color: "#ef4444",
                      fontWeight: 700,
                      lineHeight: 1.35,
                      opacity: 0.9,
                    }}
                  >
                    {customUpdateDialog.message || "Ошибка соединения с сервером"}
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={closeCustomUpdateDialog}
                >
                  Закрыть
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <div className="profile-container">
        {/* ВЕРХНИЙ БАР */}
        <div className="profile-topbar">
          <div className="brand">
            <div className="brand-mark">{brandMark}</div>
            <div>
              <div className="brand-title">{projectName}</div>
              <div className="brand-subtitle">Профиль ученика</div>
            </div>
          </div>

          <div className="top-actions">
            {/* Кнопка серии / стрика */}
            {features?.streaks && (
              <button
                type="button"
                className={`streak-chip ${streakUiBase.className} ${
                  streakLoading ? "streak-chip--loading" : ""
                }`}
                title={streakChipTitle}
                aria-label="Открыть информацию о серии"
                onClick={() => openRewards("streaks")}
              >
                <span className="streak-chip-icon" aria-hidden="true">
                  <StreakIconVisual
                    iconCode={effectiveSelectedStreakIconCode ?? null}
                    cacheTag={cacheTagForCurrentIcon}
                    preferredUrls={preferredUrlsForCurrentIcon}
                    variant={null}
                    emojiFallback={chipEmojiFallback}
                    alt="Иконка серии"
                    wrapperClassName="streak-visual--chip"
                    imgClassName="streak-visual__img--chip"
                    emojiClassName="streak-visual__emoji--chip"
                  />
                </span>
                <span className="streak-chip-main">
                  <span className="streak-chip-value">
                    {streakLoading ? "…" : streakDisplay}
                  </span>
                  <span className="streak-chip-unit">дн.</span>
                </span>
                <span className="streak-chip-sub">{streakChipSub}</span>
              </button>
            )}

            {/* Топ серий */}
            {features?.leaderboard && (
              <button
                type="button"
                className="nav-pill"
                onClick={openLeaderboardModal}
                title="Открыть топ по сериям"
                aria-label="Открыть топ по сериям"
              >
                🏆 Топ серий
              </button>
            )}

            {/* Кнопка Центр Наград */}
            <button
              type="button"
              className="nav-pill"
              onClick={() => openRewards("wardrobe")}
              title="Открыть Центр Наград и Маскота"
            >
              🎭 Награды
            </button>

            <Link
              className="nav-pill"
              href={`/projects/${projectSlug}/materials`}
            >
              📚 Материалы
            </Link>
            <button
              className="nav-pill nav-pill--logout"
              type="button"
              onClick={() => void logout()}
            >
              🚪 Выйти
            </button>
          </div>
        </div>

        <div className="profile-grid">
          {/* ЛЕВАЯ КОЛОНКА */}
          <aside className="profile-panel profile-sidebar">
            <div
              className={`profile-avatar-wrapper ${
                features?.streaks
                  ? `avatar-circle--${(() => {
                      const allowed = new Set([
                        "none",
                        "bronze",
                        "silver",
                        "gold",
                        "platinum",
                        "diamond",
                        "legendary",
                      ]);
                      return allowed.has(String(uiTierCodeForColors))
                        ? String(uiTierCodeForColors)
                        : "none";
                    })()}`
                  : "avatar-circle--none"
              }`}
              role="button"
              tabIndex={0}
              onClick={() => openRewards("wardrobe")}
              style={{ cursor: "pointer" }}
              aria-label="Аватар и Центр Наград"
              title="Нажмите, чтобы открыть Центр Наград"
            >
              <div className="avatar-icon-bg" />
              <StreakIconVisual
                iconCode={effectiveSelectedStreakIconCode ?? null}
                cacheTag={cacheTagForCurrentIcon}
                preferredUrls={preferredUrlsForCurrentIcon}
                variant={null}
                emojiFallback={avatarEmojiFallback}
                alt="Иконка награды"
                priority
                wrapperClassName="streak-visual--avatar"
                imgClassName="streak-visual__img--avatar"
                emojiClassName="streak-visual__emoji--avatar"
              />
              <button
                type="button"
                className={`streak-mini-badge ${streakUiBase.ringClassName}`}
                title={`Стрик: ${streakLoading ? "…" : streakDisplay} дн.`}
                onClick={(e) => {
                  e.stopPropagation();
                  openRewards("streaks");
                }}
              >
                {streakLoading ? "…" : streakDisplay}
              </button>
            </div>

            <div className="profile-name">{nameLabel(profile.full_name)}</div>
            <div className="profile-email">{userEmail || "—"}</div>

            {/* Слот выбора титула */}
            <button
              type="button"
              className="profile-title-slot"
              onClick={() => openRewards("wardrobe")}
              title="Выбрать титул в Центре Наград"
              style={{
                cursor: "pointer",
                border: "none",
                marginBottom: "24px",
              }}
            >
              <span className="profile-title-slot-icon">🏷️</span>
              <span className="profile-title-slot-text">{titleText}</span>
            </button>

            <div
              className="details-list"
              style={{ width: "100%", marginBottom: "16px" }}
            >
              <div className="detail-item">
                <span className="detail-label">Телефон</span>
                <span className="detail-value">
                  {phoneLabel(profile.contact_phone)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Регион</span>
                <span className="detail-value">
                  {regionLabel(profile.region)}
                </span>
              </div>
            </div>

            {features?.streaks && (
              <div
                className="details-list"
                style={{ width: "100%", marginBottom: "24px" }}
              >
                <div
                  className="detail-item"
                  style={{ cursor: "pointer" }}
                  onClick={() => openRewards("streaks")}
                >
                  <span className="detail-label">Текущая серия</span>
                  <span
                    className="detail-value"
                    style={{ color: "var(--project-primary)" }}
                  >
                    {streakLoading ? "…" : `${streakDisplay} дн.`}
                  </span>
                </div>
                <div
                  className="detail-item"
                  style={{ cursor: "pointer" }}
                  onClick={() => openRewards("streaks")}
                >
                  <span className="detail-label">Рекорд</span>
                  <span className="detail-value">
                    {streakLoading ? "…" : `${longestStreakDisplay} дн.`}
                  </span>
                </div>
              </div>
            )}

            <div className="profile-actions">
              <button className="btn ghost" onClick={openEdit} type="button">
                Редактировать профиль
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  router.push(`/projects/${projectSlug}/requests`)
                }
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

          {/* ПРАВАЯ КОЛОНКА */}
          <main className="profile-panel">
            <div className="section-title">
              Статистика <b>материалов</b>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats?.totalMaterials ?? "—"}</div>
                <div className="stat-label">Доступно материалов</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats?.completedMaterials ?? "—"}
                </div>
                <div className="stat-label">Пройдено полностью</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats ? `${stats.successRate}%` : "—"}
                </div>
                <div className="stat-label">Общий прогресс</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats?.totalAvailableAssignments ?? "—"}
                </div>
                <div className="stat-label">Доступно заданий</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats?.completedAvailableAssignments ?? "—"}
                </div>
                <div className="stat-label">Решено заданий</div>
              </div>
            </div>
            {progressLoading && (
              <div
                style={{
                  marginBottom: 24,
                  fontWeight: 700,
                  color: "var(--project-muted)",
                }}
              >
                Подгружаем прогресс...
              </div>
            )}
            {progressError && (
              <div
                style={{
                  marginBottom: 24,
                  fontWeight: 800,
                  color: "#ef4444",
                }}
              >
                Прогресс не загрузился: {progressError}
              </div>
            )}

            <div className="section-title">
              Прогресс <b>обучения</b>
            </div>
            {!materialsProgress ? (
              <div style={{ fontWeight: 700, color: "var(--project-muted)" }}>
                Загрузка материалов...
              </div>
            ) : materialsProgress.length === 0 ? (
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--project-muted)",
                  textAlign: "center",
                  padding: "40px",
                  background:
                    "color-mix(in srgb, var(--project-text) 2%, transparent)",
                  borderRadius: "20px",
                }}
              >
                Материалы пока не доступны
                <div style={{ marginTop: 8, fontSize: "14px" }}>
                  Обратитесь к администратору для получения доступа
                </div>
              </div>
            ) : (
              <div className="progress-list">
                {materialsProgress.map((m) => (
                  <Link
                    key={`${m.kind}-${m.id}`}
                    href={m.href}
                    className="progress-row"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="progress-left">
                      <div className="progress-type">
                        {m.tabTitle
                          ? m.tabTitle.toUpperCase()
                          : m.kind === "textbook"
                          ? "УЧЕБНИК"
                          : "КРОССВОРД"}
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
                        <div
                          className="progress-fill"
                          style={{ width: `${m.progressPercent}%` }}
                        />
                      </div>
                      <div className="progress-percent">
                        {m.progressPercent}%
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
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
                      style={{
                        color: "var(--project-primary)",
                        textDecoration: "none",
                      }}
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
                      style={{
                        color: "var(--project-primary)",
                        textDecoration: "none",
                      }}
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