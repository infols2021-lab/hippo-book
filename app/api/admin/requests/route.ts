// app/api/admin/requests/route.ts
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { upsertRequestRowByNumber } from "@/lib/integrations/googleSheets";
import {
  grantAccessForRequest,
  getTargetsForUnprocess,
  enrichMockTestTargetIfNeeded,
  existsOtherProcessedGrant,
  existsOtherProcessedGenericRequestForMaterial,
} from "@/lib/requests/grants";
import {
  getRequestTargetLevels,
  getRequestMaterialKinds,
  normalizeBranchType,
  normalizeGatehouseLevel,
  normalizeGatehouseMaterialKind,
  toArr,
  uniq,
  overlaps,
  overlapsGatehouseLevels,
  formatDateTimeRU,
  formatTargetForSheet,
  formatMaterialTypesForSheet,
  formatRequestStatus,
  buildSheetValues,
} from "@/lib/requests/normalize";
import { sanitizeLikeQuery } from "@/lib/api/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GrantKind = "textbook" | "crossword" | "mock_test" | "material";

type ReqRow = {
  id: string;
  user_id: string;
  request_number: string | null;
  created_at: string | null;
  processed_at: string | null;
  is_processed: boolean | null;
  full_name: string | null;
  email: string | null;
  contact_phone?: string | null;
  branch_type: string | null;
  class_level: any;
  target_level: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
  project_id?: string | null;
  projects?: any;
  sheet_name?: string | null;
};

type GrantTarget = {
  kind: GrantKind;
  item_id: string;
  title: string;
  granted_by?: string;
  material_kind?: string | null;
  target_levels?: string[] | null;
};

type GatehouseMaterialRow = {
  id: string;
  title: string;
  material_kind: string | null;
  target_levels: string[] | null;
};

const REQUEST_SELECT =
  "id,user_id,request_number,created_at,processed_at,is_processed,full_name,email,contact_phone,branch_type,class_level,target_level,target_levels,textbook_types,material_kinds,project_id,projects(name, sheet_name)";

const DB_RETRY_COUNT = 1;
const DB_RETRY_DELAY_MS = 350;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: any) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("socket") ||
    msg.includes("network") ||
    msg.includes("terminated")
  );
}

async function runDbQuery<T>(
  factory: () => PromiseLike<{ data: T | null; error: any }>,
  label: string,
) {
  let lastError: any = null;

  for (let attempt = 0; attempt <= DB_RETRY_COUNT; attempt += 1) {
    try {
      const res = await factory();
      if (!res.error) return res;
      lastError = res.error;
      if (!isTransientError(res.error) || attempt === DB_RETRY_COUNT) return res;
    } catch (e: any) {
      lastError = e;
      if (!isTransientError(e) || attempt === DB_RETRY_COUNT) throw e;
    }
    await sleep(DB_RETRY_DELAY_MS * (attempt + 1));
  }
  throw new Error(`${label}: ${String(lastError?.message || lastError || "DB error")}`);
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function applyBranchFilter(q: any, branchFilter: string) {
  if (branchFilter === "gatehouse") return q.eq("branch_type", "gatehouse");
  if (branchFilter === "olympiad") return q.or("branch_type.eq.olympiad,branch_type.is.null");
  return q.eq("branch_type", branchFilter);
}

function applyCursor(q: any, cursorCreatedAt: string) {
  if (!cursorCreatedAt) return q;
  const d = new Date(cursorCreatedAt);
  if (Number.isNaN(d.getTime())) return q;
  return q.lt("created_at", d.toISOString());
}

// ----------------------------------------------------------------------------
// GET: список заявок
// ----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const sp = req.nextUrl.searchParams;
    const status = (sp.get("status") || "all").trim();
    const name = (sp.get("name") || "").trim();
    const email = (sp.get("email") || "").trim();
    const branchFilter = (sp.get("branch_type") || "all").trim();
    const projectId = (sp.get("project_id") || "all").trim();

    const limit = clamp(parsePositiveInt(sp.get("limit"), 10), 1, 30);
    const cursorCreatedAt = String(sp.get("cursor_created_at") || "").trim();

    const makeQuery = () => {
      let q = supabase
        .from("purchase_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (projectId && projectId !== "all") {
        q = q.eq("project_id", projectId);
      } else if (branchFilter && branchFilter !== "all") {
        q = applyBranchFilter(q, branchFilter);
      }

      q = applyCursor(q, cursorCreatedAt);

      if (status === "pending") {
        q = q.or("is_processed.eq.false,is_processed.is.null");
      } else if (status === "processed") {
        q = q.eq("is_processed", true);
      }

      // ✅ Безопасный поиск через ILIKE с экранированием
      if (name) {
        q = q.ilike("full_name", sanitizeLikeQuery(name));
      }
      if (email) {
        q = q.ilike("email", sanitizeLikeQuery(email));
      }

      return q;
    };

    const { data, error } = await runDbQuery<any[]>(makeQuery, "adminRequestsList");

    if (error) return fail(error.message, 500, "DB_ERROR", noStoreInit());

    const rawRows = data ?? [];
    const rows: ReqRow[] = rawRows.map((r: any) => ({
      ...r,
      projects: Array.isArray(r.projects) ? r.projects[0] : r.projects,
      sheet_name: r.projects?.sheet_name || null,
    }));

    const last = rows[rows.length - 1] ?? null;
    const nextCursor =
      rows.length === limit && last?.created_at ? { created_at: last.created_at } : null;

    return ok(
      {
        requests: rows,
        materialsByRequest: {},
        materialsError: null,
        page: {
          limit,
          returned: rows.length,
          hasMore: Boolean(nextCursor),
          nextCursor,
        },
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}

// ----------------------------------------------------------------------------
// PATCH: обработка заявок (process / unprocess)
// ----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: any;

  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.map(String).map((x: string) => x.trim()).filter(Boolean)
    : [];

  const is_processed = Boolean(body?.is_processed);

  if (!ids.length) return fail("ids required", 400, "VALIDATION", noStoreInit());

  try {
    const { data: reqs, error: rErr } = await runDbQuery<ReqRow[]>(
      () =>
        supabase
          .from("purchase_requests")
          .select("*, projects(sheet_name)")
          .in("id", ids),
      "patchLoadRequests",
    );

    if (rErr) return fail(rErr.message, 500, "DB_ERROR", noStoreInit());

    const rows = (reqs ?? []).map((r: any) => ({
      ...r,
      sheet_name: r.projects?.sheet_name || null,
    })) as ReqRow[];

    const results: Record<
      string,
      {
        ok: boolean;
        granted?: string[];
        error?: string;
        sheet?: any;
        grants_history?: any;
      }
    > = {};

    for (const r of rows) {
      try {
        let granted: string[] = [];
        const grantsHistory: any = { ok: true };

        if (is_processed) {
          const { grantedLabels, grantsToStore } = await grantAccessForRequest(supabase, user.id, r);

          const delHistory = await supabase.from("purchase_request_grants").delete().eq("request_id", r.id);
          if (delHistory.error) throw new Error(delHistory.error.message);

          if (grantsToStore.length) {
            const ins = await supabase.from("purchase_request_grants").insert(grantsToStore);
            if (ins.error) throw new Error(ins.error.message);
          }

          granted = grantedLabels;
        } else {
          const targets = await getTargetsForUnprocess(supabase, r);

          for (const rawTarget of targets) {
            const t = await enrichMockTestTargetIfNeeded(supabase, rawTarget);

            if (t.kind === "mock_test" || t.kind === "material") {
              const keepByGrant = await existsOtherProcessedGrant(
                supabase,
                r.id,
                r.user_id,
                t.kind,
                t.item_id,
              );

              const keepByRequest = await existsOtherProcessedGenericRequestForMaterial(
                supabase,
                r.id,
                r.user_id,
                r.branch_type || "olympiad",
                t.material_kind,
                t.target_levels,
              );

              if (keepByGrant || keepByRequest) continue;

              const del = await supabase
                .from("material_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("material_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
              continue;
            }

            const keep = await existsOtherProcessedGrant(
              supabase,
              r.id,
              r.user_id,
              t.kind,
              t.item_id,
            );

            if (keep) continue;

            if (t.kind === "textbook") {
              const del = await supabase
                .from("textbook_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("textbook_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
            } else if (t.kind === "crossword") {
              const del = await supabase
                .from("crossword_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("crossword_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
            }
          }

          const delHistory = await supabase.from("purchase_request_grants").delete().eq("request_id", r.id);
          if (delHistory.error) throw new Error(delHistory.error.message);
        }

        const processed_at = is_processed ? new Date().toISOString() : null;

        const upd = await supabase
          .from("purchase_requests")
          .update({
            is_processed,
            processed_at,
          })
          .eq("id", r.id)
          .select("*")
          .single();

        if (upd.error) throw new Error(upd.error.message);

        const updatedRow = upd.data as any;
        const sheetName = r.sheet_name;

        const sheetValues = buildSheetValues(
          updatedRow.request_number || "",
          updatedRow.created_at || "",
          normalizeBranchType(updatedRow.branch_type),
          updatedRow.class_level,
          getRequestTargetLevels(updatedRow),
          getRequestMaterialKinds(updatedRow),
          updatedRow.email || "",
          updatedRow.full_name || "",
          Boolean(updatedRow.is_processed),
          updatedRow.processed_at ?? null,
        );

        try {
          const sres = await upsertRequestRowByNumber(sheetValues, sheetName);

          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: new Date().toISOString(),
              sheet_row: sres.rowNumber ?? null,
              sheet_sync_error: null,
            })
            .eq("id", updatedRow.id);

          results[r.id] = {
            ok: true,
            granted,
            grants_history: grantsHistory,
            sheet: {
              ok: true,
              action: sres.action,
              row: sres.rowNumber ?? null,
            },
          };
        } catch (e: any) {
          const msg = String(e?.message || e || "Sheets sync error").slice(0, 500);

          await supabase
            .from("purchase_requests")
            .update({
              sheet_synced_at: null,
              sheet_sync_error: msg,
            })
            .eq("id", updatedRow.id);

          results[r.id] = {
            ok: true,
            granted,
            grants_history: grantsHistory,
            sheet: {
              ok: false,
              error: msg,
            },
          };
        }
      } catch (e: any) {
        results[r.id] = {
          ok: false,
          error: e?.message || String(e),
        };
      }
    }

    return ok({ updated: true, results }, noStoreInit());
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}