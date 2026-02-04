/* app/api/admin/requests/sync-sheet/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { appendAccountingRow, getExistingRequestNumbersSet } from "@/lib/integrations/googleSheets";

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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") || 500), 2000);

  try {
    // чтобы не было дублей — читаем колонку A
    const existing = await getExistingRequestNumbersSet();

    // берём заявки по created_at: старые -> новые
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("id,request_number,created_at,class_level,textbook_types,email,full_name,sheet_synced_at")
      .order("created_at", { ascending: true });

    if (error) return fail(error.message, 500, "DB_ERROR");

    const rows = (data ?? []) as any[];
    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of rows) {
      if (synced >= limit) break;

      const rn = String(r.request_number || "").trim();
      if (!rn) {
        skipped++;
        continue;
      }

      // если уже есть в таблице — пропускаем
      if (existing.has(rn)) {
        // отметим как синкнуто (если было пусто)
        if (!r.sheet_synced_at) {
          await supabase
            .from("purchase_requests")
            .update({ sheet_synced_at: new Date().toISOString(), sheet_sync_error: null })
            .eq("id", r.id);
        }
        skipped++;
        continue;
      }

      const sheetValues = [
        rn,
        formatDateTimeRU(String(r.created_at)),
        formatClassLevel(String(r.class_level)),
        formatTextbookTypes(r.textbook_types),
        String(r.email || ""),
        String(r.full_name || ""),
      ];

      try {
        const res = await appendAccountingRow(sheetValues);

        await supabase
          .from("purchase_requests")
          .update({
            sheet_synced_at: new Date().toISOString(),
            sheet_row: res.rowNumber ?? null,
            sheet_sync_error: null,
          })
          .eq("id", r.id);

        existing.add(rn);
        synced++;
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

    return ok({ synced, skipped, failed, limit });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
