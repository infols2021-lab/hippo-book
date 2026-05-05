// app/api/admin/requests/grants/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BranchType = "olympiad" | "gatehouse";
type GrantKind = "textbook" | "crossword" | "mock_test";

type ReqRow = {
  id: string;
  user_id: string;
  branch_type: string | null;
  target_level: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
  is_processed: boolean | null;
};

type GatehouseMaterialRow = {
  id: string;
  title: string;
  material_kind: string | null;
  target_levels: string[] | null;
};

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

      if (!res.error) {
        return res;
      }

      lastError = res.error;

      if (!isTransientError(res.error) || attempt === DB_RETRY_COUNT) {
        return res;
      }
    } catch (e: any) {
      lastError = e;

      if (!isTransientError(e) || attempt === DB_RETRY_COUNT) {
        throw e;
      }
    }

    await sleep(DB_RETRY_DELAY_MS * (attempt + 1));
  }

  throw new Error(`${label}: ${String(lastError?.message || lastError || "DB error")}`);
}

function toArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  return [String(v).trim()].filter(Boolean);
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function normalizeBranchType(value: unknown): BranchType {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "gatehouse" || v === "ga" || v === "ga_exam" || v === "exam" || v === "gatehouse_awards") {
    return "gatehouse";
  }

  return "olympiad";
}

function normalizeGatehouseLevel(value: unknown) {
  const raw = String(value ?? "").trim();
  const v = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (v === "stage 1" || v === "stage1") return "stage_1";
  if (v === "stage 2" || v === "stage2") return "stage_2";
  if (v === "stage 3" || v === "stage3") return "stage_3";

  if (v === "a1") return "a1";
  if (v === "a2") return "a2";
  if (v === "b1") return "b1";
  if (v === "b2") return "b2";
  if (v === "c1") return "c1";
  if (v === "c2") return "c2";

  return v;
}

function normalizeGatehouseMaterialKind(value: unknown) {
  const v = String(value ?? "").trim().toLowerCase();

  if (
    v === "mock_test" ||
    v === "mock_tests" ||
    v === "mock-test" ||
    v === "mock test" ||
    v === "мок-тест" ||
    v === "мок тест" ||
    v === "пробный тест" ||
    v === "пробные тесты"
  ) {
    return "mock_test";
  }

  return v;
}

function fmtLabel(kind: GrantKind, title: string) {
  if (kind === "textbook") return `📚 ${title}`;
  if (kind === "crossword") return `🧩 ${title}`;
  return `🎓 ${title}`;
}

function overlaps(a: string[], b: string[]) {
  const set = new Set(a.map(String));
  return b.some((x) => set.has(String(x)));
}

function overlapsGatehouseLevels(a: string[], b: string[]) {
  const aa = a.map(normalizeGatehouseLevel).filter(Boolean);
  const bb = b.map(normalizeGatehouseLevel).filter(Boolean);

  return overlaps(aa, bb);
}

function getRequestTargetLevels(r: ReqRow) {
  const targetLevels = toArr(r.target_levels);
  if (targetLevels.length) return targetLevels;
  return toArr(r.target_level);
}

function normalizeGatehouseMaterialKinds(types: any): string[] {
  return uniq(toArr(types).map(normalizeGatehouseMaterialKind).filter(Boolean));
}

function getRequestMaterialKinds(r: ReqRow) {
  const materialKinds = normalizeGatehouseMaterialKinds(r.material_kinds);
  if (materialKinds.length) return materialKinds;
  return normalizeGatehouseMaterialKinds(r.textbook_types);
}

function gatehouseMaterialMatchesRequest(material: GatehouseMaterialRow, r: ReqRow) {
  const targetLevels = getRequestTargetLevels(r);
  const kinds = getRequestMaterialKinds(r);

  if (!targetLevels.length) return false;

  const materialLevels = Array.isArray(material.target_levels) ? material.target_levels.map(String) : [];
  const materialKind = normalizeGatehouseMaterialKind(material.material_kind);

  const levelMatches = overlapsGatehouseLevels(materialLevels, targetLevels);
  const kindMatches = kinds.length ? kinds.includes(materialKind) : true;

  return levelMatches && kindMatches;
}

async function loadGrantHistory(supabase: any, ids: string[]) {
  const map = new Map<string, string[]>();

  ids.forEach((id) => map.set(id, []));

  if (!ids.length) return map;

  const { data, error } = await runDbQuery<any[]>(
    () =>
      supabase
        .from("purchase_request_grants")
        .select("request_id,kind,title")
        .in("request_id", ids),
    "loadGrantHistory",
  );

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const requestId = String(row.request_id || "");
    const kind = String(row.kind || "") as GrantKind;
    const title = String(row.title || "");

    if (!requestId || !title) continue;
    if (kind !== "textbook" && kind !== "crossword" && kind !== "mock_test") continue;

    map.get(requestId)?.push(fmtLabel(kind, title));
  }

  for (const [k, v] of map.entries()) {
    map.set(k, uniq(v));
  }

  return map;
}

async function loadGatehouseFallback(supabase: any, rows: ReqRow[]) {
  const map = new Map<string, string[]>();
  const fallbackRows = rows.filter((r) => normalizeBranchType(r.branch_type) === "gatehouse" && Boolean(r.is_processed));

  fallbackRows.forEach((r) => map.set(r.id, []));

  if (!fallbackRows.length) return map;

  const allKinds = uniq(fallbackRows.flatMap((r) => getRequestMaterialKinds(r)));

  let query = supabase
    .from("materials")
    .select("id,title,material_kind,target_levels")
    .eq("branch_type", "gatehouse")
    .eq("is_active", true);

  if (allKinds.length) {
    query = query.in("material_kind", allKinds);
  }

  const { data, error } = await runDbQuery<GatehouseMaterialRow[]>(
    () => query,
    "loadGatehouseFallback",
  );

  if (error || !data) return map;

  const materials = data;

  for (const r of fallbackRows) {
    const matched = materials.filter((m: GatehouseMaterialRow) => gatehouseMaterialMatchesRequest(m, r));

    map.set(
      r.id,
      uniq(matched.map((m: GatehouseMaterialRow) => fmtLabel("mock_test", String(m.title || "Материал")))),
    );
  }

  return map;
}

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  const body = await safeJson(req);
  if (!body) return fail("Bad JSON", 400, "BAD_JSON");

  const ids = Array.isArray(body?.ids)
    ? body.ids
        .map((x: unknown) => String(x))
        .map((x: string) => x.trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];

  if (!ids.length) {
    return ok({ materialsByRequest: {}, materialsError: null });
  }

  try {
    const { data: rowsData, error: rowsError } = await runDbQuery<ReqRow[]>(
      () =>
        supabase
          .from("purchase_requests")
          .select("id,user_id,branch_type,target_level,target_levels,textbook_types,material_kinds,is_processed")
          .in("id", ids),
      "loadGrantRows",
    );

    if (rowsError) return fail(rowsError.message, 500, "DB_ERROR");

    const rows = (rowsData ?? []) as ReqRow[];

    const historyMap = await loadGrantHistory(supabase, ids);

    const needFallback = rows.filter((r) => {
      const current = historyMap.get(r.id) ?? [];
      return current.length === 0 && normalizeBranchType(r.branch_type) === "gatehouse" && Boolean(r.is_processed);
    });

    if (needFallback.length) {
      const fallbackMap = await loadGatehouseFallback(supabase, needFallback);

      for (const r of needFallback) {
        const items = fallbackMap.get(r.id) ?? [];
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