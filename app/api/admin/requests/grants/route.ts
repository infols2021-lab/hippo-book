// app/api/admin/requests/grants/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- ТИПЫ ДАННЫХ ---
type GrantKind = "textbook" | "crossword" | "mock_test";

type ReqRow = {
  id: string;
  user_id: string;
  project_id?: string | null; 
  branch_type?: string | null; 
  class_level: any;
  target_level: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
  is_processed: boolean | null;
};

type MaterialRow = {
  id: string;
  title: string;
  project_id?: string;
  project_tab_id?: string | null; // 🔥 ИСПРАВЛЕНИЕ: правильная колонка таба
  material_kind?: string | null;
  target_levels: string[] | null;
  class_levels?: string[] | null; // 🔥 ИСПРАВЛЕНИЕ: добавлено для полноты
  project_tabs?: {
    name: string;
    icon?: string;
  };
};

// --- УТИЛИТЫ СТАБИЛЬНОСТИ БД ---
const DB_RETRY_COUNT = 1;
const DB_RETRY_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: any) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("socket") ||
    msg.includes("network") ||
    msg.includes("terminated")
  );
}

async function runDbQuery<T>(factory: () => PromiseLike<{ data: T | null; error: any }>, label: string) {
  let lastError: any = null;

  for (let attempt = 0; attempt <= DB_RETRY_COUNT; attempt += 1) {
    try {
      const res = await factory();
      if (!res.error) return res;

      lastError = res.error;
      if (!isTransientError(res.error) || attempt === DB_RETRY_COUNT) return res;
    } catch (e: any) {
      lastError = e;
      if (!isTransientError(e) || attempt === DB_RETRY_COUNT) throw e;
    }
    await sleep(DB_RETRY_DELAY_MS * (attempt + 1));
  }
  throw new Error(`${label}: ${String(lastError?.message || lastError || "DB error")}`);
}

// --- БАЗОВЫЕ ПОМОЩНИКИ ---
function toArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  return [String(v).trim()].filter(Boolean);
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

// 🔥 ИСПРАВЛЕНИЕ: Строгая нормализация уровней для админки
function normalizeLevelCode(lvl: unknown): string {
  return String(lvl || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, "_");
}

function overlaps(a: string[], b: string[]) {
  const set = new Set(a.map(normalizeLevelCode));
  return b.map(normalizeLevelCode).some((x) => set.has(x));
}

// --- 1. ЗАГРУЗКА ИСТОРИИ (Уже выданные доступы) ---
async function loadGrantHistory(supabase: any, ids: string[]) {
  const map = new Map<string, string[]>();
  ids.forEach((id) => map.set(id, []));

  if (!ids.length) return map;

  const { data, error } = await runDbQuery<any[]>(
    () =>
      supabase
        .from("purchase_request_grants")
        .select("request_id, kind, title")
        .in("request_id", ids),
    "loadGrantHistory",
  );

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const requestId = String(row.request_id || "");
    const kind = String(row.kind || "");
    const title = String(row.title || "");

    if (!requestId || !title) continue;
    
    // Форматирование бейджей
    let label = `🎓 ${title}`;
    if (kind === "textbook") label = `📚 ${title}`;
    if (kind === "crossword") label = `🧩 ${title}`;
    if (kind === "mock_test") label = `📝 ${title}`;

    map.get(requestId)?.push(label);
  }

  for (const [k, v] of map.entries()) map.set(k, uniq(v));
  return map;
}

// --- 2. НОВАЯ ЛОГИКА (АВТОВЫДАЧА ЧЕРЕЗ PROJECTS & TABS) ---
async function loadProjectsFallback(supabase: any, rows: ReqRow[]) {
  const map = new Map<string, string[]>();
  if (!rows.length) return map;

  const projectIds = uniq(rows.map((r) => r.project_id).filter(Boolean));
  if (!projectIds.length) return map;

  // 🔥 ИСПРАВЛЕНИЕ: Тянем project_tab_id и class_levels
  const { data, error } = await runDbQuery<MaterialRow[]>(
    () =>
      supabase
        .from("materials")
        .select(`
          id, title, project_id, project_tab_id, target_levels, class_levels, is_active,
          project_tabs ( name, icon )
        `)
        .in("project_id", projectIds)
        .eq("is_active", true),
    "loadProjectsFallback",
  );

  if (error || !data) return map;

  for (const r of rows) {
    // В заявке может приходить class_level, target_levels или target_level
    const reqLevels = [
      ...toArr(r.class_level), 
      ...toArr(r.target_levels), 
      ...toArr(r.target_level)
    ];
    const reqTabs = toArr(r.material_kinds); 

    const matched = data.filter((m) => {
      if (m.project_id !== r.project_id) return false;

      const mLevels = [...toArr(m.target_levels), ...toArr(m.class_levels)];
      const levelMatches = reqLevels.length === 0 || overlaps(mLevels, reqLevels);
      // 🔥 ИСПРАВЛЕНИЕ: Сравниваем с project_tab_id
      const tabMatches = reqTabs.length === 0 || reqTabs.includes(String(m.project_tab_id));

      return levelMatches && tabMatches;
    });

    const labels = matched.map((m) => {
      const tabName = m.project_tabs?.name || "Материал";
      const icon = m.project_tabs?.icon || "📄";
      return `${icon} [${tabName}] ${m.title}`;
    });

    map.set(r.id, uniq(labels));
  }

  return map;
}

// --- 3. СТАРАЯ ЛОГИКА (ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ДО МИГРАЦИИ) ---
async function loadLegacyGatehouseFallback(supabase: any, rows: ReqRow[]) {
  const map = new Map<string, string[]>();
  if (!rows.length) return map;

  const allKinds = uniq(rows.flatMap((r) => toArr(r.material_kinds).concat(toArr(r.textbook_types))));

  let query = supabase
    .from("materials")
    .select("id, title, material_kind, target_levels")
    .eq("branch_type", "gatehouse")
    .eq("is_active", true);

  if (allKinds.length) query = query.in("material_kind", allKinds);

  const { data, error } = await runDbQuery<MaterialRow[]>(() => query, "loadLegacyFallback");
  if (error || !data) return map;

  for (const r of rows) {
    const reqLevels = [...toArr(r.class_level), ...toArr(r.target_levels), ...toArr(r.target_level)];
    const kinds = toArr(r.material_kinds).concat(toArr(r.textbook_types));

    const matched = data.filter((m) => {
      const mLevels = toArr(m.target_levels);
      const levelMatches = overlaps(mLevels, reqLevels);
      const kindMatches = kinds.length ? kinds.includes(String(m.material_kind)) : true;
      return levelMatches && kindMatches;
    });

    map.set(r.id, uniq(matched.map((m) => `📝 ${m.title}`)));
  }

  return map;
}

// --- ОСНОВНОЙ РОУТ ---
async function safeJson(req: NextRequest) {
  try { return await req.json(); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const body = await safeJson(req);
  if (!body) return fail("Bad JSON", 400, "BAD_JSON");

  const ids = Array.isArray(body?.ids)
    ? body.ids.map(String).map((x: string) => x.trim()).filter(Boolean).slice(0, 30)
    : [];

  if (!ids.length) {
    return ok({ materialsByRequest: {}, materialsError: null });
  }

  try {
    const { data: rowsData, error: rowsError } = await runDbQuery<ReqRow[]>(
      () =>
        supabase
          .from("purchase_requests")
          .select("id, user_id, project_id, branch_type, class_level, target_level, target_levels, textbook_types, material_kinds, is_processed")
          .in("id", ids),
      "loadGrantRows",
    );

    if (rowsError) return fail(rowsError.message, 500, "DB_ERROR");
    const rows = (rowsData ?? []) as ReqRow[];

    // 1. Получаем то, что уже реально выдано в БД
    const historyMap = await loadGrantHistory(supabase, ids);

    // 2. Ищем обработанные заявки, у которых нет истории (нужен fallback)
    const needFallback = rows.filter((r) => {
      const current = historyMap.get(r.id) ?? [];
      return current.length === 0 && Boolean(r.is_processed);
    });

    if (needFallback.length) {
      // Разделяем на заявки новой архитектуры и старой
      const newArchRows = needFallback.filter((r) => !!r.project_id);
      const legacyRows = needFallback.filter((r) => !r.project_id && r.branch_type === "gatehouse");

      // Подтягиваем фоллбэки параллельно
      const [newMap, legacyMap] = await Promise.all([
        loadProjectsFallback(supabase, newArchRows),
        loadLegacyGatehouseFallback(supabase, legacyRows)
      ]);

      // Заполняем историю
      for (const r of newArchRows) {
        const items = newMap.get(r.id) ?? [];
        if (items.length) historyMap.set(r.id, items);
      }
      for (const r of legacyRows) {
        const items = legacyMap.get(r.id) ?? [];
        if (items.length) historyMap.set(r.id, items);
      }
    }

    return ok({
      materialsByRequest: Object.fromEntries(historyMap.entries()),
      materialsError: null,
    });
  } catch (e: any) {
    return ok({
      materialsByRequest: {},
      materialsError: String(e?.message || e || "Materials load error").slice(0, 500),
    });
  }
}