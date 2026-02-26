// app/api/profile-streak-icon/route.ts
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
  sort_order?: number | null;
  meta?: Record<string, any> | null;
  updated_at?: string | null;
};

type IconVisualPayload = {
  code: string; // ✅ DB code
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

type Body = {
  iconCode?: string | null; // ✅ ожидаем DB code (gold-1, diamond-1, ...)
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

  return {
    code: dbRow.code,
    unlockAt: getDbUnlockAtForIcon(dbRow),

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

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const bucket = process.env.NEXT_PUBLIC_STREAK_ICONS_BUCKET || STREAK_ICONS_BUCKET_DEFAULT;

  const requestedCode = toTrimmedStringOrNull(body.iconCode);

  // 1) Snapshot + активные ассеты (параллельно)
  const [rpcRes, assetsRes] = await Promise.all([
    supabase.rpc("get_my_streak_snapshot"),
    supabase
      .from("streak_icon_assets")
      .select("code,label,tier_code,webp_path,png_path,emoji_fallback,version,is_active,sort_order,meta,updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
  ]);

  if (rpcRes.error) return fail(rpcRes.error.message, 500, "STREAK_SNAPSHOT_FAILED");
  if (assetsRes.error) return fail(assetsRes.error.message, 500, "ICON_ASSETS_FETCH_FAILED");

  const normalizedSnapshot = normalizeRpcStreakSnapshot((rpcRes.data ?? null) as Record<string, any> | null);
  const streak = toCompatStreakSnapshotPayload(normalizedSnapshot);
  const longestForUnlocks = Math.max(normalizedSnapshot.longestStreak, normalizedSnapshot.displayLongestStreak);

  const activeRows = ((assetsRes.data ?? []) as StreakIconAssetRow[])
    .filter((r) => r?.code && r.is_active)
    .filter((r) => getDbUnlockAtForIcon(r) > 0);

  const iconCatalog = activeRows
    .map((r) => buildIconVisualPayload(supabase, bucket, r))
    .sort((a, b) => {
      if (a.unlockAt !== b.unlockAt) return a.unlockAt - b.unlockAt;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.label.localeCompare(b.label, "ru");
    });

  const iconByCode = Object.fromEntries(iconCatalog.map((i) => [i.code, i])) as Record<string, IconVisualPayload>;

  const unlockedIconCodes = iconCatalog.filter((i) => i.unlockAt <= longestForUnlocks).map((i) => i.code);

  const resolveEffective = (selected: string | null) =>
    selected && unlockedIconCodes.includes(selected)
      ? selected
      : (unlockedIconCodes.length ? unlockedIconCodes[unlockedIconCodes.length - 1] : null);

  // 2) Reset (auto-select)
  if (!requestedCode) {
    const { data: updatedProfile, error: updErr } = await supabase
      .from("profiles")
      .update({ selected_streak_icon_code: null })
      .eq("id", user.id)
      .select("id, selected_streak_icon_code")
      .single();

    if (updErr) return fail(updErr.message, 500, "PROFILE_ICON_RESET_FAILED");
    if (!updatedProfile || updatedProfile.id !== user.id) {
      return fail("Profile row was not updated", 500, "PROFILE_ICON_RESET_NOT_APPLIED");
    }

    const effectiveIconCode = resolveEffective(null);
    const effectiveIcon = effectiveIconCode ? iconByCode[effectiveIconCode] ?? null : null;

    const res = ok({
      saved: true,
      reset: true,

      streak,
      longestForUnlocks,

      iconCatalog,
      unlockedIconCodes,

      selectedIconCode: null,
      selectedIconDbCode: null,
      selectedIcon: null,

      effectiveIconCode: effectiveIconCode ?? null,
      effectiveIconDbCode: effectiveIconCode ?? null,
      effectiveIcon,

      appliedIconCode: effectiveIconCode ?? null,
      appliedIcon: effectiveIcon ?? null,

      bucket,
      serverTs: new Date().toISOString(),
    });

    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  }

  // 3) Validate выбранной иконки: должна существовать и быть активной
  const row = activeRows.find((r) => r.code === requestedCode) ?? null;
  if (!row) return fail("Иконка не найдена или отключена (is_active=false)", 404, "ICON_NOT_FOUND");

  const unlockAt = getDbUnlockAtForIcon(row);
  if (unlockAt <= 0) return fail("У иконки не указан meta.unlock_at", 400, "ICON_BAD_UNLOCK_AT");
  if (unlockAt > longestForUnlocks) return fail("Icon is not unlocked yet", 403, "ICON_NOT_UNLOCKED");

  // 4) Save exactly DB code
  const { data: updatedProfile, error: updErr } = await supabase
    .from("profiles")
    .update({ selected_streak_icon_code: row.code })
    .eq("id", user.id)
    .select("id, selected_streak_icon_code")
    .single();

  if (updErr) return fail(updErr.message, 500, "PROFILE_ICON_SAVE_FAILED");
  if (!updatedProfile || updatedProfile.id !== user.id) {
    return fail("Profile row was not updated", 500, "PROFILE_ICON_SAVE_NOT_APPLIED");
  }

  const savedDbCode =
    typeof updatedProfile.selected_streak_icon_code === "string" ? updatedProfile.selected_streak_icon_code : row.code;

  const selectedIcon = iconByCode[savedDbCode] ?? buildIconVisualPayload(supabase, bucket, row);

  const effectiveIconCode = resolveEffective(savedDbCode);
  const effectiveIcon = effectiveIconCode ? iconByCode[effectiveIconCode] ?? null : null;

  const res = ok({
    saved: true,
    reset: false,

    streak,
    longestForUnlocks,

    iconCatalog,
    unlockedIconCodes,

    selectedIconCode: savedDbCode,
    selectedIconDbCode: savedDbCode,
    selectedIcon,

    effectiveIconCode: effectiveIconCode ?? null,
    effectiveIconDbCode: effectiveIconCode ?? null,
    effectiveIcon,

    appliedIconCode: savedDbCode,
    appliedIcon: selectedIcon,

    bucket,
    serverTs: new Date().toISOString(),
  });

  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}