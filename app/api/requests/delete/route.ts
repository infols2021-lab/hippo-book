/* app/api/requests/delete/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { deleteRequestRowByNumber } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const id = normalizeString((body as any).id);

  if (!id) {
    return fail("id required", 400, "VALIDATION", noStoreInit());
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("purchase_requests")
      .select("id,user_id,request_number,is_processed")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      return fail(existingError.message, 500, "DB_ERROR", noStoreInit());
    }

    if (!existing) {
      return fail("Not found", 404, "NOT_FOUND", noStoreInit());
    }

    if (Boolean(existing.is_processed)) {
      return fail("Processed request can't be deleted", 403, "LOCKED", noStoreInit());
    }

    const { error: deleteError } = await supabase
      .from("purchase_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return fail(deleteError.message, 500, "DB_ERROR", noStoreInit());
    }

    const requestNumber = normalizeString(existing.request_number);

    if (!requestNumber) {
      return ok(
        {
          deleted: true,
          id,
          sheet: {
            ok: false,
            deleted: 0,
            row: null,
            error: "Request number is empty, sheet row was not deleted",
          },
        },
        noStoreInit(),
      );
    }

    try {
      const sheet = await withTimeout(
        deleteRequestRowByNumber(requestNumber),
        SHEETS_TIMEOUT_MS,
        "Sheets delete",
      );

      return ok(
        {
          deleted: true,
          id,
          sheet: {
            ok: true,
            deleted: sheet.deleted,
            row: sheet.rowNumber,
          },
        },
        noStoreInit(),
      );
    } catch (e: any) {
      return ok(
        {
          deleted: true,
          id,
          sheet: {
            ok: false,
            deleted: 0,
            row: null,
            error: String(e?.message || e || "Sheets delete error").slice(0, 500),
          },
        },
        noStoreInit(),
      );
    }
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}