/* app/api/requests/delete/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { deleteAccountingRows, getSheetRequestRowMap } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";

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

  const { supabase, user } = auth as any;

  const body = await safeJson(req);
  if (!body) return fail("Bad JSON", 400, "BAD_JSON");

  const id = String(body.id || "").trim();
  if (!id) return fail("Missing id", 400, "VALIDATION");

  try {
    // 1) берём заявку (чтобы знать request_number)
    const get = await supabase
      .from("purchase_requests")
      .select("id,request_number,is_processed,user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (get.error) return fail(get.error.message, 500, "DB_ERROR");
    if (!get.data) return fail("Not found", 404, "NOT_FOUND");
    if (get.data.is_processed) return fail("Processed request can't be deleted", 403, "LOCKED");

    const request_number = String(get.data.request_number || "").trim();

    // 2) удаляем в БД (основное)
    const del = await supabase
      .from("purchase_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_processed", false);

    if (del.error) return fail(del.error.message, 500, "DB_ERROR");

    // 3) best-effort: удаляем из Sheets по номеру заявки
    let sheetOk = true;
    let deletedRows = 0;

    try {
      if (request_number) {
        const map = await getSheetRequestRowMap();
        const found = map.get(request_number);
        if (found) {
          const res = await deleteAccountingRows([found.rowNumber]);
          deletedRows = res.deleted;
        }
      }
    } catch (e) {
      sheetOk = false;
      // БД уже удалена — если Sheets не получилось, админский reconcile потом подчистит.
    }

    return ok({ deleted: true, request_number, sheet: { ok: sheetOk, deletedRows } });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
