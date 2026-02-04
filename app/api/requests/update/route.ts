/* app/api/requests/update/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import {
  appendAccountingRow,
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

  const id = String(body.id || "").trim();
  const request_number = String(body.request_number || "").trim();
  const created_at = String(body.created_at || "").trim();
  const class_level = String(body.class_level || "").trim();
  const textbook_types = Array.isArray(body.textbook_types) ? body.textbook_types.map(String) : [];

  if (!id || !request_number || !created_at || !class_level || !textbook_types.length) {
    return fail("Missing fields", 400, "VALIDATION");
  }

  const email = String(profile?.email || user?.email || body.email || "").trim();
  const full_name = String(profile?.full_name || body.full_name || "").trim();
  if (!email || !full_name) return fail("Missing profile data (email/full_name)", 400, "PROFILE_MISSING");

  try {
    // 1) Обновляем в БД (только свои + только не обработанные)
    const upd = await supabase
      .from("purchase_requests")
      .update({
        request_number, // можно оставить (у тебя он readOnly)
        created_at,
        class_level,
        textbook_types,
        email,
        full_name,
        user_id: user.id,
        is_processed: false,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_processed", false)
      .select("*")
      .single();

    if (upd.error) return fail(upd.error.message, 500, "DB_ERROR");
    const row = upd.data as any;

    // 2) Пытаемся синкнуть Sheets сразу
    const sheetValues = [
      String(row.request_number),
      formatDateTimeRU(String(row.created_at)),
      formatClassLevel(String(row.class_level)),
      formatTextbookTypes(row.textbook_types),
      String(row.email || ""),
      String(row.full_name || ""),
    ];

    let sheetOk = true;
    let sheetRow: number | null = null;

    try {
      const map = await getSheetRequestRowMap();
      const found = map.get(String(row.request_number));

      if (found) {
        await updateAccountingRow(found.rowNumber, sheetValues);
        sheetRow = found.rowNumber;
      } else {
        const res = await appendAccountingRow(sheetValues);
        sheetRow = res.rowNumber ?? null;
      }

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

    return ok({ request: row, sheet: { ok: sheetOk, row: sheetRow } });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
