// app/api/profile-streak/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/response";
import {
  STREAK_ICONS_BUCKET_DEFAULT,
  normalizeRpcStreakSnapshot,
  toCompatStreakSnapshotPayload,
} from "@/lib/streaks/roadmap";

type StreakIconAssetRow = {
  code: string;
  label: string | null;
  tier_code: string | null;
  webp_path: string | null;
  png_path: string | null;
  emoji_fallback: string | null;
  version: string | null;
  is_active: boolean;
  is_default_for_tier?: boolean | null;
  sort_order?: number | null;
  meta?: Record<string, any> | null;
  updated_at?: string | null;
};

type StreakTitleCatalogRow = {
  code: string;
  label: string | null;
  unlock_at: number | null;
  description: string | null;
  is_active: boolean;
  sort_order?: number | null;
  version?: string | null;
  meta?: Record<string, any> | null;
};

type IconVisualPayload = {
  // ✅ ВАЖНО: code теперь = DB code (gold-1, diamond-1, ...)
  code: string;
  unlockAt: number;

  tierCode: string;
  label: string;
  emojiFallback: string;

  webpPath: string | null;
  pngPath: string | null;

  bucket: string;

  candidatePaths: string[];
  candidatePublicUrls: string[];
  publicUrl: string | null;

  cacheTag: string | null;
  dbUpdatedAt: string | null;
  sortOrder: number;
};

type TitleVisualPayload = {
  code: string;
  label: string;
  unlockAt: number;
  description: string | null;
  sortOrder: number;
  version: string | null;
};

function toTrimmedStringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function toInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function dedupeStrings(items: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item) continue;
    const v = String(item).trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function appendCacheTag(url: string | null, tag: string | null) {
  if (!url || !tag) return url;
  const glue = url.includes("?") ? "&" : "?";
  return `${url}${glue}v=${encodeURIComponent(tag)}`;
}

function buildCacheTagFromRow(row: StreakIconAssetRow | null): string | null {
  if (!row) return null;

  const meta = row.meta && typeof row.meta === "object" ? row.meta : null;
  const metaTag =
    (typeof meta?.cache_tag === "string" && meta.cache_tag.trim()) ||
    (typeof meta?.cacheTag === "string" && meta.cacheTag.trim()) ||
    null;
  if (metaTag) return metaTag;

  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
  if (updatedAt) {
    const ms = Date.parse(updatedAt);
    if (Number.isFinite(ms)) return String(ms);
    return updatedAt;
  }

  return typeof row.version === "string" && row.version.trim() ? row.version.trim() : null;
}

function getDbUnlockAtForIcon(row: StreakIconAssetRow | null) {
  const meta = row?.meta && typeof row.meta === "object" ? row.meta : null;
  const v =
    meta?.unlock_at ??
    meta?.unlockAt ??
    meta?.day ??
    meta?.days ??
    meta?.unlockDay ??
    meta?.unlock_day ??
    null;

  const parsed = toInt(v, 0);
  // ❗ Если unlockAt не задан — считаем, что иконка НЕ настроена (ставим 0, потом отфильтруем)
  return parsed > 0 ? parsed : 0;
}

function buildIconCandidatePaths(dbRow: StreakIconAssetRow): string[] {
  const code = toTrimmedStringOrNull(dbRow.code) || "";
  const meta = dbRow.meta && typeof dbRow.meta === "object" ? dbRow.meta : null;

  const metaWebp =
    toTrimmedStringOrNull(meta?.webp_path) ||
    toTrimmedStringOrNull(meta?.webpPath) ||
    null;

  const metaPng =
    toTrimmedStringOrNull(meta?.png_path) ||
    toTrimmedStringOrNull(meta?.pngPath) ||
    null;

  const direct = dedupeStrings([
    toTrimmedStringOrNull(dbRow.webp_path),
    toTrimmedStringOrNull(dbRow.png_path),
    metaWebp,
    metaPng,
  ]);

  const fallbacks = code
    ? dedupeStrings([
        `${code}.webp`,
        `${code}.png`,
        `v1/defaults/${code}.webp`,
        `v1/defaults/${code}.png`,
      ])
    : [];

  return dedupeStrings([...direct, ...fallbacks]).map((p) => p.replace(/^\/+/, ""));
}

function normalizeTitleCatalogRows(rows: StreakTitleCatalogRow[] | null | undefined): TitleVisualPayload[] {
  const out: TitleVisualPayload[] = [];
  const seen = new Set<string>();

  for (const row of rows ?? []) {
    const code = toTrimmedStringOrNull(row?.code);
    if (!code || seen.has(code)) continue;

    const unlockAt = toInt(row?.unlock_at, 0);
    if (unlockAt <= 0) continue;

    const label = toTrimmedStringOrNull(row?.label) || code;

    out.push({
      code,
      label,
      unlockAt,
      description: toTrimmedStringOrNull(row?.description),
      sortOrder: toInt(row?.sort_order, 0),
      version: toTrimmedStringOrNull(row?.version),
    });

    seen.add(code);
  }

  out.sort((a, b) => {
    if (a.unlockAt !== b.unlockAt) return a.unlockAt - b.unlockAt;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, "ru");
  });

  return out;
}

function buildIconVisualPayload(supabase: any, bucket: string, dbRow: StreakIconAssetRow): IconVisualPayload {
  const cacheTag = buildCacheTagFromRow(dbRow);
  const candidatePaths = buildIconCandidatePaths(dbRow);

  const candidatePublicUrls = dedupeStrings(
    candidatePaths.map((p) => {
      const raw = supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl || null;
      return appendCacheTag(raw, cacheTag);
    })
  );

  const preferredPath = toTrimmedStringOrNull(dbRow.webp_path) || toTrimmedStringOrNull(dbRow.png_path) || candidatePaths[0] || null;
  const rawPublicUrl = preferredPath
    ? supabase.storage.from(bucket).getPublicUrl(preferredPath.replace(/^\/+/, "")).data.publicUrl || null
    : null;

  const publicUrl = appendCacheTag(rawPublicUrl, cacheTag);

  const unlockAt = getDbUnlockAtForIcon(dbRow);

  return {
    code: dbRow.code,
    unlockAt,

    tierCode: toTrimmedStringOrNull(dbRow.tier_code) || "none",
    label: toTrimmedStringOrNull(dbRow.label) || dbRow.code,
    emojiFallback: toTrimmedStringOrNull(dbRow.emoji_fallback) || "🎖️",

    webpPath: toTrimmedStringOrNull(dbRow.webp_path),
    pngPath: toTrimmedStringOrNull(dbRow.png_path),

    bucket,
    candidatePaths,
    candidatePublicUrls,
    publicUrl,

    cacheTag,
    dbUpdatedAt: toTrimmedStringOrNull(dbRow.updated_at),
    sortOrder: toInt(dbRow.sort_order, 0),
  };
}

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const bucket = process.env.NEXT_PUBLIC_STREAK_ICONS_BUCKET || STREAK_ICONS_BUCKET_DEFAULT;

  // 1) Snapshot streak
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_streak_snapshot");
  if (rpcErr) return fail(rpcErr.message, 500, "STREAK_SNAPSHOT_FAILED");

  const normalizedSnapshot = normalizeRpcStreakSnapshot((rpcData ?? null) as Record<string, any> | null);
  const streak = toCompatStreakSnapshotPayload(normalizedSnapshot);

  const longestForUnlocks = Math.max(normalizedSnapshot.longestStreak, normalizedSnapshot.displayLongestStreak);

  // 2) Параллельно: профиль, ассеты, каталог титулов
  const [profileRes, assetsRes, titlesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, selected_streak_icon_code, selected_streak_title_code")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("streak_icon_assets")
      .select("code,label,tier_code,webp_path,png_path,emoji_fallback,version,is_active,is_default_for_tier,sort_order,meta,updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),

    supabase
      .from("streak_title_catalog")
      .select("code,label,unlock_at,description,is_active,sort_order,version,meta")
      .eq("is_active", true)
      .order("unlock_at", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
  ]);

  if (profileRes.error) return fail(profileRes.error.message, 500, "PROFILE_FETCH_FAILED");
  if (assetsRes.error) return fail(assetsRes.error.message, 500, "ICON_ASSETS_FETCH_FAILED");
  if (titlesRes.error) return fail(titlesRes.error.message, 500, "TITLE_CATALOG_FETCH_FAILED");

  const activeAssetRows = ((assetsRes.data ?? []) as StreakIconAssetRow[])
    .filter((r) => r?.code && r.is_active)
    // ❗ если unlockAt не задан — не показываем такую иконку, чтобы не было “призраков”
    .filter((r) => getDbUnlockAtForIcon(r) > 0);

  // ------------------ ICONS (100% DB-driven) ------------------
  const iconCatalog = activeAssetRows
    .map((row) => buildIconVisualPayload(supabase, bucket, row))
    .sort((a, b) => {
      if (a.unlockAt !== b.unlockAt) return a.unlockAt - b.unlockAt;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.label.localeCompare(b.label, "ru");
    });

  const iconByCode = Object.fromEntries(iconCatalog.map((i) => [i.code, i])) as Record<string, IconVisualPayload>;

  const unlockedIconCodes = iconCatalog.filter((i) => i.unlockAt <= longestForUnlocks).map((i) => i.code);

  const profileSelectedDbCode =
    typeof profileRes.data?.selected_streak_icon_code === "string" ? profileRes.data.selected_streak_icon_code : null;

  const selectedIconCode =
    profileSelectedDbCode && unlockedIconCodes.includes(profileSelectedDbCode) ? profileSelectedDbCode : null;

  const effectiveIconCode = selectedIconCode ?? (unlockedIconCodes.length ? unlockedIconCodes[unlockedIconCodes.length - 1] : null);

  const selectedIcon = selectedIconCode ? iconByCode[selectedIconCode] ?? null : null;
  const effectiveIcon = effectiveIconCode ? iconByCode[effectiveIconCode] ?? null : null;

  // ------------------ TITLES (как было, DB-first) ------------------
  const titleCatalog = normalizeTitleCatalogRows((titlesRes.data ?? []) as StreakTitleCatalogRow[]);

  const profileSelectedTitleCode =
    typeof profileRes.data?.selected_streak_title_code === "string" ? profileRes.data.selected_streak_title_code : null;

  const unlockedTitles = titleCatalog.filter((t) => t.unlockAt <= longestForUnlocks);
  const lockedTitles = titleCatalog.filter((t) => t.unlockAt > longestForUnlocks);
  const unlockedTitleCodes = unlockedTitles.map((t) => t.code);

  const selectedTitleRaw = profileSelectedTitleCode ? titleCatalog.find((t) => t.code === profileSelectedTitleCode) ?? null : null;
  const selectedTitle = selectedTitleRaw && selectedTitleRaw.unlockAt <= longestForUnlocks ? selectedTitleRaw : null;
  const effectiveTitle = selectedTitle ?? (unlockedTitles[unlockedTitles.length - 1] ?? null);

  const equippedTitle = selectedTitle
    ? {
        titleCode: selectedTitle.code,
        label: selectedTitle.label,
        unlockedAt: selectedTitle.unlockAt,
        sourceValue: selectedTitle.unlockAt,
      }
    : null;

  const payload = {
    streak,
    equippedTitle,
    longestForUnlocks,

    // ICONS
    iconCatalog,
    unlockedIconCodes,
    selectedIconCode,
    selectedIconDbCode: profileSelectedDbCode, // оставили поле, но оно теперь = DB code
    effectiveIconCode,
    selectedIcon,
    effectiveIcon,
    unlockedIcons: unlockedIconCodes.map((c) => iconByCode[c]).filter(Boolean),
    bucket,
    appliedIconCode: (selectedIconCode ?? effectiveIconCode) ?? null,
    appliedIcon: selectedIcon ?? effectiveIcon ?? null,

    // TITLES
    titleCatalog,
    unlockedTitles,
    lockedTitles,
    unlockedTitleCodes,

    selectedTitleCode: selectedTitle?.code ?? null,
    selectedTitleDbCode: profileSelectedTitleCode ?? null,
    effectiveTitleCode: effectiveTitle?.code ?? null,
    selectedTitle,
    effectiveTitle,
    appliedTitleCode: selectedTitle?.code ?? effectiveTitle?.code ?? null,
    appliedTitle: selectedTitle ?? effectiveTitle ?? null,

    serverTs: new Date().toISOString(),
  };

  const res = ok(payload);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}