// app/api/admin/requests/sync-sheet/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  appendAccountingRow,
  deleteAccountingRows,
  getSheetRequestRowMap,
  updateAccountingRow,
} from "@/lib/integrations/googleSheets";
import {
  normalizeBranchType,
  toArr,
  uniq,
  buildSheetValues,
  type SelectedMaterialItem,
} from "@/lib/requests/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function equalRow(a: (string | number)[], b: string[]) {
  const max = Math.max(a.length, b.length, 8);
  for (let i = 0; i < max; i += 1) {
    const av = norm(a[i]);
    const bv = norm(b[i]);
    if (av !== bv) return false;
  }
  return true;
}

/**
 * Группирует заявки по имени листа (sheet_name) и возвращает мапу:
 *   sheetName -> { requests: [], dbSet: Set<string> }
 */
function groupRequestsBySheet(rows: any[]): Map<string, { requests: any[]; dbSet: Set<string> }> {
  const groups = new Map<string, { requests: any[]; dbSet: Set<string> }>();

  for (const r of rows) {
    const sheetName = r.sheet_name || null;
    const key = sheetName ?? "default";

    if (!groups.has(key)) {
      groups.set(key, { requests: [], dbSet: new Set<string>() });
    }

    const group = groups.get(key)!;
    group.requests.push(r);
    const rn = norm(r.request_number);
    if (rn) group.dbSet.add(rn);
  }

  return groups;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") || body?.limit || 500), 1), 2000);
  const dryRun = sp.get("dryRun") === "true" || body?.dryRun === true;

  try {
    // 1. Загружаем все заявки с информацией о проекте (sheet_name)
    const { data, error } = await supabase
      .from("purchase_requests")
      .select(
        `
        id,
        request_number,
        created_at,
        branch_type,
        class_level,
        target_level,
        target_levels,
        textbook_types,
        material_kinds,
        material_ids,
        total_price,
        email,
        full_name,
        contact_phone,
        is_processed,
        processed_at,
        sheet_synced_at,
        sheet_row,
        sheet_sync_error,
        project_id,
        projects ( sheet_name )
      `
      )
      .order("created_at", { ascending: true });

    if (error) return fail(error.message, 500, "DB_ERROR", noStoreInit());

    const rawRows = data ?? [];

    // 2. Предзагружаем все материалы пакетом по всем material_ids из датасета
    const allMaterialIds = uniq(rawRows.flatMap((r: any) => toArr(r.material_ids)));
    const materialsMap = new Map<string, SelectedMaterialItem>();

    if (allMaterialIds.length > 0) {
      const { data: fetchedMaterials } = await supabase
        .from("materials")
        .select("id, title, price, material_kind")
        .in("id", allMaterialIds);

      if (Array.isArray(fetchedMaterials)) {
        fetchedMaterials.forEach((m: any) => {
          materialsMap.set(String(m.id), {
            id: String(m.id),
            title: String(m.title || "Материал"),
            price: Number(m.price || 1000),
            material_kind: m.material_kind ? String(m.material_kind) : undefined,
          });
        });
      }
    }

    const rows = rawRows.map((r: any) => ({
      ...r,
      sheet_name: r.projects?.sheet_name || null,
    }));

    // 3. Группируем по sheet_name
    const groups = groupRequestsBySheet(rows);

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let unchanged = 0;
    let skipped = 0;
    let failed = 0;
    let ops = 0;

    const dryRunReport: any = {
      groups: [],
      total: { inserted, updated, deleted, unchanged, skipped, failed },
    };

    for (const [sheetKey, group] of groups.entries()) {
      const sheetName = sheetKey === "default" ? null : sheetKey;

      const sheetMap = dryRun
        ? await getSheetRequestRowMap(sheetName).catch(() => new Map())
        : await getSheetRequestRowMap(sheetName);

      const { requests, dbSet } = group;

      const groupReport = {
        sheetName: sheetName || "default",
        operations: [] as string[],
        inserted: 0,
        updated: 0,
        deleted: 0,
        unchanged: 0,
        skipped: 0,
        failed: 0,
      };

      for (const r of requests) {
        if (ops >= limit) break;

        const rn = norm(r.request_number);

        if (!rn) {
          skipped += 1;
          groupReport.skipped += 1;
          continue;
        }

        // Вычисляем список выбранных материалов
        const mIds = toArr(r.material_ids);
        let selectedMaterials: SelectedMaterialItem[] = [];

        if (mIds.length > 0) {
          selectedMaterials = mIds
            .map((id) => materialsMap.get(id))
            .filter((m): m is SelectedMaterialItem => Boolean(m));
        }

        // Фоллбэк для старых заявок без material_ids
        if (selectedMaterials.length === 0) {
          const fallbackKinds = toArr(r.material_kinds).length
            ? toArr(r.material_kinds)
            : toArr(r.textbook_types);

          selectedMaterials = fallbackKinds.map((k) => ({
            id: k,
            title: k,
            price: 0,
          }));
        }

        const totalPrice =
          typeof r.total_price === "number" && r.total_price >= 0
            ? r.total_price
            : selectedMaterials.reduce((acc, m) => acc + m.price, 0);

        const sheetValues = buildSheetValues(
          r.request_number || "",
          r.created_at || "",
          normalizeBranchType(r.branch_type),
          r.class_level,
          toArr(r.target_levels).length ? toArr(r.target_levels) : toArr(r.target_level),
          selectedMaterials,
          totalPrice,
          r.email || "",
          r.full_name || "",
          Boolean(r.is_processed),
          r.processed_at ?? null
        );

        const existing = sheetMap.get(rn);

        try {
          if (!existing) {
            if (!dryRun) {
              const res = await appendAccountingRow(sheetValues, sheetName);
              const rowNumber = res.rowNumber ?? null;
              await supabase
                .from("purchase_requests")
                .update({
                  sheet_synced_at: new Date().toISOString(),
                  sheet_row: rowNumber,
                  sheet_sync_error: null,
                })
                .eq("id", r.id);
              if (rowNumber) {
                sheetMap.set(rn, {
                  rowNumber,
                  values: sheetValues.map((x) => norm(x)),
                });
              }
            }
            inserted += 1;
            ops += 1;
            groupReport.inserted += 1;
            groupReport.operations.push(`INSERT ${rn} -> ${sheetName || "default"}`);
          } else if (!equalRow(sheetValues, existing.values)) {
            if (!dryRun) {
              await updateAccountingRow(existing.rowNumber, sheetValues, sheetName);
              await supabase
                .from("purchase_requests")
                .update({
                  sheet_synced_at: new Date().toISOString(),
                  sheet_row: existing.rowNumber,
                  sheet_sync_error: null,
                })
                .eq("id", r.id);
            }
            updated += 1;
            ops += 1;
            groupReport.updated += 1;
            groupReport.operations.push(
              `UPDATE ${rn} (row ${existing.rowNumber}) -> ${sheetName || "default"}`
            );
          } else {
            if (
              !dryRun &&
              (!r.sheet_synced_at ||
                r.sheet_row !== existing.rowNumber ||
                r.sheet_sync_error)
            ) {
              await supabase
                .from("purchase_requests")
                .update({
                  sheet_synced_at: new Date().toISOString(),
                  sheet_row: existing.rowNumber,
                  sheet_sync_error: null,
                })
                .eq("id", r.id);
            }
            unchanged += 1;
            groupReport.unchanged += 1;
          }
        } catch (e: any) {
          failed += 1;
          groupReport.failed += 1;
          if (!dryRun) {
            await supabase
              .from("purchase_requests")
              .update({
                sheet_synced_at: null,
                sheet_sync_error: String(e?.message || e || "Sheets sync error").slice(
                  0,
                  500
                ),
              })
              .eq("id", r.id);
          }
          groupReport.operations.push(`FAIL ${rn}: ${e?.message || "unknown error"}`);
        }
      }

      // 4. Удаляем лишние строки из листа (которых нет в БД)
      if (ops < limit) {
        const toDelete: number[] = [];
        for (const [rn, info] of sheetMap.entries()) {
          if (!dbSet.has(rn)) toDelete.push(info.rowNumber);
        }
        toDelete.sort((a, b) => b - a);

        const canDelete = Math.max(0, limit - ops);
        const slice = toDelete.slice(0, canDelete);

        if (slice.length) {
          if (!dryRun) {
            const res = await deleteAccountingRows(slice, sheetName);
            deleted += res.deleted;
            ops += res.deleted;
          } else {
            deleted += slice.length;
            ops += slice.length;
          }
          groupReport.deleted += slice.length;
          groupReport.operations.push(
            `DELETE ${slice.length} rows from ${sheetName || "default"}`
          );
        }
      }

      dryRunReport.groups.push(groupReport);
    }

    dryRunReport.total = { inserted, updated, deleted, unchanged, skipped, failed };

    if (dryRun) {
      return ok(
        {
          dryRun: true,
          report: dryRunReport,
          summary: { inserted, updated, deleted, unchanged, skipped, failed, limit, ops },
        },
        noStoreInit()
      );
    }

    return ok(
      {
        inserted,
        updated,
        deleted,
        unchanged,
        skipped,
        failed,
        limit,
        ops,
      },
      noStoreInit()
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}