/* app/api/requests/list/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BranchFilter = "all" | "olympiad" | "gatehouse";
type StatusFilter = "all" | "pending" | "processed";

const REQUEST_SELECT = `
  id,
  user_id,
  request_number,
  request_date,
  created_at,
  updated_at,
  branch_type,
  class_level,
  target_level,
  target_levels,
  textbook_types,
  material_kinds,
  email,
  full_name,
  contact_phone,
  is_processed,
  processed_at,
  sheet_synced_at,
  sheet_row,
  sheet_sync_error
`;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeBranchFilter(value: unknown): BranchFilter {
  const raw = normalizeString(value).toLowerCase();

  if (
    raw === "gatehouse" ||
    raw === "gatehouse_awards" ||
    raw === "ga" ||
    raw === "ga_exam" ||
    raw === "exam" ||
    raw === "exams"
  ) {
    return "gatehouse";
  }

  if (raw === "olympiad" || raw === "olymp" || raw === "олимпиада") {
    return "olympiad";
  }

  return "all";
}

function normalizeStatusFilter(value: unknown): StatusFilter {
  const raw = normalizeString(value).toLowerCase();

  if (raw === "pending" || raw === "wait" || raw === "waiting" || raw === "ожидает") {
    return "pending";
  }

  if (
    raw === "processed" ||
    raw === "done" ||
    raw === "completed" ||
    raw === "обработана" ||
    raw === "обработанные"
  ) {
    return "processed";
  }

  return "all";
}

function parseLimit(value: unknown, fallback = 50) {
  const n = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.max(1, Math.min(n, 100));
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) return [];

    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        return toStringArray(JSON.parse(text));
      } catch {
        return [];
      }
    }

    return text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const single = normalizeString(value);
  return single ? [single] : [];
}

function normalizeRequestRow(row: any) {
  const branchType = normalizeString(row?.branch_type) || "olympiad";

  return {
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    request_number: String(row?.request_number ?? ""),
    request_date: typeof row?.request_date === "string" ? row.request_date : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,

    branch_type: branchType,
    class_level: typeof row?.class_level === "string" ? row.class_level : null,

    target_level: toStringArray(row?.target_level),
    target_levels: toStringArray(row?.target_levels),

    textbook_types: toStringArray(row?.textbook_types),
    material_kinds: toStringArray(row?.material_kinds),

    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    contact_phone: typeof row?.contact_phone === "string" ? row.contact_phone : null,

    is_processed: Boolean(row?.is_processed),
    processed_at: typeof row?.processed_at === "string" ? row.processed_at : null,

    sheet_synced_at: typeof row?.sheet_synced_at === "string" ? row.sheet_synced_at : null,
    sheet_row: typeof row?.sheet_row === "number" ? row.sheet_row : null,
    sheet_sync_error: typeof row?.sheet_sync_error === "string" ? row.sheet_sync_error : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user, profile } = auth as any;

  const searchParams = req.nextUrl.searchParams;

  const branch = normalizeBranchFilter(searchParams.get("branch_type") ?? searchParams.get("branch"));
  const status = normalizeStatusFilter(searchParams.get("status"));
  const limit = parseLimit(searchParams.get("limit"), 50);

  try {
    let query = supabase
      .from("purchase_requests")
      .select(REQUEST_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (branch === "gatehouse") {
      query = query.eq("branch_type", "gatehouse");
    } else if (branch === "olympiad") {
      query = query.or("branch_type.eq.olympiad,branch_type.is.null");
    }

    if (status === "pending") {
      query = query.or("is_processed.eq.false,is_processed.is.null");
    } else if (status === "processed") {
      query = query.eq("is_processed", true);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error.message, 500, "DB_ERROR", noStoreInit());
    }

    const requests = Array.isArray(data) ? data.map(normalizeRequestRow) : [];

    return ok(
      {
        requests,
        profile: profile
          ? {
              id: String(profile.id ?? user.id),
              email: String(profile.email ?? user.email ?? ""),
              full_name: String(profile.full_name ?? ""),
              contact_phone: String(profile.contact_phone ?? ""),
              region: String(profile.region ?? ""),
            }
          : null,
        filters: {
          branch_type: branch,
          status,
          limit,
        },
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}