/* app/api/requests/create/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { appendAccountingRow } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BranchType = "olympiad" | "gatehouse";

const SHEETS_TIMEOUT_MS = 12_000;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function normalizeBranchType(value: unknown): BranchType {
  const v = String(value ?? "").trim().toLowerCase();

  if (
    v === "gatehouse" ||
    v === "gatehouse_awards" ||
    v === "ga" ||
    v === "ga_exam" ||
    v === "exam" ||
    v === "exams"
  ) {
    return "gatehouse";
  }

  return "olympiad";
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) return [];

    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        return toStringArray(JSON.parse(text));
      } catch {
        return [];
      }
    }

    return text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const single = normalizeString(value);
  return single ? [single] : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeString(value)).filter(Boolean)));
}

function normalizeGatehouseLevel(value: unknown) {
  const raw = normalizeString(value);
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

  return map[v] || normalizeString(value) || v;
}

function normalizeGatehouseMaterialKind(value: unknown) {
  const v = normalizeString(value).toLowerCase();

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

function normalizeOlympiadMaterialKind(value: unknown) {
  const v = normalizeString(value).toLowerCase();

  if (v === "учебник" || v === "textbook") return "textbook";
  if (v === "кроссворд" || v === "crossword") return "crossword";

  return v;
}

function formatClassLevel(classLevel: string) {
  const classMap: Record<string, string> = {
    "1-2": "1-2 класс",
    "3-4": "3-4 класс",
    "5-6": "5-6 класс",
    "7": "7 класс",
    "8-9": "8-9 класс",
    "10-11": "10-11 класс (Техникум, колледж - 1й курс)",
    "12": "12 класс (Техникум, college)",
  };

  return classMap[classLevel] || classLevel;
}

function formatTarget(branchType: BranchType, classLevel: string | null, targetLevels: string[]) {
  if (branchType === "gatehouse") {
    return targetLevels.length ? targetLevels.map(formatGatehouseLevel).join(", ") : "—";
  }

  return classLevel ? formatClassLevel(classLevel) : "—";
}

function formatMaterialTypes(branchType: BranchType, types: unknown) {
  const arr = toStringArray(types);

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

    return arr.map((type) => typeMap[String(type).toLowerCase()] || String(type)).join(", ");
  }

  const typeMap: Record<string, string> = {
    учебник: "📚 Учебник",
    кроссворд: "🧩 Кроссворд",
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
  };

  return arr.map((type) => typeMap[String(type).toLowerCase()] || String(type)).join(", ");
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

/**
 * Google Sheets A:G:
 * A Номер заявки
 * B Дата и время создания
 * C Класс / уровень
 * D Типы материалов
 * E Email
 * F ФИО ученика
 * G Статус заявки
 */
function buildSheetValues(row: any) {
  const branchType = normalizeBranchType(row?.branch_type);
  const targetLevels = toStringArray(row?.target_levels ?? row?.target_level);

  const materialTypes =
    branchType === "gatehouse"
      ? toStringArray(row?.material_kinds).length
        ? row.material_kinds
        : row.textbook_types
      : row?.textbook_types;

  return [
    String(row?.request_number || ""),
    formatDateTimeRU(String(row?.created_at || "")),
    formatTarget(branchType, row?.class_level ? String(row.class_level) : null, targetLevels),
    formatMaterialTypes(branchType, materialTypes),
    String(row?.email || ""),
    String(row?.full_name || ""),
    formatStatus(Boolean(row?.is_processed), row?.processed_at ?? null),
  ];
}

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function createFallbackRequestNumber(branchType: BranchType) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = branchType === "gatehouse" ? "GA" : "PR";

  return `${prefix}-${yyyy}${mm}${dd}-${random}`;
}

async function resolveRequestNumber(supabase: any, rawValue: unknown, branchType: BranchType) {
  const provided = normalizeString(rawValue);
  if (provided) return provided;

  if (branchType === "gatehouse") {
    return createFallbackRequestNumber(branchType);
  }

  const { data, error } = await supabase.rpc("generate_request_number");

  if (!error && data) {
    return String(data);
  }

  return createFallbackRequestNumber(branchType);
}

function normalizeRequestBody(body: any) {
  const branch_type = normalizeBranchType(body?.branch_type);
  const class_level = normalizeString(body?.class_level);

  const rawTargetLevels =
    body?.target_levels !== undefined
      ? body.target_levels
      : body?.target_level !== undefined
        ? body.target_level
        : [];

  const target_levels =
    branch_type === "gatehouse"
      ? uniqueStrings(toStringArray(rawTargetLevels).map(normalizeGatehouseLevel))
      : [];

  const rawTextbookTypes =
    body?.textbook_types !== undefined
      ? body.textbook_types
      : body?.material_kinds !== undefined
        ? body.material_kinds
        : branch_type === "gatehouse"
          ? ["mock_test"]
          : [];

  const textbook_types =
    branch_type === "gatehouse"
      ? uniqueStrings(toStringArray(rawTextbookTypes).map(normalizeGatehouseMaterialKind))
      : uniqueStrings(toStringArray(rawTextbookTypes).map(normalizeOlympiadMaterialKind));

  const rawMaterialKinds =
    body?.material_kinds !== undefined
      ? body.material_kinds
      : branch_type === "gatehouse"
        ? textbook_types
        : textbook_types;

  const material_kinds =
    branch_type === "gatehouse"
      ? uniqueStrings(toStringArray(rawMaterialKinds).map(normalizeGatehouseMaterialKind))
      : uniqueStrings(toStringArray(rawMaterialKinds).map(normalizeOlympiadMaterialKind));

  return {
    branch_type,
    class_level,
    target_levels,
    textbook_types,
    material_kinds,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user, profile } = auth as any;

  const body = await safeJson(req);
  if (!body || typeof body !== "object") {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const normalized = normalizeRequestBody(body);

  if (!normalized.textbook_types.length) {
    return fail("Выберите тип материала", 400, "VALIDATION", noStoreInit());
  }

  if (normalized.branch_type === "olympiad" && !normalized.class_level) {
    return fail("Выберите класс", 400, "VALIDATION", noStoreInit());
  }

  if (normalized.branch_type === "gatehouse" && normalized.target_levels.length === 0) {
    return fail("Выберите уровень экзамена", 400, "VALIDATION", noStoreInit());
  }

  const email = normalizeString(profile?.email || user?.email || body?.email);
  const full_name = normalizeString(profile?.full_name || body?.full_name);
  const contact_phone = normalizeString(profile?.contact_phone || body?.contact_phone);

  if (!email || !full_name) {
    return fail("Missing profile data (email/full_name)", 400, "PROFILE_MISSING", noStoreInit());
  }

  try {
    const request_number = await resolveRequestNumber(supabase, body?.request_number, normalized.branch_type);

    const payload: Record<string, any> = {
      user_id: user.id,
      request_number,
      branch_type: normalized.branch_type,
      class_level: normalized.branch_type === "olympiad" ? normalized.class_level : null,
      target_level: normalized.branch_type === "gatehouse" ? normalized.target_levels : null,
      target_levels: normalized.branch_type === "gatehouse" ? normalized.target_levels : null,
      textbook_types: normalized.textbook_types,
      material_kinds: normalized.material_kinds,
      email,
      full_name,
      contact_phone: contact_phone || null,
      is_processed: false,
      processed_at: null,
      sheet_synced_at: null,
      sheet_row: null,
      sheet_sync_error: null,
    };

    const { data: insertedRow, error: insertError } = await supabase
      .from("purchase_requests")
      .insert(payload)
      .select("*")
      .single();

    if (insertError) {
      return fail(insertError.message, 500, "DB_ERROR", noStoreInit());
    }

    const row = insertedRow as any;
    const sheetValues = buildSheetValues(row);

    let sheetOk = true;
    let sheetRow: number | null = null;
    let sheetError: string | null = null;

    try {
      const res = await withTimeout(appendAccountingRow(sheetValues), SHEETS_TIMEOUT_MS, "Sheets append");
      sheetRow = res.rowNumber ?? null;

      await supabase
        .from("purchase_requests")
        .update({
          sheet_synced_at: new Date().toISOString(),
          sheet_row: sheetRow,
          sheet_sync_error: null,
        })
        .eq("id", row.id)
        .eq("user_id", user.id);
    } catch (e: any) {
      sheetOk = false;
      sheetError = String(e?.message || e || "Sheets sync error").slice(0, 500);

      await supabase
        .from("purchase_requests")
        .update({
          sheet_synced_at: null,
          sheet_row: null,
          sheet_sync_error: sheetError,
        })
        .eq("id", row.id)
        .eq("user_id", user.id);
    }

    return ok(
      {
        request: row,
        sheet: {
          ok: sheetOk,
          row: sheetRow,
          error: sheetError,
        },
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}