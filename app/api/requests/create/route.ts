// app/api/requests/create/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { appendAccountingRow } from "@/lib/integrations/googleSheets";
import { normalizeString } from "@/lib/materials/normalize";
import {
  buildSheetValues,
  generateRequestNumber,
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

async function resolveRequestNumber(supabase: any, rawValue: unknown, branchType: string): Promise<string> {
  const provided = normalizeString(rawValue);
  if (provided) return provided;

  if (branchType === "gatehouse") {
    return generateRequestNumber(branchType);
  }

  const { data, error } = await supabase.rpc("generate_request_number");
  if (!error && data) {
    return String(data);
  }

  return generateRequestNumber(branchType);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user, profile } = auth as any;

  const body = await safeJson(req);
  if (!body || typeof body !== "object") {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  // Единая нормализация всех полей заявки (без дублирования логики в роуте)
  const normalized = normalizeRequestPayload(
    body,
    profile?.email || user?.email,
    profile?.full_name,
    profile?.contact_phone
  );

  const validation = validateRequest(normalized);

  if (!validation.valid) {
    return fail(validation.error || "Неверные данные заявки", 400, "VALIDATION", noStoreInit());
  }

  try {
    const request_number = await resolveRequestNumber(supabase, body?.request_number, normalized.branch_type);

    let projectId = null;
    let sheetName = null;

    if (normalized.branch_type !== "gatehouse" && normalized.branch_type !== "olympiad") {
      const { data: projectInfo } = await supabase
        .from("projects")
        .select("id, sheet_name")
        .eq("slug", normalized.branch_type)
        .maybeSingle();

      if (projectInfo) {
        projectId = projectInfo.id;
        sheetName = projectInfo.sheet_name;
      }
    }

    const payload: Record<string, any> = {
      user_id: user.id,
      request_number,
      branch_type: normalized.branch_type,
      project_id: projectId,
      class_level: normalized.class_level || null,
      target_level: normalized.target_levels.length > 0 ? normalized.target_levels : null,
      target_levels: normalized.target_levels.length > 0 ? normalized.target_levels : null,
      textbook_types: normalized.textbook_types,
      material_kinds: normalized.material_kinds,
      email: normalized.email,
      full_name: normalized.full_name,
      contact_phone: normalized.contact_phone || null,
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
    const sheetValues = buildSheetValues(
      row.request_number || "",
      row.created_at || "",
      normalized.branch_type,
      normalized.class_level,
      normalized.target_levels,
      normalized.material_kinds.length > 0 ? normalized.material_kinds : normalized.textbook_types,
      normalized.email,
      normalized.full_name,
      false,
      null
    );

    let sheetOk = true;
    let sheetRow: number | null = null;
    let sheetError: string | null = null;

    try {
      const res = await withTimeout(
        appendAccountingRow(sheetValues, sheetName),
        SHEETS_TIMEOUT_MS,
        "Sheets append"
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