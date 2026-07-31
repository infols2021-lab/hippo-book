// lib/requests/grants/index.ts
// Единая точка бизнес-логики выдачи и отзыва доступов по заявкам.

import type { SupabaseClient } from "@supabase/supabase-js";
import { toStringArray, uniqueStrings } from "@/lib/materials/normalize";

export type GrantKind = "textbook" | "crossword" | "mock_test" | "material";

export type GrantTarget = {
  kind: GrantKind;
  item_id: string;
  title: string;
  granted_by?: string;
  material_kind?: string | null;
  target_levels?: string[] | null;
};

export type GrantResult = {
  grantedLabels: string[];
  grantsToStore: Array<{
    request_id: string;
    user_id: string;
    kind: GrantKind;
    item_id: string;
    title: string;
    granted_by: string;
    granted_at: string;
    branch_type?: string;
    material_id?: string | null;
    material_kind?: string | null;
  }>;
};

export type ReqRow = {
  id: string;
  user_id: string;
  project_id?: string | null;
  branch_type?: string | null;
  class_level?: any;
  target_level?: any;
  target_levels?: any;
  textbook_types?: any;
  material_kinds?: any;
  material_ids?: any;
  is_processed?: boolean | null;
};

/**
 * Единая функция выдачи доступов строго по material_ids из заявки.
 */
export async function grantAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  // Извлекаем все запрошенные ID из заявки (material_ids, а также резервные поля)
  const requestedIds = uniqueStrings([
    ...toStringArray(r.material_ids),
    ...toStringArray(r.material_kinds).filter((x) => x.includes("-") || x.length > 20),
    ...toStringArray(r.textbook_types).filter((x) => x.includes("-") || x.length > 20),
  ]);

  if (requestedIds.length === 0) {
    return { grantedLabels, grantsToStore };
  }

  // 1. Ищем запрошенные материалы в единой таблице materials
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, material_kind, legacy_source_table, legacy_source_id")
    .in("id", requestedIds);

  const foundMaterialIds = new Set((materials || []).map((m) => m.id));
  const missingIds = requestedIds.filter((id) => !foundMaterialIds.has(id));

  // 2. Ищем оставшиеся ID в легаси-таблице textbooks
  let textbooks: any[] = [];
  if (missingIds.length > 0) {
    const { data: tbData } = await supabase
      .from("textbooks")
      .select("id, title")
      .in("id", missingIds);
    if (tbData) textbooks = tbData;
  }

  // 3. Ищем оставшиеся ID в легаси-таблице crosswords
  const foundTbIds = new Set(textbooks.map((t) => t.id));
  const missingAfterTb = missingIds.filter((id) => !foundTbIds.has(id));

  let crosswords: any[] = [];
  if (missingAfterTb.length > 0) {
    const { data: cwData } = await supabase
      .from("crosswords")
      .select("id, title")
      .in("id", missingAfterTb);
    if (cwData) crosswords = cwData;
  }

  // ---- Выдача для материалов из таблицы materials ----
  for (const mat of materials || []) {
    const { error: upsertErr } = await supabase
      .from("material_access")
      .upsert(
        {
          user_id: r.user_id,
          material_id: mat.id,
          granted_by: adminId,
          granted_at: nowISO,
        },
        { onConflict: "user_id,material_id" },
      );

    // Связка с легаси-таблицами доступов при наличии
    if (mat.legacy_source_table === "textbooks" && mat.legacy_source_id) {
      await supabase
        .from("textbook_access")
        .upsert(
          { user_id: r.user_id, textbook_id: mat.legacy_source_id },
          { onConflict: "user_id,textbook_id" },
        );
    } else if (mat.legacy_source_table === "crosswords" && mat.legacy_source_id) {
      await supabase
        .from("crossword_access")
        .upsert(
          { user_id: r.user_id, crossword_id: mat.legacy_source_id },
          { onConflict: "user_id,crossword_id" },
        );
    }

    if (!upsertErr) {
      grantedLabels.push(`📘 ${mat.title}`);

      const safeKind =
        mat.material_kind === "textbook" || mat.material_kind === "crossword"
          ? mat.material_kind
          : "material";

      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: safeKind as GrantKind,
        item_id: mat.id,
        title: mat.title,
        granted_by: adminId,
        granted_at: nowISO,
        branch_type: r.branch_type || "olympiad",
        material_id: mat.id,
        material_kind: mat.material_kind || "material",
      });
    }
  }

  // ---- Выдача для материалов из легаси-таблицы textbooks ----
  for (const tb of textbooks) {
    const { error: upsertErr } = await supabase
      .from("textbook_access")
      .upsert(
        { user_id: r.user_id, textbook_id: tb.id },
        { onConflict: "user_id,textbook_id" },
      );

    if (!upsertErr) {
      grantedLabels.push(`📚 ${tb.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "textbook",
        item_id: tb.id,
        title: tb.title,
        granted_by: adminId,
        granted_at: nowISO,
        branch_type: r.branch_type || "olympiad",
        material_id: tb.id,
        material_kind: "textbook",
      });
    }
  }

  // ---- Выдача для материалов из легаси-таблицы crosswords ----
  for (const cw of crosswords) {
    const { error: upsertErr } = await supabase
      .from("crossword_access")
      .upsert(
        { user_id: r.user_id, crossword_id: cw.id },
        { onConflict: "user_id,crossword_id" },
      );

    if (!upsertErr) {
      grantedLabels.push(`🧩 ${cw.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "crossword",
        item_id: cw.id,
        title: cw.title,
        granted_by: adminId,
        granted_at: nowISO,
        branch_type: r.branch_type || "olympiad",
        material_id: cw.id,
        material_kind: "crossword",
      });
    }
  }

  return { grantedLabels: uniqueStrings(grantedLabels), grantsToStore };
}

// Алиасы для поддержания совместимости
export async function grantDynamicProjectAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  return grantAccessForRequest(supabase, adminId, r);
}

export async function grantGenericBranchAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  return grantAccessForRequest(supabase, adminId, r);
}

export async function existsOtherProcessedGrant(
  supabase: SupabaseClient,
  requestId: string,
  userId: string,
  kind: GrantKind,
  itemId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("purchase_request_grants")
    .select("request_id, purchase_requests!inner(is_processed)")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("item_id", itemId)
    .neq("request_id", requestId)
    .eq("purchase_requests.is_processed", true)
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

export async function existsOtherProcessedGenericRequestForMaterial(
  _supabase: SupabaseClient,
  _requestId: string,
  _userId: string,
  _branchType: string,
  _materialKind: string | null | undefined,
  _targetLevels: string[] | null | undefined,
): Promise<boolean> {
  return false;
}

export async function getTargetsForUnprocess(
  supabase: SupabaseClient,
  r: ReqRow,
): Promise<GrantTarget[]> {
  const { data, error } = await supabase
    .from("purchase_request_grants")
    .select("kind,item_id,title,granted_by,material_kind")
    .eq("request_id", r.id);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((x) => ({
      kind: String(x.kind) as GrantKind,
      item_id: String(x.item_id),
      title: String(x.title),
      granted_by: String(x.granted_by || ""),
      material_kind: typeof x.material_kind === "string" ? x.material_kind : null,
    }))
    .filter((x) => ["textbook", "crossword", "mock_test", "material"].includes(x.kind));
}

export async function enrichMockTestTargetIfNeeded(
  supabase: SupabaseClient,
  target: GrantTarget,
): Promise<GrantTarget> {
  if (target.kind !== "mock_test" && target.kind !== "material") return target;
  if (target.material_kind && Array.isArray(target.target_levels)) return target;

  const { data, error } = await supabase
    .from("materials")
    .select("id,title,material_kind,target_levels,class_levels")
    .eq("id", target.item_id)
    .maybeSingle();

  if (error || !data) return target;

  return {
    ...target,
    title: target.title || String(data.title || "Материал"),
    material_kind: String(data.material_kind || "mock_test"),
    target_levels: [
      ...(Array.isArray(data.target_levels) ? data.target_levels : []),
      ...(Array.isArray(data.class_levels) ? data.class_levels : []),
    ].map(String),
  };
}

/**
 * Отзыв доступов при отмене обработки заявки.
 */
export async function revokeAccessForRequest(
  supabase: SupabaseClient,
  r: ReqRow,
): Promise<void> {
  const targets = await getTargetsForUnprocess(supabase, r);

  for (const rawTarget of targets) {
    const t = await enrichMockTestTargetIfNeeded(supabase, rawTarget);

    const keepByGrant = await existsOtherProcessedGrant(
      supabase,
      r.id,
      r.user_id,
      t.kind,
      t.item_id,
    );

    if (keepByGrant) continue;

    // Удаление из единой таблицы доступов
    await supabase
      .from("material_access")
      .delete()
      .eq("user_id", r.user_id)
      .eq("material_id", t.item_id);

    // Удаление из легаси-таблиц при наличии
    if (t.kind === "textbook") {
      await supabase
        .from("textbook_access")
        .delete()
        .eq("user_id", r.user_id)
        .eq("textbook_id", t.item_id);
    }

    if (t.kind === "crossword") {
      await supabase
        .from("crossword_access")
        .delete()
        .eq("user_id", r.user_id)
        .eq("crossword_id", t.item_id);
    }
  }

  const { error: delHistory } = await supabase
    .from("purchase_request_grants")
    .delete()
    .eq("request_id", r.id);

  if (delHistory) throw new Error(delHistory.message);
}