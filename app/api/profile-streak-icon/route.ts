// app/api/profile-streak-icon/route.ts
import { requireUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/response";
import {
  STREAK_ICONS_BUCKET_DEFAULT,
  buildStreakIconCandidatePaths,
  getIconVariant,
  getResolvedSelectedIconCode,
  getRoadmapCodeFromDbIconAsset,
  getUnlockedIconCodesByLongest,
  normalizeIconCode,
  normalizeRpcStreakSnapshot,
  pickBestDbAssetForRoadmapCode,
  toCompatStreakSnapshotPayload,
  type StreakIconCode,
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
};

type IconVisualPayload = {
  code: StreakIconCode; // roadmap code
  dbCode: string | null; // actual DB code
  unlockAt: number;
  tierCode: string;
  shortLabel: string;
  fullLabel: string;
  label: string;
  emoji: string;
  emojiFallback: string;
  webpPath: string | null;
  pngPath: string | null;
  bucket: string;
  candidatePaths: string[];
  candidatePublicUrls: string[];
  publicUrl: string | null;
};

type Body = {
  iconCode?: string | null; // roadmap code / db code / alias / path
};

function dedupeStrings(items: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item) continue;
    const v = item.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function toTrimmedStringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function buildIconVisualPayload(
  supabase: any,
  roadmapCode: StreakIconCode,
  bucket: string,
  dbRow: StreakIconAssetRow | null
): IconVisualPayload {
  const variant = getIconVariant(roadmapCode);
  if (!variant) {
    throw new Error(`Unknown roadmap icon code: ${roadmapCode}`);
  }

  const dbWebp = toTrimmedStringOrNull(dbRow?.webp_path);
  const dbPng = toTrimmedStringOrNull(dbRow?.png_path);

  const candidatePaths = dedupeStrings(buildStreakIconCandidatePaths(roadmapCode, dbRow));
  const candidatePublicUrls = dedupeStrings(
    candidatePaths.map((p) => supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl)
  );

  const preferredPath = dbWebp || dbPng || variant.webpPath || variant.pngPath || null;
  const publicUrl = preferredPath
    ? supabase.storage.from(bucket).getPublicUrl(preferredPath).data.publicUrl || null
    : null;

  return {
    code: roadmapCode,
    dbCode: dbRow?.code ?? null,
    unlockAt: variant.unlockAt,
    tierCode: variant.tierCode,
    shortLabel: variant.shortLabel,
    fullLabel: variant.fullLabel,
    label: toTrimmedStringOrNull(dbRow?.label) || variant.fullLabel,
    emoji: variant.emoji,
    emojiFallback: toTrimmedStringOrNull(dbRow?.emoji_fallback) || variant.emoji,
    webpPath: dbWebp || variant.webpPath || null,
    pngPath: dbPng || variant.pngPath || null,
    bucket,
    candidatePaths,
    candidatePublicUrls,
    publicUrl,
  };
}

async function getActiveIconAssets(supabase: any) {
  const { data, error } = await supabase
    .from("streak_icon_assets")
    .select(
      "code,label,tier_code,webp_path,png_path,emoji_fallback,version,is_active,is_default_for_tier,sort_order,meta"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (error) return { rows: null as StreakIconAssetRow[] | null, error };
  const rows = ((data ?? []) as StreakIconAssetRow[]).filter((r) => !!r?.code);
  return { rows, error: null as any };
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // поддержим пустое тело как "сброс"
    body = {};
  }

  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const bucket = process.env.NEXT_PUBLIC_STREAK_ICONS_BUCKET || STREAK_ICONS_BUCKET_DEFAULT;

  // 1) Snapshot + активные ассеты (параллельно)
  const [rpcRes, assetsRes] = await Promise.all([
    supabase.rpc("get_my_streak_snapshot"),
    getActiveIconAssets(supabase),
  ]);

  if (rpcRes.error) {
    return fail(rpcRes.error.message, 500, "STREAK_SNAPSHOT_FAILED");
  }
  if (assetsRes.error) {
    return fail(assetsRes.error.message, 500, "ICON_ASSETS_FETCH_FAILED");
  }

  const normalizedSnapshot = normalizeRpcStreakSnapshot((rpcRes.data ?? null) as Record<string, any> | null);
  const streak = toCompatStreakSnapshotPayload(normalizedSnapshot);

  const longestForUnlocks = Math.max(
    normalizedSnapshot.longestStreak,
    normalizedSnapshot.displayLongestStreak
  );
  const unlockedIconCodes = getUnlockedIconCodesByLongest(longestForUnlocks);

  const activeAssetRows = assetsRes.rows ?? [];

  // 2) Нормализуем вход
  const rawInput =
    typeof body.iconCode === "string" ? body.iconCode.trim() : body.iconCode;

  // 3) Сброс на авто-подбор
  if (rawInput == null || rawInput === "") {
    const { data: updatedProfile, error: updErr } = await supabase
      .from("profiles")
      .update({ selected_streak_icon_code: null })
      .eq("id", user.id)
      .select("id, selected_streak_icon_code")
      .single();

    if (updErr) {
      return fail(updErr.message, 500, "PROFILE_ICON_RESET_FAILED");
    }

    if (!updatedProfile || updatedProfile.id !== user.id) {
      return fail("Profile row was not updated", 500, "PROFILE_ICON_RESET_NOT_APPLIED");
    }

    const effectiveIconCode = getResolvedSelectedIconCode(null, longestForUnlocks);
    const effectiveRow = effectiveIconCode
      ? pickBestDbAssetForRoadmapCode(activeAssetRows, effectiveIconCode)
      : null;
    const effectiveIcon = effectiveIconCode
      ? buildIconVisualPayload(supabase, effectiveIconCode, bucket, effectiveRow)
      : null;

    return ok({
      saved: true,
      reset: true,

      streak,
      longestForUnlocks,
      unlockedIconCodes,

      selectedIconCode: null,
      selectedIconDbCode: null,
      selectedIcon: null,

      effectiveIconCode: effectiveIconCode ?? null,
      effectiveIconDbCode: effectiveRow?.code ?? null,
      effectiveIcon,

      appliedIconCode: effectiveIconCode ?? null,
      appliedIcon: effectiveIcon ?? null,

      bucket,
      serverTs: new Date().toISOString(),
    });
  }

  // 4) Что прислал UI (roadmap/db/path/legacy) -> roadmap code
  const normalizedRoadmapCode = normalizeIconCode(rawInput);
  if (!normalizedRoadmapCode) {
    return fail("Unknown icon code", 400, "UNKNOWN_ICON_CODE");
  }

  // 5) Проверяем разблокировку
  if (!unlockedIconCodes.includes(normalizedRoadmapCode)) {
    return fail("Icon is not unlocked yet", 403, "ICON_NOT_UNLOCKED");
  }

  // 6) Подбираем реальный DB row для сохранения (приоритет — exact input code -> best match by roadmap)
  let chosenRow =
    activeAssetRows.find((r) => r.code === rawInput) ??
    pickBestDbAssetForRoadmapCode(activeAssetRows, normalizedRoadmapCode) ??
    activeAssetRows.find((r) => getRoadmapCodeFromDbIconAsset(r) === normalizedRoadmapCode) ??
    null;

  if (!chosenRow) {
    return fail(
      "No active DB asset row found for selected icon. Check streak_icon_assets seed.",
      409,
      "ICON_ASSET_NOT_FOUND"
    );
  }

  // 7) Сохраняем именно DB code в profiles и СРАЗУ подтверждаем чтением
  const { data: updatedProfile, error: updErr } = await supabase
    .from("profiles")
    .update({ selected_streak_icon_code: chosenRow.code })
    .eq("id", user.id)
    .select("id, selected_streak_icon_code")
    .single();

  if (updErr) {
    return fail(updErr.message, 500, "PROFILE_ICON_SAVE_FAILED");
  }

  if (!updatedProfile || updatedProfile.id !== user.id) {
    return fail("Profile row was not updated", 500, "PROFILE_ICON_SAVE_NOT_APPLIED");
  }

  const savedDbCode =
    typeof updatedProfile.selected_streak_icon_code === "string"
      ? updatedProfile.selected_streak_icon_code
      : null;

  // Привязываем уже к реально сохранённому DB code (на случай триггеров/нормализации)
  const savedRow =
    (savedDbCode ? activeAssetRows.find((r) => r.code === savedDbCode) : null) ?? chosenRow;

  const savedRoadmapCode =
    (savedRow ? getRoadmapCodeFromDbIconAsset(savedRow) : null) ||
    normalizeIconCode(savedDbCode) ||
    normalizedRoadmapCode;

  if (!savedRoadmapCode) {
    return fail("Saved icon code cannot be resolved", 500, "SAVED_ICON_RESOLVE_FAILED");
  }

  // 8) Возвращаем актуальное состояние для UI (чтобы можно было применить сразу без лишнего GET)
  const selectedIcon = buildIconVisualPayload(supabase, savedRoadmapCode, bucket, savedRow);

  const effectiveIconCode = getResolvedSelectedIconCode(savedRoadmapCode, longestForUnlocks);
  const effectiveRow = effectiveIconCode
    ? pickBestDbAssetForRoadmapCode(activeAssetRows, effectiveIconCode)
    : null;
  const effectiveIcon = effectiveIconCode
    ? buildIconVisualPayload(supabase, effectiveIconCode, bucket, effectiveRow)
    : null;

  return ok({
    saved: true,
    reset: false,

    streak,
    longestForUnlocks,
    unlockedIconCodes,

    // UI-stable code
    selectedIconCode: savedRoadmapCode,
    // exact DB value in profiles
    selectedIconDbCode: savedDbCode ?? savedRow?.code ?? null,
    selectedIcon,

    effectiveIconCode: effectiveIconCode ?? null,
    effectiveIconDbCode: effectiveRow?.code ?? null,
    effectiveIcon,

    // что показывать прямо сейчас
    appliedIconCode: savedRoadmapCode,
    appliedIcon: selectedIcon,

    bucket,
    serverTs: new Date().toISOString(),
  });
}