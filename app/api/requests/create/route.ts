/* app/api/requests/create/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { appendAccountingRow } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";

type BranchType = "olympiad" | "gatehouse";

const SHEETS_TIMEOUT_MS = 12_000;

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

  if (v === "gatehouse" || v === "gatehouse_awards" || v === "ga" || v === "ga_exam" || v === "exam") {
    return "gatehouse";
  }

  return "olympiad";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
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

function normalizeOlympiadMaterialKind(value: unknown) {
  const v = String(value ?? "").trim().toLowerCase();

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
    "12": "12 класс (Техникум, колледж)",
  };

  return classMap[classLevel] || classLevel;
}

function formatBranchLabel(branchType: BranchType) {
  if (branchType === "gatehouse") return "🎓 Gatehouse Awards";
  return "🏆 Олимпиада";
}

function formatTarget(branchType: BranchType, classLevel: string, targetLevels: string[]) {
  if (branchType === "gatehouse") {
    return targetLevels.length ? targetLevels.join(", ") : "—";
  }

  return formatClassLevel(classLevel);
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

    return arr.map((type) => typeMap[type.toLowerCase()] || type).join(", ");
  }

  const typeMap: Record<string, string> = {
    учебник: "📚 Учебник",
    кроссворд: "🧩 Кроссворд",
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
  };

  return arr.map((type) => typeMap[type.toLowerCase()] || type).join(", ");
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

function formatProcessedInfo(row: any) {
  if (!row?.is_processed) return "";
  if (row?.processed_at) return `Обработана: ${formatDateTimeRU(String(row.processed_at))}`;
  return "Обработана";
}

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user, profile } = auth as any;

  const body = await safeJson(req);
  if (!body) return fail("Bad JSON", 400, "BAD_JSON");

  const branch_type = normalizeBranchType(body.branch_type);
  const request_number = String(body.request_number || "").trim();
  const created_at = String(body.created_at || "").trim();

  const class_level = String(body.class_level || "").trim();

  const target_levels =
    branch_type === "gatehouse"
      ? uniqueStrings(toStringArray(body.target_levels ?? body.target_level).map(normalizeGatehouseLevel))
      : [];

  const textbook_types =
    branch_type === "gatehouse"
      ? uniqueStrings(toStringArray(body.textbook_types ?? body.material_kinds ?? ["mock_test"]).map(normalizeGatehouseMaterialKind))
      : uniqueStrings(toStringArray(body.textbook_types));

  const material_kinds =
    branch_type === "gatehouse"
      ? uniqueStrings(toStringArray(body.material_kinds ?? textbook_types).map(normalizeGatehouseMaterialKind))
      : uniqueStrings(
          (toStringArray(body.material_kinds).length ? toStringArray(body.material_kinds) : textbook_types).map(
            normalizeOlympiadMaterialKind,
          ),
        );

  if (!request_number || !textbook_types.length) {
    return fail("Missing fields", 400, "VALIDATION");
  }

  if (branch_type === "olympiad" && !class_level) {
    return fail("Missing class_level", 400, "VALIDATION");
  }

  if (branch_type === "gatehouse" && target_levels.length === 0) {
    return fail("Missing target_level", 400, "VALIDATION");
  }

  const email = String(profile?.email || user?.email || body.email || "").trim();
  const full_name = String(profile?.full_name || body.full_name || "").trim();
  const contact_phone = String(profile?.contact_phone || body.contact_phone || "").trim();

  if (!email || !full_name) {
    return fail("Missing profile data (email/full_name)", 400, "PROFILE_MISSING");
  }

  try {
    const payload: any = {
      user_id: user.id,
      request_number,
      branch_type,
      class_level: branch_type === "olympiad" ? class_level : null,
      target_level: branch_type === "gatehouse" ? target_levels : null,
      target_levels: branch_type === "gatehouse" ? target_levels : null,
      textbook_types,
      material_kinds,
      email,
      full_name,
      contact_phone: contact_phone || null,
      is_processed: false,
      processed_at: null,
    };

    if (created_at) payload.created_at = created_at;

    const ins = await supabase.from("purchase_requests").insert([payload]).select("*").single();
    if (ins.error) return fail(ins.error.message, 500, "DB_ERROR");

    const row = ins.data as any;

    const sheetValues = [
      String(row.request_number),
      formatDateTimeRU(String(row.created_at)),
      formatBranchLabel(branch_type),
      formatTarget(branch_type, String(row.class_level || ""), toStringArray(row.target_levels ?? row.target_level)),
      formatMaterialTypes(branch_type, row.material_kinds ?? row.textbook_types),
      String(row.email || ""),
      String(row.full_name || ""),
      String(row.contact_phone || ""),
      formatStatus(Boolean(row.is_processed), row.processed_at ?? null),
      formatProcessedInfo(row),
    ];

    let sheetOk = true;
    let sheetRow: number | null = null;

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

      await supabase
        .from("purchase_requests")
        .update({
          sheet_synced_at: null,
          sheet_row: null,
          sheet_sync_error: String(e?.message || e || "Sheets sync error").slice(0, 500),
        })
        .eq("id", row.id)
        .eq("user_id", user.id);
    }

    return ok({
      request: row,
      sheet: { ok: sheetOk, row: sheetRow },
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}