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
    let projectName = null;

    // 1. Поиск проекта (включая имя для Google Sheets)
    const { data: projectInfo } = await supabase
      .from("projects")
      .select("id, sheet_name, name")
      .eq("slug", normalized.branch_type)
      .maybeSingle();

    if (projectInfo) {
      projectId = projectInfo.id;
      sheetName = projectInfo.sheet_name;
      projectName = projectInfo.name;
    }

    // 2. Поиск выбранных материалов по всем источникам (materials, textbooks, crosswords)
    let selectedMaterials: SelectedMaterialItem[] = [];
    let calculatedTotalPrice = 0;

    if (normalized.material_ids.length > 0) {
      const [
        { data: fetchedMaterials },
        { data: fetchedTextbooks },
        { data: fetchedCrosswords },
      ] = await Promise.all([
        supabase
          .from("materials")
          .select("id, title, price, material_kind, project_tabs(title)")
          .in("id", normalized.material_ids),
        supabase
          .from("textbooks")
          .select("id, title, price")
          .in("id", normalized.material_ids),
        supabase
          .from("crosswords")
          .select("id, title, price")
          .in("id", normalized.material_ids),
      ]);

      const itemsMap = new Map<string, SelectedMaterialItem>();

      if (Array.isArray(fetchedMaterials)) {
        for (const m of fetchedMaterials) {
          const rawTabTitle = (m as any).project_tabs?.title || null;
          itemsMap.set(String(m.id), {
            id: String(m.id),
            title: String(m.title || "Материал"),
            price: Number(m.price || 1000),
            material_kind: m.material_kind ? String(m.material_kind) : undefined,
            tab_title: rawTabTitle ? String(rawTabTitle) : undefined,
          });
        }
      }

      if (Array.isArray(fetchedTextbooks)) {
        for (const m of fetchedTextbooks) {
          if (!itemsMap.has(String(m.id))) {
            itemsMap.set(String(m.id), {
              id: String(m.id),
              title: String(m.title || "Учебник"),
              price: Number(m.price || 1000),
              material_kind: "textbook",
              tab_title: "Учебники",
            });
          }
        }
      }

      if (Array.isArray(fetchedCrosswords)) {
        for (const m of fetchedCrosswords) {
          if (!itemsMap.has(String(m.id))) {
            itemsMap.set(String(m.id), {
              id: String(m.id),
              title: String(m.title || "Кроссворд"),
              price: Number(m.price || 1000),
              material_kind: "crossword",
              tab_title: "Кроссворды",
            });
          }
        }
      }

      selectedMaterials = Array.from(itemsMap.values());
      calculatedTotalPrice = selectedMaterials.reduce((acc, m) => acc + m.price, 0);
    }

    const totalPrice = calculatedTotalPrice > 0 ? calculatedTotalPrice : (normalized.total_price || 0);

    const extractedKinds = Array.from(
      new Set(selectedMaterials.map((m) => m.material_kind).filter(Boolean))
    ) as string[];

    const materialKinds =
      normalized.material_kinds.length > 0 ? normalized.material_kinds : extractedKinds;

    // 3. Формирование записи для базы данных
    const payload: Record<string, any> = {
      user_id: user.id,
      request_number,
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

    // 4. Подготовка ровно 7 столбцов для Google Таблицы
    const sheetValues = buildSheetValues(
      row.request_number || "",
      row.created_at || "",
      normalized.branch_type,
      normalized.class_level,
      normalized.target_levels,
      selectedMaterials,
      totalPrice,
      normalized.email,
      normalized.full_name,
      false,
      null,
      projectName
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