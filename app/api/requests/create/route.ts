// app/api/requests/create/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { appendAccountingRow } from "@/lib/integrations/googleSheets";
import {
  normalizeBranchType,
  normalizeString,
  toStringArray,
  uniqueStrings,
  normalizeGatehouseLevel,
  normalizeMaterialKind,
} from "@/lib/materials/normalize";
import {
  // formatClassLevel,       // ❌ не используется
  // formatGatehouseLevel,   // ❌ не используется
  formatTargetForSheet,
  formatMaterialTypesForSheet,
  formatRequestStatus,
  formatDateTimeRU,
  buildSheetValues,
  generateRequestNumber,
  validateRequest,
  normalizeRequestPayload,
  normalizeGatehouseMaterialKind,
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

function createFallbackRequestNumber(branchType: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  let prefix = "PR";
  if (branchType === "gatehouse") prefix = "GA";
  else if (branchType !== "olympiad") prefix = branchType.substring(0, 2).toUpperCase();

  return `${prefix}-${yyyy}${mm}${dd}-${random}`;
}

async function resolveRequestNumber(supabase: any, rawValue: unknown, branchType: string): Promise<string> {
  const provided = normalizeString(rawValue);
  if (provided) return provided;

  if (branchType === "gatehouse") {
    return createFallbackRequestNumber(branchType);
  }

  const { data, error } = await supabase.rpc("generate_request_number");
  if (!error && data) {
    return String(data);
  }

  return createFallbackRequestNumber(branchType);
}

function normalizeRequestBody(body: any) {
  const branch_type = normalizeBranchType(body?.branch_type);
  const class_level = normalizeString(body?.class_level);

  const rawTargetLevels =
    body?.target_levels !== undefined
      ? body.target_levels
      : body?.target_level !== undefined
        ? body.target_level
        : [];

  const target_levels = uniqueStrings(
    toStringArray(rawTargetLevels).map((l) =>
      branch_type === "gatehouse" ? normalizeGatehouseLevel(l) : normalizeString(l)
    )
  );

  const rawTextbookTypes =
    body?.textbook_types !== undefined
      ? body.textbook_types
      : body?.material_kinds !== undefined
        ? body.material_kinds
        : branch_type === "gatehouse"
          ? ["mock_test"]
          : [];

  const textbook_types = uniqueStrings(
    toStringArray(rawTextbookTypes).map((t) =>
      branch_type === "gatehouse" ? normalizeGatehouseMaterialKind(t) : normalizeMaterialKind(t)
    )
  );

  const rawMaterialKinds =
    body?.material_kinds !== undefined ? body.material_kinds : textbook_types;

  const material_kinds = uniqueStrings(
    toStringArray(rawMaterialKinds).map((k) =>
      branch_type === "gatehouse" ? normalizeGatehouseMaterialKind(k) : normalizeMaterialKind(k)
    )
  );

  return {
    branch_type,
    class_level,
    target_levels,
    textbook_types,
    material_kinds,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user, profile } = auth as any;

  const body = await safeJson(req);
  if (!body || typeof body !== "object") {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const normalized = normalizeRequestBody(body);

  const validation = validateRequest({
    branch_type: normalized.branch_type,
    class_level: normalized.class_level,
    target_levels: normalized.target_levels,
    textbook_types: normalized.textbook_types,
    material_kinds: normalized.material_kinds,
    email: normalizeString(profile?.email || user?.email || body?.email),
    full_name: normalizeString(profile?.full_name || body?.full_name),
    contact_phone: normalizeString(profile?.contact_phone || body?.contact_phone),
    is_processed: false,
  });

  if (!validation.valid) {
    return fail(validation.error || "Неверные данные заявки", 400, "VALIDATION", noStoreInit());
  }

  const email = normalizeString(profile?.email || user?.email || body?.email);
  const full_name = normalizeString(profile?.full_name || body?.full_name);
  const contact_phone = normalizeString(profile?.contact_phone || body?.contact_phone);

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
      email,
      full_name,
      contact_phone: contact_phone || null,
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
      normalizeBranchType(row.branch_type),
      row.class_level,
      toStringArray(row.target_levels).length ? toStringArray(row.target_levels) : toStringArray(row.target_level),
      toStringArray(row.material_kinds).length ? toStringArray(row.material_kinds) : toStringArray(row.textbook_types),
      row.email || "",
      row.full_name || "",
      Boolean(row.is_processed),
      row.processed_at ?? null,
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