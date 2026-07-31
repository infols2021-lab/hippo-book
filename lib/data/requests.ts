// lib/data/requests.ts
import "server-only";

import type { DataAuthContext } from "@/lib/data/auth";

export type OlympiadPurchaseRequest = {
  id: string;
  request_number: string;
  created_at: string;
  class_level: string;
  textbook_types: string[] | null;
  material_kinds?: string[] | null;
  material_ids?: string[] | null;
  total_price?: number | null;
  email: string;
  full_name: string;
  is_processed: boolean;
  user_id: string;
  branch_type?: string | null;
};

export type GatehousePurchaseRequest = {
  id: string;
  user_id: string;
  request_number: string;
  request_date: string | null;
  created_at: string;
  updated_at: string | null;
  branch_type: "gatehouse";
  class_level: string | null;
  target_level: string[];
  target_levels: string[];
  textbook_types: string[];
  material_kinds: string[];
  material_ids?: string[] | null;
  total_price?: number | null;
  email: string;
  full_name: string;
  contact_phone: string | null;
  is_processed: boolean;
  processed_at: string | null;
};

export type GatehouseRequestProfile = {
  id: string;
  email: string;
  full_name: string;
  contact_phone: string;
  region: string;
};

export type OlympiadRequestsPageData = {
  userId: string;
  userEmail: string;
  userFullName: string;
  requests: OlympiadPurchaseRequest[];
};

export type GatehouseRequestsPageData = {
  profile: GatehouseRequestProfile;
  requests: GatehousePurchaseRequest[];
  error: string | null;
};

export type AggregatedPendingSummary = {
  totalPrice: number;
  materialIds: string[];
  materialCounts: Record<string, number>;
  pendingCount: number;
};

// Универсальная нормализация массивов (поддерживает массивы, JSON-строки и CSV)
function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const str = value.trim();
    if (!str) return [];

    if (str.startsWith("[") && str.endsWith("]")) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
        }
      } catch {}
    }

    return str
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeOlympiadRequest(row: any): OlympiadPurchaseRequest {
  const parsedTypes = normalizeArray(row?.textbook_types);
  const parsedKinds = normalizeArray(row?.material_kinds);
  const parsedIds = normalizeArray(row?.material_ids);

  return {
    id: String(row?.id ?? ""),
    request_number: String(row?.request_number ?? ""),
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    class_level: typeof row?.class_level === "string" ? row.class_level : "",
    textbook_types: parsedTypes.length > 0 ? parsedTypes : null,
    material_kinds: parsedKinds.length > 0 ? parsedKinds : null,
    material_ids: parsedIds.length > 0 ? parsedIds : null,
    total_price: normalizeNumberOrNull(row?.total_price),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    is_processed: Boolean(row?.is_processed),
    user_id: String(row?.user_id ?? ""),
    branch_type: typeof row?.branch_type === "string" ? row.branch_type : null,
  };
}

export function normalizeGatehouseRequest(row: any): GatehousePurchaseRequest {
  return {
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    request_number: String(row?.request_number ?? ""),
    request_date: typeof row?.request_date === "string" ? row.request_date : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
    branch_type: "gatehouse",
    class_level: typeof row?.class_level === "string" ? row.class_level : null,
    target_level: normalizeArray(row?.target_level),
    target_levels: normalizeArray(row?.target_levels),
    textbook_types: normalizeArray(row?.textbook_types),
    material_kinds: normalizeArray(row?.material_kinds),
    material_ids: normalizeArray(row?.material_ids),
    total_price: normalizeNumberOrNull(row?.total_price),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    contact_phone: typeof row?.contact_phone === "string" ? row.contact_phone : null,
    is_processed: Boolean(row?.is_processed),
    processed_at: typeof row?.processed_at === "string" ? row.processed_at : null,
  };
}

/**
 * Агрегирует все необработанные (pending) заявки пользователя:
 * суммирует их общую стоимость и подсчитывает количество повторов каждого материала.
 */
export function aggregatePendingRequests(
  requests: Array<{ is_processed?: boolean | null; total_price?: number | null; material_ids?: string[] | null }>
): AggregatedPendingSummary {
  const pending = requests.filter((r) => !r.is_processed);
  let totalPrice = 0;
  const allMaterialIds: string[] = [];
  const materialCounts: Record<string, number> = {};

  for (const req of pending) {
    totalPrice += Number(req.total_price) || 0;
    const ids = normalizeArray(req.material_ids);
    for (const id of ids) {
      allMaterialIds.push(id);
      materialCounts[id] = (materialCounts[id] || 0) + 1;
    }
  }

  return {
    totalPrice,
    materialIds: allMaterialIds,
    materialCounts,
    pendingCount: pending.length,
  };
}

/**
 * Форматирует название материала с добавлением плашки количества (например, "Hippo 1 (x2)").
 */
export function formatMaterialWithCount(title: string, count: number): string {
  if (count <= 1) return title;
  return `${title} (x${count})`;
}

export async function loadOlympiadRequestsPageData(ctx: DataAuthContext): Promise<OlympiadRequestsPageData> {
  const { supabase, user, profile } = ctx;

  const { data: requestRows, error: requestsError } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("user_id", user.id)
    .or("branch_type.eq.olympiad,branch_type.is.null")
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw new Error(requestsError.message);
  }

  return {
    userId: user.id,
    userEmail: user.email ?? profile?.email ?? "",
    userFullName: profile?.full_name ?? "",
    requests: Array.isArray(requestRows) ? requestRows.map(normalizeOlympiadRequest) : [],
  };
}

export async function loadGatehouseRequestsPageData(ctx: DataAuthContext): Promise<GatehouseRequestsPageData> {
  const { supabase, user, profile } = ctx;

  const { data: requestRows, error: requestsError } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("branch_type", "gatehouse")
    .order("created_at", { ascending: false });

  const requestProfile: GatehouseRequestProfile = {
    id: user.id,
    email: String(profile?.email || user.email || ""),
    full_name: typeof profile?.full_name === "string" ? profile.full_name : "",
    contact_phone: typeof profile?.contact_phone === "string" ? profile.contact_phone : "",
    region: typeof profile?.region === "string" ? profile.region : "",
  };

  return {
    profile: requestProfile,
    requests: Array.isArray(requestRows) ? requestRows.map(normalizeGatehouseRequest) : [],
    error: requestsError?.message ?? null,
  };
}

export async function loadUserPurchaseRequests(
  ctx: DataAuthContext,
  options?: {
    branchType?: "olympiad" | "gatehouse";
  },
) {
  const { supabase, user } = ctx;

  let query = supabase
    .from("purchase_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (options?.branchType === "gatehouse") {
    query = query.eq("branch_type", "gatehouse");
  }

  if (options?.branchType === "olympiad") {
    query = query.or("branch_type.eq.olympiad,branch_type.is.null");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function loadPurchaseRequestByIdForUser(
  ctx: DataAuthContext,
  requestId: string,
) {
  const id = String(requestId || "").trim();
  if (!id) return null;

  const { supabase, user } = ctx;

  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export function isRequestEditable(row: any) {
  return !Boolean(row?.is_processed);
}

export function isGatehouseRequest(row: any) {
  return String(row?.branch_type || "").trim() === "gatehouse";
}

export function isOlympiadRequest(row: any) {
  const branch = String(row?.branch_type || "").trim();
  return !branch || branch === "olympiad";
}