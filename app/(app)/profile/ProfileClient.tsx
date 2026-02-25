"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import StreakRoadmapModal from "@/components/streak/StreakRoadmapModal";
import TitlePickerModal, {
  type TitlePickerChoice,
  type TitleCatalogItem,
} from "@/components/profile/TitlePickerModal";
import {
  getIconVariant,
  getResolvedSelectedIconCode,
  getTierCodeByStreak,
  getUnlockedIconCodesByLongest,
  normalizeIconCode,
  type StreakIconCode,
} from "@/lib/streaks/roadmap";

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

type ProfileStreakApiResponse = {
  ok?: boolean;
  error?: string;
  streak?: unknown | null;

  // старое поле (у тебя ещё используется как fallback в коде)
  equippedTitle?:
    | {
        code?: string | null;
        titleCode?: string | null;
        label?: string | null;
        unlockedAt?: string | null;
        sourceType?: string | null;
        sourceValue?: number | null;
      }
    | null;

  // новое поле из БД /api/profile-streak (мы его приоритетно читаем)
  selectedTitle?:
    | {
        code?: string | null;
        titleCode?: string | null;
        label?: string | null;
        unlockAt?: number | null;
        description?: string | null;
      }
    | null;

  // каталог титулов (streak_title_catalog) — чтобы модалка обновлялась без деплоя
  titleCatalog?: TitleCatalogItem[] | null;

  // иконки
  unlockedIconCodes?: string[] | null;
  selectedIconCode?: string | null;
  effectiveIconCode?: string | null;
};

type SaveStreakIconApiResponse = {
  ok?: boolean;
  error?: string;
  selectedIconCode?: string | null;
  selectedIconDbCode?: string | null;
  effectiveIconCode?: string | null;
  unlockedIconCodes?: string[] | null;
};

type SaveStreakTitleApiResponse = {
  ok?: boolean;
  error?: string;
  cleared?: boolean;
  selectedTitleCode?: string | null;
  selectedTitleDbCode?: string | null;
  longestForUnlocks?: number | null;
  selectedTitle?: {
    code?: string | null;
    label?: string | null;
    unlockAt?: number | null;
    description?: string | null;
  } | null;
};

type CustomUpdateRetryAction =
  | { type: "icon"; iconCode: string }
  | { type: "title-select"; choice: TitlePickerChoice }
  | { type: "title-clear" };

type CustomUpdateDialogState = {
  open: boolean;
  mode: "loading" | "error";
  scope: "icon" | "title";
  title: string;
  message: string;
  retryAction: CustomUpdateRetryAction | null;
};

type Props = {
  userId: string;
  userEmail: string;
  initialProfile: ProfileData;
  backgroundUrl: string | null;

  stats?: Stats | null;
  materialsProgress?: MaterialProgressItem[] | null;
  streak?: StreakSnapshot | null;

  equippedTitleLabel?: string | null;
};

/**
 * Bucket c иконками стрика.
 */
const STREAK_ICON_BUCKET =
  process.env.NEXT_PUBLIC_STREAK_ICONS_BUCKET ||
  process.env.NEXT_PUBLIC_STREAK_ICON_ASSETS_BUCKET ||
  "streak-icons";

/** Кэш, чтобы профиль "вставал" моментально */
const STREAK_CACHE_KEY = "ek_profile_streak_cache_v1";
const PROGRESS_CACHE_KEY = "ek_profile_progress_cache_v1";
const STREAK_CACHE_TTL_MS = 60_000; // 1 мин (быстро обновляется, но даёт мгновенную отрисовку)
const PROGRESS_CACHE_TTL_MS = 5 * 60_000; // 5 мин

type StreakClientCache = {
  ts: number;
  streak: StreakSnapshot | null;
  selectedIconServer: StreakIconCode | null;
  titleCode: string | null;
  titleLabel: string | null;
  titleCatalog: TitleCatalogItem[] | null;
};

type ProgressClientCache = {
  ts: number;
  stats: Stats | null;
  materialsProgress: MaterialProgressItem[] | null;
};

function getClosedCustomUpdateDialog(): CustomUpdateDialogState {
  return {
    open: false,
    mode: "loading",
    scope: "icon",
    title: "",
    message: "",
    retryAction: null,
  };
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
  const cached = safeJsonParse<StreakClientCache>(sessionStorage.getItem(STREAK_CACHE_KEY));
  if (!cached?.ts) return null;
  if (Date.now() - cached.ts > STREAK_CACHE_TTL_MS) return null;
  return cached;
}

function writeStreakCache(payload: StreakClientCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function readProgressCache(): ProgressClientCache | null {
  if (typeof window === "undefined") return null;
  const cached = safeJsonParse<ProgressClientCache>(sessionStorage.getItem(PROGRESS_CACHE_KEY));
  if (!cached?.ts) return null;
  if (Date.now() - cached.ts > PROGRESS_CACHE_TTL_MS) return null;
  return cached;
}

function writeProgressCache(payload: ProgressClientCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function runWhenIdle(fn: () => void, timeout = 900) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, 50);
  }
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
    lower.includes("load failed")
  ) {
    return "Ошибка соединения с сервером";
  }

  return msg;
}

/**
 * Нормализация /api/profile-streak -> StreakSnapshot
 */
function normalizeStreakSnapshotFromApi(rawInput: unknown): StreakSnapshot | null {
  if (!rawInput || typeof rawInput !== "object") return null;
  const raw = rawInput as Record<string, any>;

  const rawCurrent = asInt(
    pick(raw, ["raw_current_streak", "rawCurrentStreak", "current_streak", "currentStreak", "current", "streak"]),
    0
  );

  const displayCurrent = asInt(
    pick(raw, ["display_current_streak", "displayCurrentStreak", "current_streak", "currentStreak"]),
    rawCurrent
  );

  const longest = asInt(
    pick(raw, ["longest_streak", "longestStreak", "display_longest_streak", "displayLongestStreak"]),
    displayCurrent
  );

  const doneToday = asBool(
    pick(raw, ["done_today", "today_completed", "todayCompleted", "is_today_completed", "isTodayCompleted"]),
    false
  );

  const canSaveToday = asBool(
    pick(raw, ["can_save_today", "canSaveToday"]),
    !doneToday
  );

  const tierCode =
    asStringOrNull(pick(raw, ["tier_code", "tierCode"])) ?? getTierCodeByStreak(displayCurrent);

  const today =
    asStringOrNull(pick(raw, ["today", "today_date", "todayDate"])) ??
    new Date().toISOString().slice(0, 10);

  const lastCompletedDate =
    asStringOrNull(pick(raw, ["last_completed_date", "lastCompletedDate", "activity_date", "lastActivityDate"])) ??
    null;

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
        icon: "👑",
        label: "Легендарный",
        className: "streak-chip--legendary",
        ringClassName: "streak-mini-badge--legendary",
      };
    case "diamond":
      return {
        icon: "💎",
        label: "Алмазный",
        className: "streak-chip--diamond",
        ringClassName: "streak-mini-badge--diamond",
      };
    case "platinum":
      return {
        icon: "🌌",
        label: "Платиновый",
        className: "streak-chip--platinum",
        ringClassName: "streak-mini-badge--platinum",
      };
    case "gold":
      return {
        icon: "🥇",
        label: "Золотой",
        className: "streak-chip--gold",
        ringClassName: "streak-mini-badge--gold",
      };
    case "silver":
      return {
        icon: "🥈",
        label: "Серебряный",
        className: "streak-chip--silver",
        ringClassName: "streak-mini-badge--silver",
      };
    case "bronze":
      return {
        icon: "🥉",
        label: "Бронзовый",
        className: "streak-chip--bronze",
        ringClassName: "streak-mini-badge--bronze",
      };
    default:
      return {
        icon: v > 0 ? "🔥" : "✨",
        label: v > 0 ? "Серия" : "Нет серии",
        className: "streak-chip--none",
        ringClassName: "streak-mini-badge--none",
      };
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function uniqStrings(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    set.add(s);
  }
  return Array.from(set);
}

function maybePublicUrlFromStoragePath(bucket: string, path: string | null | undefined): string | null {
  if (!isNonEmptyString(path)) return null;

  const raw = path.trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;

  const cleanPath = raw.replace(/^\/+/, "");

  try {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

function extractPathsFromVariant(variant: unknown): string[] {
  if (!variant || typeof variant !== "object") return [];

  const v = variant as Record<string, unknown>;
  const meta = (v.meta && typeof v.meta === "object" ? v.meta : null) as Record<string, unknown> | null;

  return uniqStrings([
    isNonEmptyString(v.webpPath) ? v.webpPath : null,
    isNonEmptyString(v.pngPath) ? v.pngPath : null,
    isNonEmptyString(v.imagePath) ? v.imagePath : null,
    isNonEmptyString(v.webp_path) ? (v.webp_path as string) : null,
    isNonEmptyString(v.png_path) ? (v.png_path as string) : null,
    meta && isNonEmptyString(meta.webpPath) ? (meta.webpPath as string) : null,
    meta && isNonEmptyString(meta.pngPath) ? (meta.pngPath as string) : null,
    meta && isNonEmptyString(meta.webp_path) ? (meta.webp_path as string) : null,
    meta && isNonEmptyString(meta.png_path) ? (meta.png_path as string) : null,
  ]);
}

function buildFallbackStoragePathsByCode(iconCode: string | null): string[] {
  if (!isNonEmptyString(iconCode)) return [];
  const code = iconCode.trim();

  return uniqStrings([
    `${code}.webp`,
    `${code}.png`,
    `v1/defaults/${code}.webp`,
    `v1/defaults/${code}.png`,
    `streak-icons/${code}.webp`,
    `streak-icons/${code}.png`,
    `icons/streak/${code}.webp`,
    `icons/streak/${code}.png`,
  ]);
}

function resolveIconCandidateUrls(params: { iconCode: string | null; variant?: unknown; bucket?: string }): string[] {
  const bucket = params.bucket || STREAK_ICON_BUCKET;
  const fromVariantPaths = extractPathsFromVariant(params.variant);
  const fromCodePaths = buildFallbackStoragePathsByCode(params.iconCode);
  const storagePaths = uniqStrings([...fromVariantPaths, ...fromCodePaths]);
  return uniqStrings(storagePaths.map((p) => maybePublicUrlFromStoragePath(bucket, p)));
}

function joinClasses(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

type StreakIconVisualProps = {
  iconCode: string | null;
  variant?: unknown;
  emojiFallback: string;
  alt: string;
  wrapperClassName?: string;
  imgClassName?: string;
  emojiClassName?: string;
};

function StreakIconVisual({
  iconCode,
  variant,
  emojiFallback,
  alt,
  wrapperClassName,
  imgClassName,
  emojiClassName,
}: StreakIconVisualProps) {
  const candidateUrls = useMemo(
    () => resolveIconCandidateUrls({ iconCode, variant, bucket: STREAK_ICON_BUCKET }),
    [iconCode, variant]
  );

  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [candidateUrls.join("|")]);

  const currentSrc = candidateUrls[imgIndex] ?? null;
  const hasImage = Boolean(currentSrc);

  return (
    <span className={joinClasses("streak-visual", wrapperClassName)} aria-hidden="true">
      {hasImage ? (
        <img
          className={joinClasses("streak-visual__img", imgClassName)}
          src={currentSrc}
          alt={alt}
          loading="eager"
          decoding="async"
          draggable={false}
          onError={() => setImgIndex((prev) => prev + 1)}
        />
      ) : (
        <span className={joinClasses("streak-visual__emoji", emojiClassName)}>{emojiFallback}</span>
      )}
    </span>
  );
}

export default function ProfileClient({
  userId,
  userEmail,
  initialProfile,
  backgroundUrl,
  stats: statsProp,
  materialsProgress: progressProp,
  streak: streakProp,
  equippedTitleLabel = null,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  // ---- instant cache bootstrap (не трогаем window на сервере) ----
  const cachedStreak = typeof window !== "undefined" ? readStreakCache() : null;
  const cachedProgress = typeof window !== "undefined" ? readProgressCache() : null;

  const [profile, setProfile] = useState<ProfileData>(initialProfile);

  // background
  const [bgLoading, setBgLoading] = useState<boolean>(Boolean(backgroundUrl));
  const [bgReady, setBgReady] = useState<boolean>(false);

  // notification
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile.full_name ?? "");
  const [editPhone, setEditPhone] = useState(profile.contact_phone ?? "");
  const [editRegion, setEditRegion] = useState(profile.region ?? "");
  const [saving, setSaving] = useState(false);

  // streak modal
  const [streakModalOpen, setStreakModalOpen] = useState(false);

  // title modal
  const [titleModalOpen, setTitleModalOpen] = useState(false);

  // окно обновления (иконка/титул)
  const [customUpdateDialog, setCustomUpdateDialog] = useState<CustomUpdateDialogState>(getClosedCustomUpdateDialog());

  // progress (сначала из props/кэша -> потом тихо обновим)
  const [stats, setStats] = useState<Stats | null>(statsProp ?? cachedProgress?.stats ?? null);
  const [materialsProgress, setMaterialsProgress] = useState<MaterialProgressItem[] | null>(
    progressProp ?? cachedProgress?.materialsProgress ?? null
  );
  const [progressLoading, setProgressLoading] = useState<boolean>(
    Boolean(!statsProp && !progressProp && !(cachedProgress?.stats && cachedProgress?.materialsProgress))
  );
  const [progressError, setProgressError] = useState<string | null>(null);

  // streak snapshot (сначала из props/кэша -> потом тихо обновим)
  const [streak, setStreak] = useState<StreakSnapshot | null>(streakProp ?? cachedStreak?.streak ?? null);
  const [streakLoading, setStreakLoading] = useState<boolean>(Boolean(!streakProp && !cachedStreak?.streak));
  const [streakError, setStreakError] = useState<string | null>(null);

  // title from server (selected)
  const [equippedTitleLabelState, setEquippedTitleLabelState] = useState<string | null>(
    cachedStreak?.titleLabel ?? equippedTitleLabel ?? null
  );
  const [equippedTitleCodeState, setEquippedTitleCodeState] = useState<string | null>(cachedStreak?.titleCode ?? null);

  // title catalog for modal
  const [titleCatalogState, setTitleCatalogState] = useState<TitleCatalogItem[] | null>(cachedStreak?.titleCatalog ?? null);

  const [savingTitle, setSavingTitle] = useState(false);

  // icon selection
  const [selectedStreakIconCodeLocal, setSelectedStreakIconCodeLocal] = useState<StreakIconCode | null>(null);
  const [selectedStreakIconCodeServer, setSelectedStreakIconCodeServer] = useState<StreakIconCode | null>(
    cachedStreak?.selectedIconServer ?? null
  );
  const [savingStreakIcon, setSavingStreakIcon] = useState(false);

  // throttle/abort to avoid piling requests
  const lastStreakFetchAtRef = useRef<number>(0);
  const streakAbortRef = useRef<AbortController | null>(null);
  const progressAbortRef = useRef<AbortController | null>(null);

  const isCustomizationUpdateLocked = customUpdateDialog.open || savingTitle || savingStreakIcon;

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 3500);
  }

  function openUpdateLoading(scope: "icon" | "title") {
    setCustomUpdateDialog({
      open: true,
      mode: "loading",
      scope,
      title: scope === "icon" ? "Обновляем иконку" : "Обновляем титул",
      message: scope === "icon" ? "Сохраняем выбранную иконку серии..." : "Сохраняем выбранный титул...",
      retryAction: null,
    });
  }

  function showUpdateError(scope: "icon" | "title", error: unknown, retryAction: CustomUpdateRetryAction) {
    setCustomUpdateDialog({
      open: true,
      mode: "error",
      scope,
      title: scope === "icon" ? "Ошибка обновления иконки" : "Ошибка обновления титула",
      message: normalizeUiErrorMessage(error, "Ошибка соединения с сервером"),
      retryAction,
    });
  }

  function closeCustomUpdateDialog() {
    setCustomUpdateDialog((prev) => {
      if (!prev.open) return prev;
      if (prev.mode === "loading") return prev; // во время загрузки не закрываем
      return getClosedCustomUpdateDialog();
    });
  }

  function openStreakModal() {
    if (customUpdateDialog.open) return;
    setStreakModalOpen(true);
  }

  function closeStreakModal() {
    setStreakModalOpen(false);
  }

  function openTitleModal() {
    if (customUpdateDialog.open) return;
    setTitleModalOpen(true);
  }

  function closeTitleModal() {
    setTitleModalOpen(false);
  }

  async function retryCustomUpdateDialogAction() {
    const action = customUpdateDialog.retryAction;
    if (!action) return;

    if (action.type === "icon") {
      await handleSelectStreakIcon(action.iconCode, { force: true });
      return;
    }
    if (action.type === "title-select") {
      await handleSelectTitle(action.choice, { force: true });
      return;
    }
    if (action.type === "title-clear") {
      await handleClearSelectedTitle({ force: true });
    }
  }

  function applyStreakResponseToState(json: ProfileStreakApiResponse, opts?: { fromCache?: boolean }) {
    const normalizedStreak = normalizeStreakSnapshotFromApi(json.streak ?? null);
    if (normalizedStreak) setStreak(normalizedStreak);

    // титул: приоритет selectedTitle (из БД), потом equippedTitle (старое)
    const rawTitleObj = (json.selectedTitle ?? json.equippedTitle ?? null) as Record<string, any> | null;

    const apiTitleLabel = rawTitleObj && typeof rawTitleObj.label === "string" ? rawTitleObj.label : null;
    const apiTitleCode =
      (rawTitleObj && typeof rawTitleObj.titleCode === "string" && rawTitleObj.titleCode) ||
      (rawTitleObj && typeof rawTitleObj.code === "string" && rawTitleObj.code) ||
      null;

    setEquippedTitleLabelState(apiTitleLabel ?? null);
    setEquippedTitleCodeState(apiTitleCode ?? null);

    // каталог титулов
    if (Array.isArray(json.titleCatalog)) {
      setTitleCatalogState(json.titleCatalog as TitleCatalogItem[]);
    }

    // иконки
    const apiSelected = normalizeIconCode(json.selectedIconCode ?? null);
    const apiEffective = normalizeIconCode(json.effectiveIconCode ?? null);
    setSelectedStreakIconCodeServer(apiSelected ?? apiEffective ?? null);

    // если оптимистичное состояние совпало с сервером — очищаем локалку
    setSelectedStreakIconCodeLocal((prev) => {
      if (!prev) return prev;
      const compareWith = apiSelected ?? apiEffective ?? null;
      if (compareWith && prev === compareWith) return null;
      return prev;
    });

    // кэшируем (чтобы следующий заход был мгновенный)
    const cachePayload: StreakClientCache = {
      ts: Date.now(),
      streak: normalizedStreak,
      selectedIconServer: (apiSelected ?? apiEffective ?? null) as StreakIconCode | null,
      titleCode: apiTitleCode ?? null,
      titleLabel: apiTitleLabel ?? null,
      titleCatalog: Array.isArray(json.titleCatalog) ? (json.titleCatalog as TitleCatalogItem[]) : titleCatalogState ?? null,
    };
    writeStreakCache(cachePayload);

    if (!opts?.fromCache) {
      try {
        sessionStorage.removeItem("profile-streak-dirty");
      } catch {
        // ignore
      }
    }
  }

  async function refreshStreakFromApi(options?: { silent?: boolean; force?: boolean }) {
    const silent = Boolean(options?.silent);

    // throttle: чтобы не лупить /api/profile-streak каждые 100мс (focus/visibility)
    const now = Date.now();
    if (!options?.force && now - lastStreakFetchAtRef.current < 12_000) return;
    lastStreakFetchAtRef.current = now;

    // abort previous
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

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось загрузить стрик");
      }

      applyStreakResponseToState(json);

      if (!silent) setStreakLoading(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (!silent) setStreakLoading(false);
      setStreakError(normalizeUiErrorMessage(e, "Не удалось загрузить стрик"));
    }
  }

  // preload background image (не мешает отрисовке, просто улучшает UX)
  useEffect(() => {
    if (!backgroundUrl) {
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
    img.src = backgroundUrl;

    const t = setTimeout(() => setBgLoading(false), 6000);
    return () => clearTimeout(t);
  }, [backgroundUrl]);

  // прогресс: сначала показываем кэш/props, потом тихо обновляем "в idle"
  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      if (statsProp && progressProp) {
        setProgressLoading(false);
        return;
      }

      // abort previous
      progressAbortRef.current?.abort();
      const controller = new AbortController();
      progressAbortRef.current = controller;

      try {
        setProgressLoading(true);
        setProgressError(null);

        const res = await fetch("/api/profile-progress", { method: "GET", cache: "no-store", signal: controller.signal });
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Не удалось загрузить прогресс");
        }

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
        if (e?.name === "AbortError") return;
        if (cancelled) return;
        setProgressLoading(false);
        setProgressError(normalizeUiErrorMessage(e, "Не удалось загрузить прогресс"));
      }
    }

    // если уже есть данные (props или кэш), не тормозим — догружаем позже
    runWhenIdle(() => void loadProgress(), 1200);

    return () => {
      cancelled = true;
      progressAbortRef.current?.abort();
    };
  }, [statsProp, progressProp]);

  // стрик: сразу показываем кэш/props, а обновление — тихо и не сразу (idle)
  useEffect(() => {
    let cancelled = false;

    const dirty =
      typeof window !== "undefined" ? sessionStorage.getItem("profile-streak-dirty") === "1" : false;

    const hasFreshCache = Boolean(cachedStreak?.streak && Date.now() - (cachedStreak?.ts ?? 0) < STREAK_CACHE_TTL_MS);

    if (streakProp || cachedStreak?.streak) {
      setStreakLoading(false);
    }

    const doFetch = async () => {
      if (cancelled) return;
      await refreshStreakFromApi({ silent: true, force: dirty || !hasFreshCache });
    };

    if (dirty || !hasFreshCache) {
      // если после выполнения задания / нет свежего кэша — обновим сразу
      void doFetch();
    } else {
      // иначе — в idle (быстро, но не блокирует UX)
      runWhenIdle(() => void doFetch(), 900);
    }

    const onFocus = () => void refreshStreakFromApi({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshStreakFromApi({ silent: true });
    };
    const onCustomRefresh = () => void refreshStreakFromApi({ silent: false, force: true });

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("profile-streak-refresh", onCustomRefresh as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("profile-streak-refresh", onCustomRefresh as EventListener);
      streakAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streakProp]);

  // чистим старые ключи
  useEffect(() => {
    try {
      localStorage.removeItem("profile-selected-streak-icon");
      localStorage.removeItem("profile-selected-title-v1");
    } catch {
      // ignore
    }
  }, []);

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
    const region = editRegion;

    if (!fullName || !phone || !region) {
      showNotification("❌ Заполните все поля", "error");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, contact_phone: phone, region })
        .eq("id", userId);

      if (error) throw error;

      setProfile((p) => ({ ...p, full_name: fullName, contact_phone: phone, region }));
      showNotification("✅ Профиль успешно обновлен!");
      closeEdit();
    } catch (e: any) {
      showNotification("❌ Ошибка обновления профиля: " + normalizeUiErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  async function handleSelectStreakIcon(iconCodeRaw: string, options?: { force?: boolean }) {
    const normalized = normalizeIconCode(iconCodeRaw);
    const variant = getIconVariant(normalized);

    if (!normalized || !variant) {
      showNotification("❌ Неизвестная иконка серии", "error");
      return;
    }

    if (!options?.force && (savingStreakIcon || savingTitle || customUpdateDialog.open)) return;

    const prevLocal = selectedStreakIconCodeLocal;
    const prevServer = selectedStreakIconCodeServer;

    try {
      openUpdateLoading("icon");

      setSelectedStreakIconCodeLocal(normalized);
      setSavingStreakIcon(true);

      const res = await fetch("/api/profile-streak-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconCode: normalized }),
      });

      let json: SaveStreakIconApiResponse | null = null;
      try {
        json = (await res.json()) as SaveStreakIconApiResponse;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось сохранить иконку серии");
      }

      const resolvedSelected = normalizeIconCode(json.selectedIconCode ?? normalized);
      const resolvedEffective = normalizeIconCode(json.effectiveIconCode ?? null);

      setSelectedStreakIconCodeServer(resolvedSelected ?? resolvedEffective ?? normalized);
      setSelectedStreakIconCodeLocal(null);

      setCustomUpdateDialog(getClosedCustomUpdateDialog());
      showNotification("✅ Иконка серии успешно обновлена");
    } catch (e: any) {
      setSelectedStreakIconCodeLocal(prevLocal);
      setSelectedStreakIconCodeServer(prevServer);
      showUpdateError("icon", e, { type: "icon", iconCode: normalized });
    } finally {
      setSavingStreakIcon(false);
    }
  }

  async function handleSelectTitle(choice: TitlePickerChoice, options?: { force?: boolean }) {
    if (!options?.force && (savingTitle || savingStreakIcon || customUpdateDialog.open)) return;

    const prevCode = equippedTitleCodeState;
    const prevLabel = equippedTitleLabelState;

    try {
      openUpdateLoading("title");
      setSavingTitle(true);

      // optimistic
      setEquippedTitleCodeState(choice.code);
      setEquippedTitleLabelState(choice.label);

      const res = await fetch("/api/profile-streak-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleCode: choice.code }),
      });

      let json: SaveStreakTitleApiResponse | null = null;
      try {
        json = (await res.json()) as SaveStreakTitleApiResponse;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось сохранить титул");
      }

      const savedCode =
        (typeof json.selectedTitle?.code === "string" && json.selectedTitle.code) ||
        (typeof json.selectedTitleCode === "string" && json.selectedTitleCode) ||
        choice.code;

      const savedLabel =
        (typeof json.selectedTitle?.label === "string" && json.selectedTitle.label) || choice.label;

      setEquippedTitleCodeState(savedCode);
      setEquippedTitleLabelState(savedLabel);

      setCustomUpdateDialog(getClosedCustomUpdateDialog());
      showNotification("✅ Титул успешно обновлён");
      closeTitleModal();

      // тихо подтянем свежий каталог/синхру
      void refreshStreakFromApi({ silent: true, force: true });
    } catch (e: any) {
      setEquippedTitleCodeState(prevCode);
      setEquippedTitleLabelState(prevLabel);
      showUpdateError("title", e, { type: "title-select", choice });
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleClearSelectedTitle(options?: { force?: boolean }) {
    if (!options?.force && (savingTitle || savingStreakIcon || customUpdateDialog.open)) return;

    const prevCode = equippedTitleCodeState;
    const prevLabel = equippedTitleLabelState;

    try {
      openUpdateLoading("title");
      setSavingTitle(true);

      // optimistic clear
      setEquippedTitleCodeState(null);
      setEquippedTitleLabelState(null);

      const res = await fetch("/api/profile-streak-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });

      let json: SaveStreakTitleApiResponse | null = null;
      try {
        json = (await res.json()) as SaveStreakTitleApiResponse;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось сбросить титул");
      }

      setEquippedTitleCodeState(null);
      setEquippedTitleLabelState(null);

      setCustomUpdateDialog(getClosedCustomUpdateDialog());
      showNotification("✅ Титул успешно сброшен");
      closeTitleModal();

      void refreshStreakFromApi({ silent: true, force: true });
    } catch (e: any) {
      setEquippedTitleCodeState(prevCode);
      setEquippedTitleLabelState(prevLabel);
      showUpdateError("title", e, { type: "title-clear" });
    } finally {
      setSavingTitle(false);
    }
  }

  const overlayCss = backgroundUrl && (bgReady || !bgLoading) ? `url('${backgroundUrl}')` : "none";

  const streakDisplay = Math.max(0, Number(streak?.display_current_streak ?? 0));
  const longestStreakDisplay = Math.max(0, Number(streak?.longest_streak ?? 0));

  const unlockedIconCodesByLongest = useMemo(
    () => getUnlockedIconCodesByLongest(longestStreakDisplay),
    [longestStreakDisplay]
  );

  const effectiveSelectedStreakIconCode = useMemo(() => {
    return getResolvedSelectedIconCode(
      selectedStreakIconCodeLocal ?? selectedStreakIconCodeServer,
      longestStreakDisplay
    );
  }, [selectedStreakIconCodeLocal, selectedStreakIconCodeServer, longestStreakDisplay]);

  const selectedIconVariant = useMemo(
    () => getIconVariant(effectiveSelectedStreakIconCode),
    [effectiveSelectedStreakIconCode]
  );

  const resolvedUiTierCode = selectedIconVariant?.tierCode ?? getTierCodeByStreak(streakDisplay);
  const streakUiBase = getStreakTierUi(resolvedUiTierCode, streakDisplay);
  const streakUi = selectedIconVariant ? { ...streakUiBase, icon: selectedIconVariant.emoji } : streakUiBase;

  const effectiveTitleCodeForUi = equippedTitleCodeState ?? null;
  const effectiveTitleLabelForUi = equippedTitleLabelState ?? null;

  const titleText =
    effectiveTitleLabelForUi?.trim() || (streakDisplay >= 1 ? "Без титула (пока не выбран)" : "Без титула");

  const streakChipTitle = streakLoading
    ? "Загружаем стрик..."
    : streakError
      ? `Стрик временно недоступен: ${streakError}`
      : streak
        ? `Серия: ${streakDisplay} дн. • Рекорд: ${streak.longest_streak} дн.`
        : "Серия пока не началась";

  const streakChipSub = streakLoading ? "серия" : streak?.done_today ? "сегодня ✅" : streakDisplay > 0 ? "сохранить сегодня" : "начни серию";

  const avatarEmojiFallback = selectedIconVariant?.emoji || streakUi.icon || "✨";
  const chipEmojiFallback = selectedIconVariant?.emoji || streakUi.icon || "✨";

  const titleSavingNow =
    customUpdateDialog.open && customUpdateDialog.scope === "title" && customUpdateDialog.mode === "loading";

  const titleUpdateDialogOpen = customUpdateDialog.open && customUpdateDialog.scope === "title";

  return (
    <div
      id="profileBody"
      style={{
        ["--profile-overlay" as any]: overlayCss,
      }}
    >
      {bgLoading ? (
        <div className="background-loading" style={{ display: "block" }}>
          <span className="spinner" />
          Загружаем фон...
        </div>
      ) : null}

      {notif ? (
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
      ) : null}

      {/* Модалка редактирования */}
      <Modal open={editOpen} onClose={closeEdit} title="✏️ Редактирование профиля" maxWidth={520}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div className="form-group">
            <label htmlFor="editFullName">ФИО:</label>
            <input id="editFullName" type="text" required value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="editPhone">Контактный телефон:</label>
            <input id="editPhone" type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="editRegion">Область проживания:</label>
            <select id="editRegion" required value={editRegion} onChange={(e) => setEditRegion(e.target.value)}>
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
            <input type="email" value={userEmail} disabled style={{ backgroundColor: "#f5f5f5", color: "#666" }} />
            <div className="small-muted" style={{ marginTop: 5 }}>
              Email нельзя изменить
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={closeEdit}>
              ❌ Отмена
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Сохранение..." : "💾 Сохранить изменения"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Модалка выбора титула (теперь получает titleCatalog из БД) */}
      <TitlePickerModal
        open={titleModalOpen}
        onClose={closeTitleModal}
        longestStreak={longestStreakDisplay}
        currentTitleCode={effectiveTitleCodeForUi}
        currentTitleLabel={effectiveTitleLabelForUi}
        titleCatalog={titleCatalogState}
        onSelectTitle={(choice) => {
          if (isCustomizationUpdateLocked) return;
          void handleSelectTitle(choice);
        }}
        onClearLocalTitle={() => {
          if (isCustomizationUpdateLocked) return;
          void handleClearSelectedTitle();
        }}
        loading={streakLoading || titleSavingNow}
      />

      {/* Модалка дорожки стрика */}
      <StreakRoadmapModal
        open={streakModalOpen}
        onClose={closeStreakModal}
        streak={streak}
        loading={streakLoading}
        error={streakError}
        equippedTitleLabel={effectiveTitleLabelForUi}
        unlockedIconCodes={unlockedIconCodesByLongest}
        selectedIconCode={effectiveSelectedStreakIconCode}
        onSelectIconCode={isCustomizationUpdateLocked ? undefined : handleSelectStreakIcon}
      />

      {/* Окно обновления иконки/титула */}
      <Modal open={customUpdateDialog.open} onClose={closeCustomUpdateDialog} title={customUpdateDialog.title || "Обновление"} maxWidth={460}>
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
                  color: "#324a5f",
                }}
              >
                <span className="spinner" />
                <span>{customUpdateDialog.message || "Обновляем..."}</span>
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "rgba(50,74,95,0.78)",
                  background: "rgba(255,255,255,0.55)",
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                Пожалуйста, дождитесь завершения. Пока окно открыто, выбор новой иконки/титула временно заблокирован.
              </div>

              <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn secondary" disabled>
                  ⏳ Обновление...
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
                  background: "rgba(244,67,54,0.08)",
                  border: "1px solid rgba(244,67,54,0.18)",
                  borderRadius: 14,
                  padding: "12px 14px",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>❌</span>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900, color: "#b71c1c" }}>Не удалось обновить</div>
                  <div style={{ color: "#7f1d1d", fontWeight: 700, lineHeight: 1.35 }}>
                    {customUpdateDialog.message || "Ошибка соединения с сервером"}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={closeCustomUpdateDialog}>
                  ✖ Закрыть
                </button>
                <button type="button" className="btn" onClick={() => void retryCustomUpdateDialogAction()}>
                  🔄 Повторить
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <div className="container">
        {/* ===== Topbar ===== */}
        <div className="profile-topbar">
          <div className="brand">
            <div className="brand-mark">EK</div>
            <div>
              <div className="brand-title">Учебники Хиппоши</div>
              <div className="brand-subtitle">☕ Образовательная платформа</div>
            </div>
          </div>

          <div className="top-actions">
            {/* Streak chip */}
            <button
              type="button"
              className={`streak-chip streak-chip--button ${streakUi.className} ${streakLoading ? "streak-chip--loading" : ""}`}
              title={streakChipTitle}
              aria-label="Открыть информацию о серии"
              onClick={openStreakModal}
            >
              <span className="streak-chip-icon" aria-hidden="true">
                <StreakIconVisual
                  iconCode={effectiveSelectedStreakIconCode ?? null}
                  variant={selectedIconVariant}
                  emojiFallback={chipEmojiFallback}
                  alt="Иконка серии"
                  wrapperClassName="streak-visual--chip"
                  imgClassName="streak-visual__img--chip"
                  emojiClassName="streak-visual__emoji--chip"
                />
              </span>
              <span className="streak-chip-main">
                <span className="streak-chip-value">{streakLoading ? "…" : streakDisplay}</span>
                <span className="streak-chip-unit">дн.</span>
              </span>
              <span className="streak-chip-sub">{streakChipSub}</span>
            </button>

            <Link className="nav-pill nav-pill--info" href="/info">
              <span>📄</span>
              Информация
            </Link>

            <Link className="nav-pill nav-pill--materials" href="/materials">
              <span>📚</span>
              Материалы
            </Link>

            <button className="nav-pill nav-pill--logout" type="button" onClick={() => void logout()}>
              <span>⏻</span>
              Выйти
            </button>
          </div>
        </div>

        {/* ===== Main layout ===== */}
        <div className="profile-layout">
          {/* LEFT */}
          <aside className="panel">
            <div className="profile-card">
              <div className="avatar-circle" role="img" aria-label="Иконка награды профиля">
                <div className="avatar-inner">
                  {/* Иконка награды */}
                  <div className="avatar-icon" aria-hidden="true">
                    <span className="avatar-icon-bg" />
                    <StreakIconVisual
                      iconCode={effectiveSelectedStreakIconCode ?? null}
                      variant={selectedIconVariant}
                      emojiFallback={avatarEmojiFallback}
                      alt="Иконка награды"
                      wrapperClassName="streak-visual--avatar"
                      imgClassName="streak-visual__img--avatar"
                      emojiClassName="streak-visual__emoji--avatar"
                    />
                  </div>

                  {/* Бейдж стрика (без иконки — только число) */}
                  <button
                    type="button"
                    className={`streak-mini-badge ${streakUi.ringClassName}`}
                    title={`Стрик: ${streakLoading ? "…" : streakDisplay} дн. Нажмите для подробностей`}
                    aria-label="Открыть серию активности"
                    onClick={openStreakModal}
                  >
                    <b>{streakLoading ? "…" : streakDisplay}</b>
                  </button>
                </div>
              </div>

              <div className="profile-name">{nameLabel(profile.full_name)}</div>

              {/* Титул */}
              <button
                type="button"
                onClick={openTitleModal}
                title="Выбрать титул"
                aria-label="Открыть выбор титула"
                style={{
                  all: "unset",
                  width: "100%",
                  display: "block",
                  cursor: customUpdateDialog.open ? "not-allowed" : "pointer",
                  opacity: customUpdateDialog.open && !titleUpdateDialogOpen ? 0.88 : 1,
                }}
              >
                <div
                  className="profile-title-slot"
                  style={{
                    position: "relative",
                    minHeight: 44,
                    paddingTop: 8,
                    paddingBottom: 8,
                    paddingLeft: 12,
                    paddingRight: 12,
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    className="profile-title-slot-icon"
                    style={{
                      fontSize: 16,
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    🏷️
                  </span>

                  <span
                    className="profile-title-slot-text"
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      lineHeight: 1.15,
                      letterSpacing: "0.01em",
                      color: "#4f6276",
                    }}
                  >
                    {titleText}
                  </span>

                  <span
                    aria-hidden="true"
                    style={{
                      marginLeft: "auto",
                      opacity: 0.9,
                      fontWeight: 900,
                      fontSize: 16,
                      paddingLeft: 10,
                      lineHeight: 1,
                    }}
                  >
                    {titleSavingNow ? "⏳" : "✨"}
                  </span>
                </div>
              </button>

              {/* Стрик / рекорд */}
              <div className="streak-summary-card">
                <button
                  type="button"
                  className="streak-summary-row streak-summary-row--button"
                  onClick={openStreakModal}
                  title="Открыть подробности серии"
                >
                  <span className="streak-summary-key">🔥 Текущая серия</span>
                  <span className="streak-summary-value">{streakLoading ? "…" : `${streakDisplay} дн.`}</span>
                </button>

                <button
                  type="button"
                  className="streak-summary-row streak-summary-row--button"
                  onClick={openStreakModal}
                  title="Открыть подробности серии"
                >
                  <span className="streak-summary-key">🏆 Рекорд</span>
                  <span className="streak-summary-value">{streakLoading ? "…" : `${longestStreakDisplay} дн.`}</span>
                </button>
              </div>

              <div className="profile-email">{userEmail || "—"}</div>

              <div className="profile-mini">
                <div className="mini-col">
                  <div className="mini-cap">
                    <span className="mini-ico">📞</span> ТЕЛЕФОН
                  </div>
                  <div className="mini-val">{phoneLabel(profile.contact_phone)}</div>
                </div>

                <div className="profile-mini-divider" />

                <div className="mini-col">
                  <div className="mini-cap">
                    <span className="mini-ico">📍</span> РЕГИОН
                  </div>
                  <div className="mini-val">{regionLabel(profile.region)}</div>
                </div>
              </div>

              <div className="pill pill--teal">
                <span className="pill-icon">📘</span>
                Доступно заданий: {stats?.totalAvailableAssignments ?? "—"}
              </div>

              <div className="pill pill--red">
                <span className="pill-icon">✅</span>
                Выполнено: {stats?.completedAvailableAssignments ?? "—"}
              </div>

              <button className="action-btn action-btn--primary" onClick={openEdit} type="button">
                <span>✏️</span> Редактировать профиль
              </button>

              <button className="action-btn action-btn--dangerSoft" onClick={() => (window.location.href = "/requests")} type="button">
                <span>📝</span> Заявки на покупку
              </button>

              {profile.is_admin ? (
                <Link className="action-btn action-btn--soft" href="/admin">
                  <span>⚙️</span> Админка
                </Link>
              ) : null}
            </div>
          </aside>

          {/* RIGHT */}
          <main className="panel">
            {/* Section 1: Stats */}
            <section className="section">
              <div className="section-title">
                <span className="section-ico">📊</span>
                Статистика по доступным <b>материалам</b>
              </div>

              <div className="mini-stats">
                <div className="mini-stat">
                  <div className="mini-stat-number">{stats?.totalMaterials ?? "—"}</div>
                  <div className="mini-stat-label">Доступных материала</div>
                </div>

                <div className="mini-stat">
                  <div className="mini-stat-number">{stats?.completedMaterials ?? "—"}</div>
                  <div className="mini-stat-label">Пройдено материалов</div>
                </div>

                <div className="mini-stat">
                  <div className="mini-stat-number">{stats ? `${stats.successRate}%` : "—"}</div>
                  <div className="mini-stat-label">Общий прогресс</div>
                </div>
              </div>

              {progressLoading ? (
                <div style={{ marginTop: 12, fontWeight: 800, color: "rgba(44,62,80,0.6)" }}>
                  🔄 Подгружаем прогресс...
                </div>
              ) : null}

              {progressError ? (
                <div style={{ marginTop: 12, fontWeight: 900, color: "#c62828" }}>
                  ❌ Прогресс не загрузился: {progressError}
                </div>
              ) : null}
            </section>

            {/* Section 2: Progress */}
            <section className="section">
              <div className="section-title">
                <span className="section-ico">📁</span>
                Прогресс по доступным <b>материалам</b>
              </div>

              {!materialsProgress ? (
                <div style={{ fontWeight: 800, color: "rgba(44,62,80,0.6)" }}>📚 Загрузка материалов...</div>
              ) : materialsProgress.length === 0 ? (
                <div style={{ fontWeight: 800, color: "rgba(44,62,80,0.6)" }}>
                  📚 Материалы пока не доступны
                  <div style={{ marginTop: 6, fontWeight: 700 }}>Обратитесь к администратору для получения доступа</div>
                </div>
              ) : (
                <div className="progress-list">
                  {materialsProgress.map((m) => (
                    <div key={`${m.kind}-${m.id}`} className="progress-row" onClick={() => (window.location.href = m.href)}>
                      <div className="progress-left">
                        <div className={"progress-type " + (m.kind === "textbook" ? "progress-type--textbook" : "progress-type--crossword")}>
                          {m.kind === "textbook" ? "📗 УЧЕБНИК" : "🧩 КРОССВОРД"}
                        </div>

                        <div className="progress-title">{m.title}</div>
                        <div className="progress-sub">
                          {m.kind === "textbook" ? `${m.completed} из ${m.total} заданий выполнено` : `${m.completed} из ${m.total} слов отгадано`}
                          {m.total === 0 ? " (нет заданий)" : ""}
                        </div>
                      </div>

                      <div className="progress-right">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${m.progressPercent}%` }} />
                        </div>
                        <div className="progress-percent">{m.progressPercent}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Info */}
            <section className="section">
              <div className="section-title">
                <span className="section-ico">💡</span>
                <b>Информация</b>
              </div>

              <ul className="info-list">
                <li className="info-li">
                  <span className="info-bullet">▢</span>
                  На этой странице отображается ваш прогресс по доступным учебникам и кроссвордам.
                </li>
                <li className="info-li">
                  <span className="info-bullet">▢</span>
                  В разделе “Прогресс по материалам” показаны все учебники и кроссворды, к которым у вас есть доступ.
                </li>
                <li className="info-li">
                  <span className="info-bullet">▢</span>
                  <span>
                    <b>Совет:</b> регулярно занимайтесь для достижения лучших результатов!
                  </span>
                </li>
              </ul>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}