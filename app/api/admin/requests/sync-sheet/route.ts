/* app/api/admin/requests/sync-sheet/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  appendAccountingRow,
  deleteAccountingRows,
  getSheetRequestRowMap,
  updateAccountingRow,
} from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BranchType = "olympiad" | "gatehouse";

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function normalizeBranchType(value: unknown): BranchType {
  const v = String(value ?? "").trim().toLowerCase();

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

  return "olympiad";
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

function formatTarget(branchType: BranchType, classLevel: any, targetLevels: any) {
  if (branchType === "gatehouse") {
    const levels = toArr(targetLevels);
    return levels.length ? levels.map(formatGatehouseLevel).join(", ") : "—";
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
  if (branchType !== "gatehouse") return row.class_level;

  const targetLevels = toArr(row.target_levels);
  if (targetLevels.length) return targetLevels;

  return row.target_level;
}

function getSheetMaterialTypesSource(row: any, branchType: BranchType) {
  if (branchType !== "gatehouse") return row.textbook_types;

  const materialKinds = toArr(row.material_kinds);
  if (materialKinds.length) return materialKinds;

  return row.textbook_types;
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

function equalRow(a: (string | number)[], b: string[]) {
  const max = Math.max(a.length, b.length, 7);

  for (let i = 0; i < max; i += 1) {
    const av = norm(a[i]);
    const bv = norm(b[i]);
    if (av !== bv) return false;
  }

  return true;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") || 500), 1), 2000);

  try {
    const sheetMap = await getSheetRequestRowMap();

    const { data, error } = await supabase
      .from("purchase_requests")
      .select(
        "id,request_number,created_at,branch_type,class_level,target_level,target_levels,textbook_types,material_kinds,email,full_name,contact_phone,is_processed,processed_at,sheet_synced_at,sheet_row,sheet_sync_error",
      )
      .order("created_at", { ascending: true });

    if (error) return fail(error.message, 500, "DB_ERROR", noStoreInit());

    const rows = (data ?? []) as any[];
    const dbSet = new Set<string>();

    for (const r of rows) {
      const rn = norm(r.request_number);
      if (rn) dbSet.add(rn);
    }

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let unchanged = 0;
    let skipped = 0;
    let failed = 0;
    let ops = 0;

    for (const r of rows) {
      if (ops >= limit) break;

      const rn = norm(r.request_number);

      if (!rn) {
        skipped += 1;
        continue;
      }

      const sheetValues = buildSheetValues(r);
      const existing = sheetMap.get(rn);

      try {
        if (!existing) {
          const res = await appendAccountingRow(sheetValues);
          const rowNumber = res.rowNumber ?? null;

          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: new Date().toISOString(),
              sheet_row: rowNumber,
              sheet_sync_error: null,
            })
            .eq("id", r.id);

          inserted += 1;
          ops += 1;

          if (rowNumber) {
            sheetMap.set(rn, {
              rowNumber,
              values: sheetValues.map((x) => norm(x)),
            });
          }
        } else if (!equalRow(sheetValues, existing.values)) {
          await updateAccountingRow(existing.rowNumber, sheetValues);

          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: new Date().toISOString(),
              sheet_row: existing.rowNumber,
              sheet_sync_error: null,
            })
            .eq("id", r.id);

          updated += 1;
          ops += 1;
        } else {
          if (!r.sheet_synced_at || r.sheet_row !== existing.rowNumber || r.sheet_sync_error) {
            await supabase
              .from("purchase_requests")
              .update({
                sheet_synced_at: new Date().toISOString(),
                sheet_row: existing.rowNumber,
                sheet_sync_error: null,
              })
              .eq("id", r.id);
          }

          unchanged += 1;
        }
      } catch (e: any) {
        failed += 1;

        await supabase
          .from("purchase_requests")
          .update({
            sheet_synced_at: null,
            sheet_sync_error: String(e?.message || e || "Sheets sync error").slice(0, 500),
          })
          .eq("id", r.id);
      }
    }

    if (ops < limit) {
      const toDelete: number[] = [];

      for (const [rn, info] of sheetMap.entries()) {
        if (!dbSet.has(rn)) toDelete.push(info.rowNumber);
      }

      toDelete.sort((a, b) => b - a);

      const canDelete = Math.max(0, limit - ops);
      const slice = toDelete.slice(0, canDelete);

      if (slice.length) {
        const res = await deleteAccountingRows(slice);
        deleted += res.deleted;
        ops += res.deleted;
      }
    }

    return ok(
      {
        inserted,
        updated,
        deleted,
        unchanged,
        skipped,
        failed,
        limit,
        ops,
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}