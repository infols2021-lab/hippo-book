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
  type SelectedMaterialItem,
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
        "id,user_id,project_id,request_number,created_at,branch_type,class_level,target_level,target_levels,textbook_types,material_kinds,material_ids,total_price,email,full_name,contact_phone,is_processed,processed_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) return fail(existingError.message, 500, "DB_ERROR", noStoreInit());
    if (!existing) return fail("Not found", 404, "NOT_FOUND", noStoreInit());

    if (existing.is_processed) {
      return fail("Processed request can't be updated", 403, "LOCKED", noStoreInit());
    }

    const mergedBody = { ...existing, ...body };

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

    // 1. Поиск проекта и имени листа Google Sheets
    let projectId = existing.project_id;
    let sheetName = null;

    if (!projectId || normalized.branch_type !== existing.branch_type) {
      const { data: projectInfo } = await supabase
        .from("projects")
        .select("id, sheet_name")
        .eq("slug", normalized.branch_type)
        .maybeSingle();

      if (projectInfo) {
        projectId = projectInfo.id;
        sheetName = projectInfo.sheet_name;
      }
    } else {
      const { data: projectInfo } = await supabase
        .from("projects")
        .select("sheet_name")
        .eq("id", projectId)
        .maybeSingle();
      if (projectInfo) sheetName = projectInfo.sheet_name;
    }

    // 2. Выборка выбранных материалов из БД для перерасчета цены и названий
    let selectedMaterials: SelectedMaterialItem[] = [];
    let calculatedTotalPrice = 0;

    if (normalized.material_ids.length > 0) {
      const { data: fetchedMaterials } = await supabase
        .from("materials")
        .select("id, title, price, material_kind")
        .in("id", normalized.material_ids);

      if (Array.isArray(fetchedMaterials) && fetchedMaterials.length > 0) {
        selectedMaterials = fetchedMaterials.map((m: any) => ({
          id: String(m.id),
          title: String(m.title || "Материал"),
          price: Number(m.price || 1000),
          material_kind: m.material_kind ? String(m.material_kind) : undefined,
        }));

        calculatedTotalPrice = selectedMaterials.reduce((acc, m) => acc + m.price, 0);
      }
    }

    const totalPrice = calculatedTotalPrice > 0 ? calculatedTotalPrice : (normalized.total_price || 0);

    const extractedKinds = Array.from(
      new Set(selectedMaterials.map((m) => m.material_kind).filter(Boolean))
    ) as string[];

    const materialKinds =
      normalized.material_kinds.length > 0 ? normalized.material_kinds : extractedKinds;

    const payload: Record<string, any> = {
      branch_type: normalized.branch_type,
      project_id: projectId,
      class_level: normalized.class_level || null,
      target_level: normalized.target_levels.length > 0 ? normalized.target_levels : null,
      target_levels: normalized.target_levels.length > 0 ? normalized.target_levels : null,
      textbook_types: normalized.textbook_types.length > 0 ? normalized.textbook_types : materialKinds,
      material_kinds: materialKinds,
      material_ids: normalized.material_ids,
      total_price: totalPrice,
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

    const sheetValues = buildSheetValues(
      row.request_number || "",
      row.created_at || "",
      normalized.branch_type,
      normalized.class_level,
      normalized.target_levels,
      selectedMaterials.length > 0 ? selectedMaterials : (normalized.material_kinds.length > 0 ? normalized.material_kinds : normalized.textbook_types),
      totalPrice,
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