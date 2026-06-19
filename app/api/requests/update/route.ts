// app/api/requests/update/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { upsertRequestRowByNumber } from "@/lib/integrations/googleSheets";
import { normalizeString } from "@/lib/materials/normalize";
import {
  buildSheetValues,
  validateRequest,
  normalizeRequestPayload,
} from "@/lib/requests/normalize";

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
  if (!body || typeof body !== "object") {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const id = normalizeString(body?.id);
  if (!id) {
    return fail("id required", 400, "VALIDATION", noStoreInit());
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("purchase_requests")
      .select(
        "id,user_id,project_id,request_number,created_at,branch_type,class_level,target_level,target_levels,textbook_types,material_kinds,email,full_name,contact_phone,is_processed,processed_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) return fail(existingError.message, 500, "DB_ERROR", noStoreInit());
    if (!existing) return fail("Not found", 404, "NOT_FOUND", noStoreInit());

    if (existing.is_processed) {
      return fail("Processed request can't be updated", 403, "LOCKED", noStoreInit());
    }

    // Мержим существующие данные и новые из body перед нормализацией
    const mergedBody = { ...existing, ...body };

    // Единая нормализация всех полей
    const normalized = normalizeRequestPayload(
      mergedBody,
      profile?.email || user?.email || existing.email,
      profile?.full_name || existing.full_name,
      profile?.contact_phone || existing.contact_phone
    );

    const validation = validateRequest(normalized);

    if (!validation.valid) {
      return fail(validation.error || "Неверные данные заявки", 400, "VALIDATION", noStoreInit());
    }

    const payload: Record<string, any> = {
      branch_type: normalized.branch_type,
      class_level: normalized.class_level || null,
      target_level: normalized.target_levels.length > 0 ? normalized.target_levels : null,
      target_levels: normalized.target_levels.length > 0 ? normalized.target_levels : null,
      textbook_types: normalized.textbook_types,
      material_kinds: normalized.material_kinds,
      email: normalized.email,
      full_name: normalized.full_name,
      contact_phone: normalized.contact_phone || null,
      sheet_synced_at: null,
      sheet_sync_error: null,
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from("purchase_requests")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .or("is_processed.eq.false,is_processed.is.null")
      .select("*")
      .single();

    if (updateError) return fail(updateError.message, 500, "DB_ERROR", noStoreInit());

    const row = updatedRow as any;

    let sheetName = null;
    if (existing.project_id) {
      const { data: projectInfo } = await supabase
        .from("projects")
        .select("sheet_name")
        .eq("id", existing.project_id)
        .maybeSingle();

      if (projectInfo?.sheet_name) {
        sheetName = projectInfo.sheet_name;
      }
    }

    const sheetValues = buildSheetValues(
      row.request_number || "",
      row.created_at || "",
      normalized.branch_type,
      normalized.class_level,
      normalized.target_levels,
      normalized.material_kinds.length > 0 ? normalized.material_kinds : normalized.textbook_types,
      normalized.email,
      normalized.full_name,
      Boolean(row.is_processed),
      row.processed_at ?? null
    );

    let sheetOk = true;
    let sheetRow: number | null = null;
    let sheetError: string | null = null;

    try {
      const res = await withTimeout(
        upsertRequestRowByNumber(sheetValues, sheetName),
        SHEETS_TIMEOUT_MS,
        "Sheets update"
      );
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
      noStoreInit()
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}