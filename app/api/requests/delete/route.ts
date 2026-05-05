// app/api/requests/delete/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { deleteRequestRowByNumber } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";

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

  if (!id) {
    return fail("id required", 400, "VALIDATION");
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("purchase_requests")
      .select("id,user_id,request_number,is_processed")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) return fail(existingError.message, 500, "DB_ERROR");
    if (!existing) return fail("Not found", 404, "NOT_FOUND");
    if (existing.is_processed) return fail("Processed request can't be deleted", 403, "LOCKED");

    const del = await supabase
      .from("purchase_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_processed", false)
      .select("id")
      .single();

    if (del.error) return fail(del.error.message, 500, "DB_ERROR");

    const requestNumber = String(existing.request_number || "").trim();

    if (!requestNumber) {
      return ok({
        deleted: true,
        id,
        sheet: {
          ok: false,
          deleted: false,
          row: null,
          error: "Request number is empty, sheet row was not deleted",
        },
      });
    }

    try {
      const sheet = await withTimeout(deleteRequestRowByNumber(requestNumber), SHEETS_TIMEOUT_MS, "Sheets delete");

      return ok({
        deleted: true,
        id,
        sheet: {
          ok: true,
          deleted: sheet.deleted,
          row: sheet.rowNumber,
        },
      });
    } catch (e: any) {
      return ok({
        deleted: true,
        id,
        sheet: {
          ok: false,
          deleted: false,
          row: null,
          error: String(e?.message || e || "Sheets delete error").slice(0, 500),
        },
      });
    }
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}