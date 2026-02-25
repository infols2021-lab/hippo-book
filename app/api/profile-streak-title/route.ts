// app/api/profile-streak-title/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/response";
import { normalizeRpcStreakSnapshot } from "@/lib/streaks/roadmap";

type TitleCatalogRow = {
  code: string;
  label: string | null;
  unlock_at: number | null;
  description: string | null;
  is_active: boolean;
  sort_order?: number | null;
  version?: string | null;
  meta?: Record<string, any> | null;
};

type RequestBody =
  | {
      titleCode?: unknown;
      code?: unknown;
      selectedTitleCode?: unknown;
      reset?: unknown;
      clear?: unknown;
    }
  | null
  | undefined;

function toTrimmedStringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function toNonNegativeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function parseRequestedTitleCode(body: RequestBody): { titleCode: string | null; explicitReset: boolean } {
  const explicitReset = Boolean(body && (body.reset === true || body.clear === true));

  if (!body || typeof body !== "object") {
    return { titleCode: null, explicitReset };
  }

  const raw = body.titleCode ?? body.selectedTitleCode ?? body.code ?? null;
  const titleCode = toTrimmedStringOrNull(raw); // null/"" => сброс
  return { titleCode, explicitReset };
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: RequestBody = null;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    body = null;
  }

  const { titleCode, explicitReset } = parseRequestedTitleCode(body);
  const shouldClear = explicitReset || titleCode === null;

  // 1) Snapshot streak
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_streak_snapshot");
  if (rpcErr) return fail(rpcErr.message, 500, "STREAK_SNAPSHOT_FAILED");

  const normalizedSnapshot = normalizeRpcStreakSnapshot((rpcData ?? null) as Record<string, any> | null);
  const longestForUnlocks = Math.max(
    toNonNegativeInt(normalizedSnapshot.longestStreak, 0),
    toNonNegativeInt(normalizedSnapshot.displayLongestStreak, 0)
  );

  // 2) Clear
  if (shouldClear) {
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ selected_streak_title_code: null })
      .eq("id", user.id);

    if (updateErr) return fail(updateErr.message, 500, "PROFILE_TITLE_CLEAR_FAILED");

    const res = ok({
      cleared: true,
      selectedTitleCode: null,
      selectedTitleDbCode: null,
      longestForUnlocks,
      serverTs: new Date().toISOString(),
    });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  }

  // 3) Fetch title row
  const normalizedCode = titleCode!;

  const { data: titleRow, error: titleErr } = await supabase
    .from("streak_title_catalog")
    .select("code,label,unlock_at,description,is_active,sort_order,version,meta")
    .eq("code", normalizedCode)
    .maybeSingle<TitleCatalogRow>();

  if (titleErr) return fail(titleErr.message, 500, "TITLE_CATALOG_FETCH_FAILED");
  if (!titleRow || !titleRow.code) return fail("Титул не найден в streak_title_catalog", 404, "TITLE_NOT_FOUND");
  if (!titleRow.is_active) return fail("Титул отключён и недоступен для выбора", 400, "TITLE_INACTIVE");

  const unlockAt = toNonNegativeInt(titleRow.unlock_at, 0);
  if (unlockAt <= 0) return fail("У титула не указан корректный unlock_at", 400, "TITLE_BAD_UNLOCK_AT");
  if (unlockAt > longestForUnlocks) {
    return fail(
      `Титул ещё не разблокирован. Нужно ${unlockAt} дн., доступно по рекорду: ${longestForUnlocks} дн.`,
      403,
      "TITLE_LOCKED"
    );
  }

  // 4) Save in profiles
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ selected_streak_title_code: titleRow.code })
    .eq("id", user.id);

  if (updateErr) return fail(updateErr.message, 500, "PROFILE_TITLE_SAVE_FAILED");

  const res = ok({
    cleared: false,
    selectedTitleDbCode: titleRow.code,
    selectedTitleCode: titleRow.code,
    selectedTitle: {
      code: titleRow.code,
      label: toTrimmedStringOrNull(titleRow.label) || titleRow.code,
      unlockAt,
      description: toTrimmedStringOrNull(titleRow.description),
    },
    longestForUnlocks,
    serverTs: new Date().toISOString(),
  });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}