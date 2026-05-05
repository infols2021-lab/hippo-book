// app/api/admin/requests/stats/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function applyBranchFilter(q: any, branchFilter: string) {
  if (branchFilter === "gatehouse") return q.eq("branch_type", "gatehouse");
  if (branchFilter === "olympiad") return q.or("branch_type.eq.olympiad,branch_type.is.null");
  return q;
}

async function countRequests(supabase: any, branchFilter: string, status: "all" | "pending" | "processed") {
  let q = supabase.from("purchase_requests").select("id", { count: "exact", head: true });

  q = applyBranchFilter(q, branchFilter);

  if (status === "pending") {
    q = q.or("is_processed.eq.false,is_processed.is.null");
  }

  if (status === "processed") {
    q = q.eq("is_processed", true);
  }

  const { count, error } = await q;

  if (error) throw new Error(error.message);

  return count ?? 0;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const branchFilter = (req.nextUrl.searchParams.get("branch_type") || "all").trim();

    const [total, pending, processed] = await Promise.all([
      countRequests(supabase, branchFilter, "all"),
      countRequests(supabase, branchFilter, "pending"),
      countRequests(supabase, branchFilter, "processed"),
    ]);

    return ok({
      stats: {
        total,
        pending,
        processed,
      },
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}