/* app/api/admin/requests/route.ts */
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { upsertRequestRowByNumber } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BranchType = string;
type GrantKind = "textbook" | "crossword" | "mock_test" | "material";

type ReqRow = {
  id: string;
  user_id: string;
  request_number: string | null;
  created_at: string | null;
  processed_at: string | null;
  is_processed: boolean | null;
  full_name: string | null;
  email: string | null;
  contact_phone?: string | null;
  branch_type: string | null;
  class_level: any;
  target_level: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
  project_id?: string | null;
  projects?: any;
  sheet_name?: string | null; // добавлено для хранения имени листа
};

type GrantTarget = {
  kind: GrantKind;
  item_id: string;
  title: string;
  granted_by?: string;
  material_kind?: string | null;
  target_levels?: string[] | null;
};

type GatehouseMaterialRow = {
  id: string;
  title: string;
  material_kind: string | null;
  target_levels: string[] | null;
};

const REQUEST_SELECT =
  "id,user_id,request_number,created_at,processed_at,is_processed,full_name,email,contact_phone,branch_type,class_level,target_level,target_levels,textbook_types,material_kinds,project_id,projects(name, sheet_name)";

const DB_RETRY_COUNT = 1;
const DB_RETRY_DELAY_MS = 350;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

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

async function runDbQuery<T>(
  factory: () => PromiseLike<{ data: T | null; error: any }>,
  label: string,
) {
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

function normalizeBranchType(value: unknown): BranchType {
  const v = String(value ?? "").trim().toLowerCase();

  if (!v) return "olympiad";

  if (
    v === "gatehouse" ||
    v === "ga" ||
    v === "ga_exam" ||
    v === "exam" ||
    v === "exams" ||
    v === "gatehouse_awards"
  ) {
    return "gatehouse";
  }

  return v;
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function toArr(v: any): string[] {
  if (!v) return [];

  if (Array.isArray(v)) {
    return v.map(String).map((x) => x.trim()).filter(Boolean);
  }

  if (typeof v === "string") {
    const text = v.trim();

    if (!text) return [];

    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        return toArr(JSON.parse(text));
      } catch {
        return [];
      }
    }

    return text
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [String(v).trim()].filter(Boolean);
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatBranchLabel(branchType: BranchType) {
  if (branchType === "gatehouse") return "🎓 Gatehouse Awards";
  if (branchType === "olympiad") return "🏆 Олимпиада";
  return `📁 ${branchType.charAt(0).toUpperCase() + branchType.slice(1)}`;
}

function formatClassLevel(classLevel: string) {
  const classMap: Record<string, string> = {
    "1-2": "1-2 класс",
    "3-4": "3-4 класс",
    "5-6": "5-6 класс",
    "7": "7 класс",
    "8-9": "8-9 класс",
    "10-11": "10-11 класс (Техникум, колледж - 1й курс)",
    "12": "12 класс (Техникум, колледж)",
  };

  return classMap[classLevel] || classLevel;
}

function normalizeGatehouseLevel(value: unknown) {
  const raw = norm(value);
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

  return v || raw;
}

function formatGatehouseLevel(value: unknown) {
  const v = normalizeGatehouseLevel(value);

  const map: Record<string, string> = {
    stage_1: "Stage 1",
    stage_2: "Stage 2",
    stage_3: "Stage 3",
    a1: "A1",
    a2: "A2",
    b1: "B1",
    b2: "B2",
    c1: "C1",
    c2: "C2",
  };

  return map[v] || norm(value) || v;
}

function normalizeGatehouseMaterialKind(value: unknown) {
  const v = norm(value).toLowerCase();

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

function formatTarget(branchType: BranchType, classLevel: any, targetLevel: any) {
  if (branchType === "gatehouse") {
    const levels = toArr(targetLevel);
    return levels.length ? levels.map(formatGatehouseLevel).join(", ") : "—";
  }

  const levels = toArr(targetLevel);
  if (levels.length > 0 && !classLevel) {
    return levels.join(", ");
  }

  const classes = toArr(classLevel);
  if (!classes.length) return "—";

  return classes.map(formatClassLevel).join(", ");
}

function formatMaterialTypes(branchType: BranchType, types: any) {
  const arr = toArr(types);

  if (branchType === "gatehouse") {
    const typeMap: Record<string, string> = {
      mock_test: "📝 Пробные тесты",
      mock_tests: "📝 Пробные тесты",
      "mock-test": "📝 Пробные тесты",
      "mock test": "📝 Пробные тесты",
      "мок-тест": "📝 Пробные тесты",
      "мок тест": "📝 Пробные тесты",
      "пробный тест": "📝 Пробные тесты",
      "пробные тесты": "📝 Пробные тесты",
    };

    return arr.map((t) => typeMap[String(t).toLowerCase()] || String(t)).join(", ");
  }

  const typeMap: Record<string, string> = {
    учебник: "📚 Учебник",
    кроссворд: "🧩 Кроссворд",
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
  };

  return arr.map((t) => typeMap[String(t).toLowerCase()] || String(t)).join(", ");
}

function formatDateTimeRU(dateString: string) {
  const d = new Date(dateString);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(isProcessed: boolean, processedAt?: string | null) {
  if (!isProcessed) return "⏳ Ожидает";
  if (processedAt) return `✅ Обработана · ${formatDateTimeRU(processedAt)}`;
  return "✅ Обработана";
}

function getSheetTargetSource(row: any, branchType: BranchType) {
  if (branchType !== "gatehouse" && row.class_level) return row.class_level;

  const targetLevels = toArr(row.target_levels);
  if (targetLevels.length) return targetLevels;

  return row.target_level;
}

function getSheetMaterialTypesSource(row: any, branchType: BranchType) {
  if (branchType !== "gatehouse" && row.textbook_types?.length) return row.textbook_types;

  const materialKinds = toArr(row.material_kinds);
  if (materialKinds.length) return materialKinds;

  return row.textbook_types;
}

function buildSheetValues(row: any) {
  const branchType = normalizeBranchType(row.branch_type);

  return [
    String(row.request_number || ""),
    formatDateTimeRU(String(row.created_at || "")),
    formatTarget(branchType, row.class_level, getSheetTargetSource(row, branchType)),
    formatMaterialTypes(branchType, getSheetMaterialTypesSource(row, branchType)),
    String(row.email || ""),
    String(row.full_name || ""),
    formatStatus(Boolean(row.is_processed), row.processed_at ?? null),
  ];
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

function gatehouseMaterialMatchesRequest(material: GatehouseMaterialRow, r: ReqRow) {
  const targetLevels = getRequestTargetLevels(r);
  const kinds = getRequestMaterialKinds(r);

  if (!targetLevels.length) return false;

  const materialLevels = Array.isArray(material.target_levels)
    ? material.target_levels.map(String)
    : [];

  const materialKind = normalizeGatehouseMaterialKind(material.material_kind);

  const levelMatches = overlapsGatehouseLevels(materialLevels, targetLevels);
  const kindMatches = kinds.length ? kinds.includes(materialKind) : true;

  return levelMatches && kindMatches;
}

async function findGatehouseMaterialsForRequest(supabase: any, r: ReqRow) {
  const targetLevels = getRequestTargetLevels(r).map(normalizeGatehouseLevel).filter(Boolean);
  const kinds = getRequestMaterialKinds(r);

  if (!targetLevels.length) return [];

  const { data, error } = await runDbQuery<GatehouseMaterialRow[]>(
    () => {
      let q = supabase
        .from("materials")
        .select("id,title,material_kind,target_levels")
        .eq("branch_type", "gatehouse")
        .eq("is_active", true)
        .overlaps("target_levels", targetLevels);

      if (kinds.length) {
        q = q.in("material_kind", kinds);
      }

      return q;
    },
    "findGatehouseMaterialsForRequest",
  );

  if (error) throw new Error(error.message);

  const materials = (data ?? []) as GatehouseMaterialRow[];

  return materials.filter((m) => gatehouseMaterialMatchesRequest(m, r));
}

// 🚀 УМНАЯ СИСТЕМА ВЫДАЧИ ДИНАМИЧЕСКИХ ДОСТУПОВ (ИСПРАВЛЕНА ПОД НОВУЮ БД И ПРОЕКТЫ)
async function grantDynamicProjectAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: any[] = [];

  const targetLevels = toArr(r.class_level).length ? toArr(r.class_level) : toArr(r.target_levels);
  const requestedTabs = toArr(r.material_kinds).length ? toArr(r.material_kinds) : toArr(r.textbook_types);

  const { data: tabsRes } = await runDbQuery<any[]>(
    () => supabase.from("project_tabs").select("id, title").eq("project_id", r.project_id).eq("is_active", true),
    "fetchTabsForGrant"
  );

  let tabIdsToQuery: string[] = [];

  if (requestedTabs.length > 0) {
    for (const reqTab of requestedTabs) {
      const matched = (tabsRes ?? []).find((t: any) =>
        t.id === reqTab || String(t.title).toLowerCase() === String(reqTab).toLowerCase()
      );
      if (matched) tabIdsToQuery.push(matched.id);
    }
  } else {
    tabIdsToQuery = (tabsRes ?? []).map((t: any) => t.id);
  }

  if (tabIdsToQuery.length === 0) return { grantedLabels, grantsToStore };

  const { data: materials, error } = await runDbQuery<any[]>(() => supabase
    .from("materials")
    .select("id, title, material_kind, target_levels, class_levels, project_tab_id")
    .in("project_tab_id", tabIdsToQuery)
    .eq("is_active", true),
    "grantDynamicProjectAccess");

  if (error) throw new Error(error.message);

  const userLevels = targetLevels.map(x => String(x).toLowerCase());

  const matchedMaterials = (materials ?? []).filter(mat => {
    if (userLevels.length === 0) return true;

    const matLevels = [...toArr(mat.target_levels), ...toArr(mat.class_levels)].map(x => String(x).toLowerCase());

    if (matLevels.length === 0) return true;

    return matLevels.some(ml => userLevels.some(ul => ml === ul || ml.includes(ul) || ul.includes(ml)));
  });

  for (const mat of matchedMaterials) {
    const up = await supabase.from("material_access").upsert({
      user_id: r.user_id,
      material_id: mat.id,
      granted_by: adminId,
      granted_at: nowISO
    }, { onConflict: "user_id,material_id" });

    if (!up.error) {
      grantedLabels.push(`📘 ${mat.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "material",
        item_id: mat.id,
        title: mat.title,
        granted_by: adminId,
        granted_at: nowISO,
        material_id: mat.id,
        material_kind: mat.material_kind || "material"
      });
    }
  }

  return { grantedLabels, grantsToStore };
}

// 🌐 УНИВЕРСАЛЬНАЯ ВЫДАЧА ДОСТУПОВ (ДЛЯ НОВЫХ ВЕТОК БЕЗ ПРОЕКТА)
async function grantGenericBranchAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: any[] = [];

  const targetLevels = toArr(r.class_level).length ? toArr(r.class_level) : toArr(r.target_levels);
  const kinds = getRequestMaterialKinds(r);

  const { data: materials, error } = await runDbQuery<any[]>(() => {
    let q = supabase
      .from("materials")
      .select("id, title, material_kind, target_levels, class_levels")
      .eq("branch_type", r.branch_type)
      .eq("is_active", true);

    if (kinds.length) {
      q = q.in("material_kind", kinds);
    }
    return q;
  }, "grantGenericBranchAccess");

  if (error) throw new Error(error.message);

  const userLevels = targetLevels.map(x => String(x).toLowerCase());

  const matchedMaterials = (materials ?? []).filter(mat => {
    if (userLevels.length === 0) return true;
    const matLevels = [...toArr(mat.target_levels), ...toArr(mat.class_levels)].map(x => String(x).toLowerCase());
    if (matLevels.length === 0) return true;
    return matLevels.some(ml => userLevels.some(ul => ml === ul || ml.includes(ul) || ul.includes(ml)));
  });

  for (const mat of matchedMaterials) {
    const up = await supabase.from("material_access").upsert({
      user_id: r.user_id,
      material_id: mat.id,
      granted_by: adminId,
      granted_at: nowISO
    }, { onConflict: "user_id,material_id" });

    if (!up.error) {
      grantedLabels.push(`📁 ${mat.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "material",
        item_id: mat.id,
        title: mat.title,
        granted_by: adminId,
        granted_at: nowISO,
        material_id: mat.id,
        branch_type: r.branch_type,
        material_kind: mat.material_kind || "material"
      });
    }
  }

  return { grantedLabels: uniq(grantedLabels), grantsToStore };
}


async function grantOlympiadAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  const classLevels = toArr(r.class_level);
  const types = toArr(r.textbook_types).map((x) => String(x).toLowerCase());

  const nowISO = new Date().toISOString();

  const grantedLabels: string[] = [];
  const grantsToStore: Array<any> = [];

  if (!classLevels.length) return { grantedLabels: [], grantsToStore };

  if (types.includes("учебник") || types.includes("textbook")) {
    const { data: textbooks, error } = await runDbQuery<any[]>(
      () =>
        supabase
          .from("textbooks")
          .select("id,title,class_level,branch_type")
          .eq("is_active", true)
          .or("branch_type.eq.olympiad,branch_type.is.null")
          .overlaps("class_level", classLevels),
      "grantOlympiadTextbooks",
    );

    if (error) throw new Error(error.message);

    for (const tb of textbooks ?? []) {
      const up = await supabase.from("textbook_access").upsert(
        {
          user_id: r.user_id,
          textbook_id: tb.id,
          granted_by: adminId,
          granted_at: nowISO,
        },
        { onConflict: "user_id,textbook_id" },
      );

      if (!up.error) {
        grantedLabels.push(`📚 ${tb.title}`);
        grantsToStore.push({
          request_id: r.id,
          user_id: r.user_id,
          kind: "textbook",
          item_id: tb.id,
          title: tb.title,
          granted_by: adminId,
          granted_at: nowISO,
          branch_type: "olympiad",
          material_id: null,
          material_kind: "textbook",
        });
      }
    }
  }

  if (types.includes("кроссворд") || types.includes("crossword")) {
    const { data: crosswords, error } = await runDbQuery<any[]>(
      () =>
        supabase
          .from("crosswords")
          .select("id,title,class_level,branch_type")
          .eq("is_active", true)
          .or("branch_type.eq.olympiad,branch_type.is.null")
          .overlaps("class_level", classLevels),
      "grantOlympiadCrosswords",
    );

    if (error) throw new Error(error.message);

    for (const cw of crosswords ?? []) {
      const up = await supabase.from("crossword_access").upsert(
        {
          user_id: r.user_id,
          crossword_id: cw.id,
          granted_by: adminId,
          granted_at: nowISO,
        },
        { onConflict: "user_id,crossword_id" },
      );

      if (!up.error) {
        grantedLabels.push(`🧩 ${cw.title}`);
        grantsToStore.push({
          request_id: r.id,
          user_id: r.user_id,
          kind: "crossword",
          item_id: cw.id,
          title: cw.title,
          granted_by: adminId,
          granted_at: nowISO,
          branch_type: "olympiad",
          material_id: null,
          material_kind: "crossword",
        });
      }
    }
  }

  return { grantedLabels: uniq(grantedLabels), grantsToStore };
}

async function grantGatehouseAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  const nowISO = new Date().toISOString();

  const grantedLabels: string[] = [];
  const grantsToStore: Array<any> = [];

  const materials = await findGatehouseMaterialsForRequest(supabase, r);

  for (const material of materials) {
    const up = await supabase.from("material_access").upsert(
      {
        user_id: r.user_id,
        material_id: material.id,
        granted_by: adminId,
        granted_at: nowISO,
      },
      { onConflict: "user_id,material_id" },
    );

    if (!up.error) {
      grantedLabels.push(`🎓 ${material.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "mock_test",
        item_id: material.id,
        title: material.title,
        granted_by: adminId,
        granted_at: nowISO,
        branch_type: "gatehouse",
        material_id: material.id,
        material_kind: normalizeGatehouseMaterialKind(material.material_kind || "mock_test"),
      });
    }
  }

  return { grantedLabels: uniq(grantedLabels), grantsToStore };
}

async function grantAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  if (r.project_id) {
    return grantDynamicProjectAccessForRequest(supabase, adminId, r);
  }

  const branchType = normalizeBranchType(r.branch_type);

  if (branchType === "gatehouse") {
    return grantGatehouseAccessForRequest(supabase, adminId, r);
  }

  if (branchType === "olympiad") {
    return grantOlympiadAccessForRequest(supabase, adminId, r);
  }

  return grantGenericBranchAccessForRequest(supabase, adminId, r);
}

async function existsOtherProcessedGrant(
  supabase: any,
  requestId: string,
  userId: string,
  kind: GrantKind,
  itemId: string,
) {
  const { data, error } = await runDbQuery<any[]>(
    () =>
      supabase
        .from("purchase_request_grants")
        .select("request_id, purchase_requests!inner(is_processed)")
        .eq("user_id", userId)
        .eq("kind", kind)
        .eq("item_id", itemId)
        .neq("request_id", requestId)
        .eq("purchase_requests.is_processed", true)
        .limit(1),
    "existsOtherProcessedGrant",
  );

  if (error) return false;

  return (data ?? []).length > 0;
}

async function existsOtherProcessedGenericRequestForMaterial(
  supabase: any,
  requestId: string,
  userId: string,
  branchType: string,
  materialKind: string | null | undefined,
  targetLevels: string[] | null | undefined,
) {
  const levels = Array.isArray(targetLevels) ? targetLevels.map(String) : [];
  const kind = norm(materialKind);

  if (!levels.length || !kind) return false;

  const { data, error } = await runDbQuery<any[]>(
    () =>
      supabase
        .from("purchase_requests")
        .select("id,target_level,target_levels,textbook_types,material_kinds,class_level,is_processed,branch_type")
        .eq("user_id", userId)
        .eq("is_processed", true)
        .eq("branch_type", branchType)
        .neq("id", requestId),
    "existsOtherProcessedGenericRequestForMaterial",
  );

  if (error) return false;

  for (const row of data ?? []) {
    const req = row as ReqRow;
    const rowLevels = branchType === 'gatehouse' ? getRequestTargetLevels(req) : [...toArr(req.class_level), ...toArr(req.target_levels)];
    const rowKinds = getRequestMaterialKinds(req);

    const levelMatches = branchType === 'gatehouse' ? overlapsGatehouseLevels(rowLevels, levels) : overlaps(rowLevels, levels);
    const kindMatches = rowKinds.length ? rowKinds.includes(kind) : true;

    if (levelMatches && kindMatches) return true;
  }

  return false;
}


async function getTargetsForUnprocess(supabase: any, r: ReqRow): Promise<GrantTarget[]> {
  const { data, error } = await runDbQuery<any[]>(
    () =>
      supabase
        .from("purchase_request_grants")
        .select("kind,item_id,title,granted_by,material_kind")
        .eq("request_id", r.id),
    "getTargetsForUnprocess",
  );

  if (error) throw new Error(error.message);

  const rows = data ?? [];

  return rows
    .map((x) => ({
      kind: String(x.kind) as GrantKind,
      item_id: String(x.item_id),
      title: String(x.title),
      granted_by: String(x.granted_by || ""),
      material_kind: typeof x.material_kind === "string" ? x.material_kind : null,
    }))
    .filter((x) => x.kind === "textbook" || x.kind === "crossword" || x.kind === "mock_test" || x.kind === "material");
}

async function enrichMockTestTargetIfNeeded(supabase: any, target: GrantTarget): Promise<GrantTarget> {
  if (target.kind !== "mock_test" && target.kind !== "material") return target;
  if (target.material_kind && Array.isArray(target.target_levels)) return target;

  const { data } = await runDbQuery<any>(
    () =>
      supabase
        .from("materials")
        .select("id,title,material_kind,target_levels,class_levels")
        .eq("id", target.item_id)
        .maybeSingle(),
    "enrichMockTestTargetIfNeeded",
  );

  if (!data) return target;

  return {
    ...target,
    title: target.title || String(data.title || "Материал"),
    material_kind: String(data.material_kind || "mock_test"),
    target_levels: [...(Array.isArray(data.target_levels) ? data.target_levels : []), ...(Array.isArray(data.class_levels) ? data.class_levels : [])].map(String),
  };
}

function applyBranchFilter(q: any, branchFilter: string) {
  if (branchFilter === "gatehouse") return q.eq("branch_type", "gatehouse");
  if (branchFilter === "olympiad") return q.or("branch_type.eq.olympiad,branch_type.is.null");
  return q.eq("branch_type", branchFilter);
}

function applyCursor(q: any, cursorCreatedAt: string) {
  if (!cursorCreatedAt) return q;

  const d = new Date(cursorCreatedAt);
  if (Number.isNaN(d.getTime())) return q;

  return q.lt("created_at", d.toISOString());
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const sp = req.nextUrl.searchParams;
    const status = (sp.get("status") || "all").trim();
    const name = (sp.get("name") || "").trim();
    const email = (sp.get("email") || "").trim();
    const branchFilter = (sp.get("branch_type") || "all").trim();
    const projectId = (sp.get("project_id") || "all").trim();

    const limit = clamp(parsePositiveInt(sp.get("limit"), 10), 1, 30);
    const cursorCreatedAt = String(sp.get("cursor_created_at") || "").trim();

    const makeQuery = () => {
      let q = supabase
        .from("purchase_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (projectId && projectId !== "all") {
        q = q.eq("project_id", projectId);
      } else if (branchFilter && branchFilter !== "all") {
        q = applyBranchFilter(q, branchFilter);
      }

      q = applyCursor(q, cursorCreatedAt);

      if (status === "pending") {
        q = q.or("is_processed.eq.false,is_processed.is.null");
      } else if (status === "processed") {
        q = q.eq("is_processed", true);
      }

      if (name) q = q.ilike("full_name", `%${name}%`);
      if (email) q = q.ilike("email", `%${email}%`);

      return q;
    };

    const { data, error } = await runDbQuery<any[]>(makeQuery, "adminRequestsList");

    if (error) return fail(error.message, 500, "DB_ERROR", noStoreInit());

    const rawRows = data ?? [];
    const rows: ReqRow[] = rawRows.map((r: any) => ({
      ...r,
      projects: Array.isArray(r.projects) ? r.projects[0] : r.projects,
      sheet_name: r.projects?.sheet_name || null, // извлекаем sheet_name
    }));

    const last = rows[rows.length - 1] ?? null;
    const nextCursor =
      rows.length === limit && last?.created_at ? { created_at: last.created_at } : null;

    return ok(
      {
        requests: rows,
        materialsByRequest: {},
        materialsError: null,
        page: {
          limit,
          returned: rows.length,
          hasMore: Boolean(nextCursor),
          nextCursor,
        },
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: any;

  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.map(String).map((x: string) => x.trim()).filter(Boolean)
    : [];

  const is_processed = Boolean(body?.is_processed);

  if (!ids.length) return fail("ids required", 400, "VALIDATION", noStoreInit());

  try {
    // Загружаем заявки вместе с sheet_name из проекта
    const { data: reqs, error: rErr } = await runDbQuery<ReqRow[]>(
      () =>
        supabase
          .from("purchase_requests")
          .select("*, projects(sheet_name)")
          .in("id", ids),
      "patchLoadRequests",
    );

    if (rErr) return fail(rErr.message, 500, "DB_ERROR", noStoreInit());

    const rows = (reqs ?? []).map((r: any) => ({
      ...r,
      sheet_name: r.projects?.sheet_name || null,
    })) as ReqRow[];

    const results: Record<
      string,
      {
        ok: boolean;
        granted?: string[];
        error?: string;
        sheet?: any;
        grants_history?: any;
      }
    > = {};

    for (const r of rows) {
      try {
        let granted: string[] = [];
        const grantsHistory: any = { ok: true };

        if (is_processed) {
          const { grantedLabels, grantsToStore } = await grantAccessForRequest(supabase, user.id, r);

          const delHistory = await supabase.from("purchase_request_grants").delete().eq("request_id", r.id);
          if (delHistory.error) throw new Error(delHistory.error.message);

          if (grantsToStore.length) {
            const ins = await supabase.from("purchase_request_grants").insert(grantsToStore);
            if (ins.error) throw new Error(ins.error.message);
          }

          granted = grantedLabels;
        } else {
          const targets = await getTargetsForUnprocess(supabase, r);

          for (const rawTarget of targets) {
            const t = await enrichMockTestTargetIfNeeded(supabase, rawTarget);

            if (t.kind === "mock_test" || t.kind === "material") {
              const keepByGrant = await existsOtherProcessedGrant(
                supabase,
                r.id,
                r.user_id,
                t.kind,
                t.item_id,
              );

              const keepByRequest = await existsOtherProcessedGenericRequestForMaterial(
                supabase,
                r.id,
                r.user_id,
                r.branch_type || "olympiad",
                t.material_kind,
                t.target_levels,
              );

              if (keepByGrant || keepByRequest) continue;

              const del = await supabase
                .from("material_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("material_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
              continue;
            }

            const keep = await existsOtherProcessedGrant(
              supabase,
              r.id,
              r.user_id,
              t.kind,
              t.item_id,
            );

            if (keep) continue;

            if (t.kind === "textbook") {
              const del = await supabase
                .from("textbook_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("textbook_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
            } else if (t.kind === "crossword") {
              const del = await supabase
                .from("crossword_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("crossword_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
            }
          }

          const delHistory = await supabase.from("purchase_request_grants").delete().eq("request_id", r.id);
          if (delHistory.error) throw new Error(delHistory.error.message);
        }

        const processed_at = is_processed ? new Date().toISOString() : null;

        const upd = await supabase
          .from("purchase_requests")
          .update({
            is_processed,
            processed_at,
          })
          .eq("id", r.id)
          .select("*")
          .single();

        if (upd.error) throw new Error(upd.error.message);

        const updatedRow = upd.data as any;
        const sheetValues = buildSheetValues(updatedRow);
        const sheetName = r.sheet_name; // имя листа из проекта

        try {
          // Передаём sheetName в upsert
          const sres = await upsertRequestRowByNumber(sheetValues, sheetName);

          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: new Date().toISOString(),
              sheet_row: sres.rowNumber ?? null,
              sheet_sync_error: null,
            })
            .eq("id", updatedRow.id);

          results[r.id] = {
            ok: true,
            granted,
            grants_history: grantsHistory,
            sheet: {
              ok: true,
              action: sres.action,
              row: sres.rowNumber ?? null,
            },
          };
        } catch (e: any) {
          const msg = String(e?.message || e || "Sheets sync error").slice(0, 500);

          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: null,
              sheet_sync_error: msg,
            })
            .eq("id", updatedRow.id);

          results[r.id] = {
            ok: true,
            granted,
            grants_history: grantsHistory,
            sheet: {
              ok: false,
              error: msg,
            },
          };
        }
      } catch (e: any) {
        results[r.id] = {
          ok: false,
          error: e?.message || String(e),
        };
      }
    }

    return ok({ updated: true, results }, noStoreInit());
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}