// app/api/profile-streak/route.ts
import { requireUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/response";
import {
  STREAK_ICONS_BUCKET_DEFAULT,
  buildStreakIconCandidatePaths,
  getIconVariant,
  getResolvedSelectedIconCode,
  getRoadmapCodeFromDbIconAsset,
  getTitleLabelByCode,
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
  code: StreakIconCode; // roadmap code (UI-stable)
  dbCode: string | null; // actual DB code stored in profiles
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

type TitleVisualPayload = {
  code: string;
  label: string;
  unlockAt: number;
  description: string | null;
  sortOrder: number;
  version: string | null;
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

function toInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function normalizeTitleCatalogRows(rows: StreakTitleCatalogRow[] | null | undefined): TitleVisualPayload[] {
  const out: TitleVisualPayload[] = [];
  const seen = new Set<string>();

  for (const row of rows ?? []) {
    const code = toTrimmedStringOrNull(row?.code);
    if (!code || seen.has(code)) continue;

    const unlockAt = toInt(row?.unlock_at, 0);
    if (unlockAt <= 0) continue;

    const label =
      toTrimmedStringOrNull(row?.label) ||
      getTitleLabelByCode(code) ||
      code;

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

  // Предпочитаем реальный path из DB, иначе roadmap fallback
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

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const bucket = process.env.NEXT_PUBLIC_STREAK_ICONS_BUCKET || STREAK_ICONS_BUCKET_DEFAULT;

  // 1) Snapshot streak (источник истины)
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_streak_snapshot");
  if (rpcErr) {
    return fail(rpcErr.message, 500, "STREAK_SNAPSHOT_FAILED");
  }

  const normalizedSnapshot = normalizeRpcStreakSnapshot(
    (rpcData ?? null) as Record<string, any> | null
  );
  const streak = toCompatStreakSnapshotPayload(normalizedSnapshot);

  // Разблокировка по рекорду (перманентно)
  const longestForUnlocks = Math.max(
    normalizedSnapshot.longestStreak,
    normalizedSnapshot.displayLongestStreak
  );

  // 2) Параллельно грузим профиль, ассеты иконок, каталог титулов
  const [profileRes, assetsRes, titlesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, selected_streak_icon_code, selected_streak_title_code")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("streak_icon_assets")
      .select(
        "code,label,tier_code,webp_path,png_path,emoji_fallback,version,is_active,is_default_for_tier,sort_order,meta"
      )
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

  const activeAssetRows = ((assetsRes.data ?? []) as StreakIconAssetRow[]).filter((r) => !!r?.code);
  const titleCatalog = normalizeTitleCatalogRows((titlesRes.data ?? []) as StreakTitleCatalogRow[]);

  const profileSelectedDbCode =
    typeof profileRes.data?.selected_streak_icon_code === "string"
      ? profileRes.data.selected_streak_icon_code
      : null;

  const profileSelectedTitleCode =
    typeof profileRes.data?.selected_streak_title_code === "string"
      ? profileRes.data.selected_streak_title_code
      : null;

  // -----------------------------
  // ИКОНКИ
  // -----------------------------
  const unlockedIconCodes = getUnlockedIconCodesByLongest(longestForUnlocks);

  const selectedAssetRow = profileSelectedDbCode
    ? activeAssetRows.find((r) => r.code === profileSelectedDbCode) ?? null
    : null;

  const selectedIconCodeRaw =
    (selectedAssetRow ? getRoadmapCodeFromDbIconAsset(selectedAssetRow) : null) ||
    normalizeIconCode(profileSelectedDbCode);

  // Если иконка в профиле больше невалидна/неразблокирована — в UI не считаем её выбранной
  const selectedIconCode =
    selectedIconCodeRaw && unlockedIconCodes.includes(selectedIconCodeRaw)
      ? selectedIconCodeRaw
      : null;

  const effectiveIconCode = getResolvedSelectedIconCode(selectedIconCode, longestForUnlocks);

  const unlockedIcons: IconVisualPayload[] = unlockedIconCodes
    .map((roadmapCode) => {
      try {
        const dbRow = pickBestDbAssetForRoadmapCode(activeAssetRows, roadmapCode) ?? null;
        return buildIconVisualPayload(supabase, roadmapCode, bucket, dbRow);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as IconVisualPayload[];

  const iconByCode = Object.fromEntries(unlockedIcons.map((i) => [i.code, i]));
  const selectedIcon = selectedIconCode ? (iconByCode[selectedIconCode] ?? null) : null;
  const effectiveIcon = effectiveIconCode ? (iconByCode[effectiveIconCode] ?? null) : null;

  // -----------------------------
  // ТИТУЛЫ (новая схема: catalog + profiles.selected_streak_title_code)
  // -----------------------------
  const unlockedTitles = titleCatalog.filter((t) => t.unlockAt <= longestForUnlocks);
  const lockedTitles = titleCatalog.filter((t) => t.unlockAt > longestForUnlocks);

  const unlockedTitleCodes = unlockedTitles.map((t) => t.code);

  const selectedTitleRaw = profileSelectedTitleCode
    ? titleCatalog.find((t) => t.code === profileSelectedTitleCode) ?? null
    : null;

  // если титул выбран в профиле, но недоступен по рекорду / выключен — не считаем выбранным
  const selectedTitle =
    selectedTitleRaw && selectedTitleRaw.unlockAt <= longestForUnlocks
      ? selectedTitleRaw
      : null;

  // Фолбэк только для отображения (DB не трогаем)
  const effectiveTitle = selectedTitle ?? (unlockedTitles[unlockedTitles.length - 1] ?? null);

  // Совместимость со старым UI-полем
  // Важно: "equippedTitle" = реально выбранный (если есть), а не фолбэк
  const equippedTitle = selectedTitle
    ? {
        titleCode: selectedTitle.code,
        label: selectedTitle.label,
        unlockedAt: selectedTitle.unlockAt,
        sourceValue: selectedTitle.unlockAt,
      }
    : null;

  return ok({
    streak,

    // старое поле (оставляем, чтобы ничего не сломать)
    equippedTitle,

    // unlock info
    longestForUnlocks,

    // ---------------- ИКОНКИ ----------------
    unlockedIconCodes,
    selectedIconCode: selectedIconCode ?? null, // roadmap code (UI)
    selectedIconDbCode: profileSelectedDbCode,  // реальный код в profiles
    effectiveIconCode: effectiveIconCode ?? null,
    selectedIcon,
    effectiveIcon,
    unlockedIcons,
    bucket,
    appliedIconCode: (selectedIconCode ?? effectiveIconCode) ?? null,
    appliedIcon: selectedIcon ?? effectiveIcon ?? null,

    // ---------------- ТИТУЛЫ ----------------
    titleCatalog, // весь активный каталог (для UI без деплоя)
    unlockedTitles,
    lockedTitles,
    unlockedTitleCodes,

    selectedTitleCode: selectedTitle?.code ?? null,         // валидный выбранный
    selectedTitleDbCode: profileSelectedTitleCode ?? null,  // что лежит в profiles
    effectiveTitleCode: effectiveTitle?.code ?? null,       // фолбэк для отображения
    selectedTitle,
    effectiveTitle,
    appliedTitleCode: selectedTitle?.code ?? effectiveTitle?.code ?? null,
    appliedTitle: selectedTitle ?? effectiveTitle ?? null,

    // timestamp (помогает клиенту отсеивать устаревшие ответы)
    serverTs: new Date().toISOString(),
  });
}