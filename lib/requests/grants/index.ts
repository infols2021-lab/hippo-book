// lib/requests/grants/index.ts
// Единая точка бизнес-логики выдачи и отзыва доступов по заявкам.

import type { SupabaseClient } from "@supabase/supabase-js";
import { toStringArray, uniqueStrings, normalizeBranchType } from "@/lib/materials/normalize";
import { getRequestMaterialKinds } from "@/lib/requests/normalize";

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

function overlaps(a: string[], b: string[]): boolean {
  const set = new Set(a.map(String));
  return b.some((x) => set.has(String(x)));
}

export async function grantDynamicProjectAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  const userRawLevels = uniqueStrings([
    ...toStringArray(r.class_level),
    ...toStringArray(r.target_levels),
    ...toStringArray(r.target_level)
  ]).map(x => x.toLowerCase().trim());
    
  const requestedTabs = uniqueStrings([
    ...toStringArray(r.material_kinds),
    ...toStringArray(r.textbook_types)
  ]);

  const [levelsRes, tabsRes] = await Promise.all([
    supabase.from("project_levels").select("code, label").eq("project_id", r.project_id),
    supabase.from("project_tabs").select("id, title").eq("project_id", r.project_id).eq("is_active", true)
  ]);

  if (levelsRes.error) throw new Error(levelsRes.error.message);
  if (tabsRes.error) throw new Error(tabsRes.error.message);

  const validUserLevelCodes = new Set<string>();
  (levelsRes.data || []).forEach((lvl: any) => {
    const code = String(lvl.code).toLowerCase().trim();
    const label = String(lvl.label).toLowerCase().trim();
    if (userRawLevels.includes(code) || userRawLevels.includes(label)) {
      validUserLevelCodes.add(code);
    }
  });

  if (validUserLevelCodes.size === 0) {
    userRawLevels.forEach(x => validUserLevelCodes.add(x));
  }

  let tabIdsToQuery: string[] = [];
  if (requestedTabs.length > 0) {
    for (const reqTab of requestedTabs) {
      const matched = (tabsRes.data || []).find(
        (t: any) => t.id === reqTab || String(t.title).toLowerCase().trim() === String(reqTab).toLowerCase().trim(),
      );
      if (matched) tabIdsToQuery.push(matched.id);
    }
  } else {
    tabIdsToQuery = (tabsRes.data || []).map((t: any) => t.id);
  }

  if (tabIdsToQuery.length === 0) return { grantedLabels, grantsToStore };

  const { data: materials, error: matError } = await supabase
    .from("materials")
    .select("id, title, material_kind, target_levels, class_levels, project_tab_id")
    .in("project_tab_id", tabIdsToQuery)
    .eq("is_active", true);

  if (matError) throw new Error(matError.message);

  const matchedMaterials = (materials || []).filter((mat) => {
    if (validUserLevelCodes.size === 0) return true;

    const matLevels = [
      ...toStringArray(mat.target_levels),
      ...toStringArray(mat.class_levels),
    ].map((x) => String(x).toLowerCase().trim());
    
    if (matLevels.length === 0) return true;

    return matLevels.some((ml) => 
      Array.from(validUserLevelCodes).some((ul) => ml === ul || ml.includes(ul) || ul.includes(ml))
    );
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
      grantedLabels.push(`📘 ${mat.title}`);
      
      // 🚀 ИСПРАВЛЕНИЕ: Обходим легаси-констрейнт БД. Если не textbook/crossword, пишем mock_test
      const safeKind = (mat.material_kind === "textbook" || mat.material_kind === "crossword") 
        ? mat.material_kind 
        : "mock_test";

      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: safeKind as GrantKind, 
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

export async function grantGenericBranchAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  const nowISO = new Date().toISOString();
  const grantedLabels: string[] = [];
  const grantsToStore: GrantResult["grantsToStore"] = [];

  const branchType = normalizeBranchType(r.branch_type);
  const targetLevels = uniqueStrings([
    ...toStringArray(r.class_level),
    ...toStringArray(r.target_levels),
    ...toStringArray(r.target_level)
  ]);
  const kinds = getRequestMaterialKinds(r);

  let query = supabase
    .from("materials")
    .select("id, title, material_kind, target_levels, class_levels")
    .eq("branch_type", branchType)
    .eq("is_active", true);

  if (kinds.length) {
    query = query.in("material_kind", kinds);
  }

  const { data: materials, error } = await query;
  if (error) throw new Error(error.message);

  const userLevels = targetLevels.map((x) => String(x).toLowerCase().trim());

  const matchedMaterials = (materials ?? []).filter((mat) => {
    if (userLevels.length === 0) return true;
    const matLevels = [
      ...toStringArray(mat.target_levels),
      ...toStringArray(mat.class_levels),
    ].map((x) => String(x).toLowerCase().trim());
    
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
      
      const safeKind = (mat.material_kind === "textbook" || mat.material_kind === "crossword") 
        ? mat.material_kind 
        : "mock_test";

      grantsToStore.push({
        request_id: r.id,
        user_id: r.user_id,
        kind: safeKind as GrantKind,
        item_id: mat.id,
        title: mat.title,
        granted_by: adminId,
        granted_at: nowISO,
        material_id: mat.id,
        branch_type: branchType,
        material_kind: mat.material_kind || "material",
      });
    }
  }

  return { grantedLabels: uniqueStrings(grantedLabels), grantsToStore };
}

export async function grantAccessForRequest(
  supabase: SupabaseClient,
  adminId: string,
  r: ReqRow,
): Promise<GrantResult> {
  if (r.project_id) {
    return grantDynamicProjectAccessForRequest(supabase, adminId, r);
  }
  return grantGenericBranchAccessForRequest(supabase, adminId, r);
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
    const rowLevels = [...toStringArray(req.class_level), ...toStringArray(req.target_levels)];
    const rowLevelsNormalized = rowLevels.map(x => String(x).toLowerCase().trim());
    const levelsNormalized = levels.map(x => String(x).toLowerCase().trim());
    
    const rowKinds = getRequestMaterialKinds(req);

    const levelMatches = overlaps(rowLevelsNormalized, levelsNormalized);
    const kindMatches = rowKinds.length ? rowKinds.includes(kind) : true;

    if (levelMatches && kindMatches) return true;
  }

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
  }

  const { error: delHistory } = await supabase
    .from("purchase_request_grants")
    .delete()
    .eq("request_id", r.id);

  if (delHistory) throw new Error(delHistory.message);
}