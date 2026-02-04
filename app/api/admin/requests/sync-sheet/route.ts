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

function formatTextbookTypes(types: any) {
  const arr = Array.isArray(types) ? types : types ? [types] : [];
  const typeMap: Record<string, string> = { учебник: "📚 Учебник", кроссворд: "🧩 Кроссворд" };
  return arr.map((t: any) => typeMap[String(t).toLowerCase()] || String(t)).join(", ");
}

function formatDateTimeRU(dateString: string) {
  return new Date(dateString).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function equalAtoF(a: (string | number)[], b: string[]) {
  // сравнение 6 колонок A..F
  for (let i = 0; i < 6; i++) {
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
  const limit = Math.min(Number(sp.get("limit") || 500), 2000);

  try {
    // 1) читаем Sheets (A:F) -> map request_number -> {rowNumber, values}
    const sheetMap = await getSheetRequestRowMap();

    // 2) читаем БД
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("id,request_number,created_at,class_level,textbook_types,email,full_name,sheet_synced_at,sheet_row")
      .order("created_at", { ascending: true });

    if (error) return fail(error.message, 500, "DB_ERROR");

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

    // 3) upsert/update: БД -> Sheets
    for (const r of rows) {
      if (ops >= limit) break;

      const rn = norm(r.request_number);
      if (!rn) {
        skipped++;
        continue;
      }

      const sheetValues: (string | number)[] = [
        rn,
        formatDateTimeRU(String(r.created_at)),
        formatClassLevel(String(r.class_level)),
        formatTextbookTypes(r.textbook_types),
        String(r.email || ""),
        String(r.full_name || ""),
      ];

      const existing = sheetMap.get(rn);

      try {
        if (!existing) {
          // нет в Sheets -> append
          const res = await appendAccountingRow(sheetValues);
          const rowNumber = res.rowNumber ?? null;

          // фиксируем в БД (не обязательно, но полезно)
          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: new Date().toISOString(),
              sheet_row: rowNumber,
              sheet_sync_error: null,
            })
            .eq("id", r.id);

          inserted++;
          ops++;
          // обновим локальную map, чтобы не считать как "лишнюю" при delete
          if (rowNumber) {
            sheetMap.set(rn, { rowNumber, values: sheetValues.map((x) => norm(x)) as any });
          }
        } else {
          // есть в Sheets -> сравниваем и обновляем при отличиях
          if (!equalAtoF(sheetValues, existing.values)) {
            await updateAccountingRow(existing.rowNumber, sheetValues);

            await supabase
              .from("purchase_requests")
              .update({
                sheet_synced_at: new Date().toISOString(),
                sheet_row: existing.rowNumber,
                sheet_sync_error: null,
              })
              .eq("id", r.id);

            updated++;
            ops++;
          } else {
            // если в БД не было отметки синка — поставим (чисто косметика)
            if (!r.sheet_synced_at || r.sheet_row !== existing.rowNumber) {
              await supabase
                .from("purchase_requests")
                .update({
                  sheet_synced_at: new Date().toISOString(),
                  sheet_row: existing.rowNumber,
                  sheet_sync_error: null,
                })
                .eq("id", r.id);
            }
            unchanged++;
          }
        }
      } catch (e: any) {
        failed++;
        await supabase
          .from("purchase_requests")
          .update({
            sheet_synced_at: null,
            sheet_row: null,
            sheet_sync_error: String(e?.message || e || "Sheets sync error").slice(0, 500),
          })
          .eq("id", r.id);
      }
    }

    // 4) delete: если в Sheets есть заявка, но в БД её уже нет -> удалить строку
    if (ops < limit) {
      const toDelete: number[] = [];

      for (const [rn, info] of sheetMap.entries()) {
        if (!dbSet.has(rn)) {
          toDelete.push(info.rowNumber);
        }
      }

      // удаляем снизу вверх и не больше лимита по операциям
      toDelete.sort((a, b) => b - a);
      const canDelete = Math.max(0, limit - ops);
      const slice = toDelete.slice(0, canDelete);

      if (slice.length) {
        const res = await deleteAccountingRows(slice);
        deleted += res.deleted;
        ops += res.deleted;
      }
    }

    return ok({ inserted, updated, deleted, unchanged, skipped, failed, limit });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
