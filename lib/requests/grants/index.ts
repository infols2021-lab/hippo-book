// lib/requests/grants/index.ts
// Логика выдачи и отзыва доступов по заявкам.
// Используется в админке /api/admin/requests.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeBranchType,
  toStringArray,
  uniqueStrings,
  normalizeGatehouseLevel,
  normalizeMaterialKind,
} from "@/lib/materials/normalize";
import { getRequestTargetLevels, getRequestMaterialKinds } from "@/lib/requests/normalize";

// ----------------------------------------------------------------------------
// Типы
// ----------------------------------------------------------------------------

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
  class_level: any;
  target_level: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
  is_processed?: boolean | null;
};

// ----------------------------------------------------------------------------
// Вспомогательные утилиты (переиспользуемые)
// ----------------------------------------------------------------------------

function overlaps(a: string[], b: string[]): boolean {
  const set = new Set(a.map(String));
  return b.some((x) => set.has(String(x)));
}

function overlapsGatehouseLevels(a: string[], b: string[]): boolean {
  const aa = a.map(normalizeGatehouseLevel).filter(Boolean);
  const bb = b.map(normalizeGatehouseLevel).filter(Boolean);
  return overlaps(aa, bb);
}

function normalizeGatehouseMaterialKind(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw === "mock_test" ||
    raw === "mock_tests" ||
    raw === "mock-test" ||
    raw === "mock test" ||
    raw === "мок-тест" ||
    raw === "мок тест" ||
    raw === "пробный тест" ||
    raw === "пробные тесты"
  ) {
    return "mock_test";
  }
  return raw;
}

function normalizeGatehouseMaterialKinds(types: any): string[] {
  return uniqueStrings(
    toStringArray(types).map(normalizeGatehouseMaterialKind).filter(Boolean),
  );
}

function gatehouseMaterialMatchesRequest(
  material: { id: string; title: string; material_kind: string | null; target_levels: string[] | null },
  r: ReqRow,
): boolean {
  const targetLevels = getRequestTargetLevels(r);
  const kinds = getRequestMaterialKinds(r);

  if (!targetLevels.length) return false;

  const materialLevels = Array.isArray(material.target_levels)
    ? material.target_levels.map(String)
    : [];
  const materialKind = normalizeGatehouseMaterialKind(material.material_kind);

  const levelMatches = overlapsGatehouseLevels(materialLevels, targetLevels);
  const kindMatches = kinds.length ? kinds.includes(materialKind) : true;

  return levelMatches && kindMatches;
}

// ----------------------------------------------------------------------------
// Поиск материалов для Gatehouse (legacy)
// ----------------------------------------------------------------------------

export async function findGatehouseMaterialsForRequest(
  supabase: SupabaseClient,
  r: ReqRow,
): Promise<Array<{ id: string; title: string; material_kind: string | null; target_levels: string[] | null }>> {
  const targetLevels = getRequestTargetLevels(r).map(normalizeGatehouseLevel).filter(Boolean);
  const kinds = getRequestMaterialKinds(r);

  if (!targetLevels.length) return [];

  let query = supabase
    .from("materials")
    .select("id,title,material_kind,target_levels")
    .eq("branch_type", "gatehouse")
    .eq("is_active", true)
    .overlaps("target_levels", targetLevels);

  if (kinds.length) {
    query = query.in("material_kind", kinds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const materials = (data ?? []) as Array<{
    id: string;
    title: string;
    material_kind: string | null;
    target_levels: string[] | null;
  }>;

  return materials.filter((m) => gatehouseMaterialMatchesRequest(m, r));
}

// ----------------------------------------------------------------------------
// Выдача доступов для разных типов заявок
// ----------------------------------------------------------------------------

/**
 * Выдача доступов для динамических проектов (project_id задан).
 */
export async function grantDynamicProjectAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  const targetLevels = toStringArray(r.class_level).length
    ? toStringArray(r.class_level)
    : toStringArray(r.target_levels);
  const requestedTabs = toStringArray(r.material_kinds).length
    ? toStringArray(r.material_kinds)
    : toStringArray(r.textbook_types);

  // 1. Получаем все активные табы этого проекта
  const { data: tabsRes, error: tabsError } = await supabase
    .from("project_tabs")
    .select("id, title")
    .eq("project_id", r.project_id)
    .eq("is_active", true);

  if (tabsError) throw new Error(tabsError.message);

  let tabIdsToQuery: string[] = [];

  if (requestedTabs.length > 0) {
    for (const reqTab of requestedTabs) {
      const matched = (tabsRes ?? []).find(
        (t: any) => t.id === reqTab || String(t.title).toLowerCase() === String(reqTab).toLowerCase(),
      );
      if (matched) tabIdsToQuery.push(matched.id);
    }
  } else {
    tabIdsToQuery = (tabsRes ?? []).map((t: any) => t.id);
  }

  if (tabIdsToQuery.length === 0) return { grantedLabels, grantsToStore };

  // 2. Достаем активные материалы по найденным табам
  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, title, material_kind, target_levels, class_levels, project_tab_id")
    .in("project_tab_id", tabIdsToQuery)
    .eq("is_active", true);

  if (matError) throw new Error(matError.message);

  // 3. Мягкая фильтрация (Fuzzy match) уровней
  const userLevels = targetLevels.map((x) => String(x).toLowerCase());

  const matchedMaterials = (materials ?? []).filter((mat) => {
    if (userLevels.length === 0) return true;
    const matLevels = [
      ...toStringArray(mat.target_levels),
      ...toStringArray(mat.class_levels),
    ].map((x) => String(x).toLowerCase());
    if (matLevels.length === 0) return true;
    return matLevels.some((ml) => userLevels.some((ul) => ml === ul || ml.includes(ul) || ul.includes(ml)));
  });

  // 4. Записываем доступы в material_access
  for (const mat of matchedMaterials) {
    const { error: upsertError } = await supabase
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

    if (!upsertError) {
      grantedLabels.push(`📘 ${mat.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "material",
        item_id: mat.id,
        title: mat.title,
        granted_by: adminId,
        granted_at: nowISO,
        material_id: mat.id,
        material_kind: mat.material_kind || "material",
      });
    }
  }

  return { grantedLabels, grantsToStore };
}

/**
 * Выдача доступов для новых веток без привязки к проекту (generic).
 */
export async function grantGenericBranchAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  const targetLevels = toStringArray(r.class_level).length
    ? toStringArray(r.class_level)
    : toStringArray(r.target_levels);
  const kinds = getRequestMaterialKinds(r);

  let query = supabase
    .from("materials")
    .select("id, title, material_kind, target_levels, class_levels")
    .eq("branch_type", r.branch_type)
    .eq("is_active", true);

  if (kinds.length) {
    query = query.in("material_kind", kinds);
  }

  const { data: materials, error } = await query;
  if (error) throw new Error(error.message);

  const userLevels = targetLevels.map((x) => String(x).toLowerCase());

  const matchedMaterials = (materials ?? []).filter((mat) => {
    if (userLevels.length === 0) return true;
    const matLevels = [
      ...toStringArray(mat.target_levels),
      ...toStringArray(mat.class_levels),
    ].map((x) => String(x).toLowerCase());
    if (matLevels.length === 0) return true;
    return matLevels.some((ml) => userLevels.some((ul) => ml === ul || ml.includes(ul) || ul.includes(ml)));
  });

  for (const mat of matchedMaterials) {
    const { error: upsertError } = await supabase
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

    if (!upsertError) {
      grantedLabels.push(`📁 ${mat.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "material",
        item_id: mat.id,
        title: mat.title,
        granted_by: adminId,
        granted_at: nowISO,
        material_id: mat.id,
        branch_type: r.branch_type ?? "olympiad",
        material_kind: mat.material_kind || "material",
      });
    }
  }

  return { grantedLabels: uniqueStrings(grantedLabels), grantsToStore };
}

/**
 * Выдача доступов для legacy-олимпиады (textbook_access / crossword_access).
 */
export async function grantOlympiadAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const classLevels = toStringArray(r.class_level);
  const types = toStringArray(r.textbook_types).map((x) => String(x).toLowerCase());

  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  if (!classLevels.length) return { grantedLabels, grantsToStore };

  // Учебники
  if (types.includes("учебник") || types.includes("textbook")) {
    const { data: textbooks, error } = await supabase
      .from("textbooks")
      .select("id,title,class_level,branch_type")
      .eq("is_active", true)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .overlaps("class_level", classLevels);

    if (error) throw new Error(error.message);

    for (const tb of textbooks ?? []) {
      const { error: upsertError } = await supabase
        .from("textbook_access")
        .upsert(
          {
            user_id: r.user_id,
            textbook_id: tb.id,
            granted_by: adminId,
            granted_at: nowISO,
          },
          { onConflict: "user_id,textbook_id" },
        );

      if (!upsertError) {
        grantedLabels.push(`📚 ${tb.title}`);
        grantsToStore.push({
          request_id: r.id,
          user_id: r.user_id,
          kind: "textbook",
          item_id: tb.id,
          title: tb.title,
          granted_by: adminId,
          granted_at: nowISO,
          branch_type: "olympiad",
          material_id: null,
          material_kind: "textbook",
        });
      }
    }
  }

  // Кроссворды
  if (types.includes("кроссворд") || types.includes("crossword")) {
    const { data: crosswords, error } = await supabase
      .from("crosswords")
      .select("id,title,class_level,branch_type")
      .eq("is_active", true)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .overlaps("class_level", classLevels);

    if (error) throw new Error(error.message);

    for (const cw of crosswords ?? []) {
      const { error: upsertError } = await supabase
        .from("crossword_access")
        .upsert(
          {
            user_id: r.user_id,
            crossword_id: cw.id,
            granted_by: adminId,
            granted_at: nowISO,
          },
          { onConflict: "user_id,crossword_id" },
        );

      if (!upsertError) {
        grantedLabels.push(`🧩 ${cw.title}`);
        grantsToStore.push({
          request_id: r.id,
          user_id: r.user_id,
          kind: "crossword",
          item_id: cw.id,
          title: cw.title,
          granted_by: adminId,
          granted_at: nowISO,
          branch_type: "olympiad",
          material_id: null,
          material_kind: "crossword",
        });
      }
    }
  }

  return { grantedLabels: uniqueStrings(grantedLabels), grantsToStore };
}

/**
 * Выдача доступов для Gatehouse (legacy).
 */
export async function grantGatehouseAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  const materials = await findGatehouseMaterialsForRequest(supabase, r);

  for (const material of materials) {
    const { error: upsertError } = await supabase
      .from("material_access")
      .upsert(
        {
          user_id: r.user_id,
          material_id: material.id,
          granted_by: adminId,
          granted_at: nowISO,
        },
        { onConflict: "user_id,material_id" },
      );

    if (!upsertError) {
      grantedLabels.push(`🎓 ${material.title}`);
      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: "mock_test",
        item_id: material.id,
        title: material.title,
        granted_by: adminId,
        granted_at: nowISO,
        branch_type: "gatehouse",
        material_id: material.id,
        material_kind: normalizeMaterialKind(material.material_kind || "mock_test"),
      });
    }
  }

  return { grantedLabels: uniqueStrings(grantedLabels), grantsToStore };
}

// ----------------------------------------------------------------------------
// Главная функция выдачи доступов (выбор стратегии)
// ----------------------------------------------------------------------------

export async function grantAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  // Приоритет динамическим проектам
  if (r.project_id) {
    return grantDynamicProjectAccessForRequest(supabase, adminId, r);
  }

  const branchType = normalizeBranchType(r.branch_type);

  if (branchType === "gatehouse") {
    return grantGatehouseAccessForRequest(supabase, adminId, r);
  }

  if (branchType === "olympiad") {
    return grantOlympiadAccessForRequest(supabase, adminId, r);
  }

  // Новые ветки (fall-through)
  return grantGenericBranchAccessForRequest(supabase, adminId, r);
}

// ----------------------------------------------------------------------------
// Отзыв доступов (unprocess)
// ----------------------------------------------------------------------------

/**
 * Проверяет, есть ли другая обработанная заявка, которая выдала этот же доступ.
 */
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

/**
 * Проверяет, есть ли другая обработанная заявка, которая выдала доступ к материалу с аналогичными уровнями.
 */
export async function existsOtherProcessedGenericRequestForMaterial(
  supabase: SupabaseClient,
  requestId: string,
  userId: string,
  branchType: string,
  materialKind: string | null | undefined,
  targetLevels: string[] | null | undefined,
): Promise<boolean> {
  const levels = Array.isArray(targetLevels) ? targetLevels.map(String) : [];
  const kind = String(materialKind ?? "").trim();

  if (!levels.length || !kind) return false;

  const { data, error } = await supabase
    .from("purchase_requests")
    .select("id,target_level,target_levels,textbook_types,material_kinds,class_level,is_processed,branch_type")
    .eq("user_id", userId)
    .eq("is_processed", true)
    .eq("branch_type", branchType)
    .neq("id", requestId);

  if (error) return false;

  for (const row of data ?? []) {
    const req = row as ReqRow;
    const rowLevels =
      branchType === "gatehouse"
        ? getRequestTargetLevels(req)
        : [...toStringArray(req.class_level), ...toStringArray(req.target_levels)];
    const rowKinds = getRequestMaterialKinds(req);

    const levelMatches =
      branchType === "gatehouse"
        ? overlapsGatehouseLevels(rowLevels, levels)
        : overlaps(rowLevels, levels);
    const kindMatches = rowKinds.length ? rowKinds.includes(kind) : true;

    if (levelMatches && kindMatches) return true;
  }

  return false;
}

/**
 * Получает список выданных доступов по заявке (для отзыва).
 */
export async function getTargetsForUnprocess(
  supabase: SupabaseClient,
  r: ReqRow,
): Promise<GrantTarget[]> {
  const { data, error } = await supabase
    .from("purchase_request_grants")
    .select("kind,item_id,title,granted_by,material_kind")
    .eq("request_id", r.id);

  if (error) throw new Error(error.message);

  const rows = data ?? [];

  return rows
    .map((x) => ({
      kind: String(x.kind) as GrantKind,
      item_id: String(x.item_id),
      title: String(x.title),
      granted_by: String(x.granted_by || ""),
      material_kind: typeof x.material_kind === "string" ? x.material_kind : null,
    }))
    .filter((x) => x.kind === "textbook" || x.kind === "crossword" || x.kind === "mock_test" || x.kind === "material");
}

/**
 * Обогащает цель отзыва дополнительной информацией (для mock_test/material).
 */
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
 * Отзыв доступов по заявке (unprocess).
 */
export async function revokeAccessForRequest(
  supabase: SupabaseClient,
  r: ReqRow,
): Promise<void> {
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

      const { error: delError } = await supabase
        .from("material_access")
        .delete()
        .eq("user_id", r.user_id)
        .eq("material_id", t.item_id);

      if (delError) throw new Error(delError.message);
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
      const { error: delError } = await supabase
        .from("textbook_access")
        .delete()
        .eq("user_id", r.user_id)
        .eq("textbook_id", t.item_id);

      if (delError) throw new Error(delError.message);
    } else if (t.kind === "crossword") {
      const { error: delError } = await supabase
        .from("crossword_access")
        .delete()
        .eq("user_id", r.user_id)
        .eq("crossword_id", t.item_id);

      if (delError) throw new Error(delError.message);
    }
  }

  // Удаляем историю выдачи
  const { error: delHistory } = await supabase
    .from("purchase_request_grants")
    .delete()
    .eq("request_id", r.id);

  if (delHistory) throw new Error(delHistory.message);
}