// app/api/admin/requests/stats/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function applyBranchFilter(q: any, branchFilter: string) {
  if (!branchFilter || branchFilter === "all") return q;
  if (branchFilter === "gatehouse") return q.eq("branch_type", "gatehouse");
  if (branchFilter === "olympiad") return q.or("branch_type.eq.olympiad,branch_type.is.null");
  
  // Для новых веток (в том числе динамических названий проектов)
  return q.eq("branch_type", branchFilter);
}

async function countRequests(
  supabase: any, 
  branchFilter: string, 
  projectId: string, 
  status: "all" | "pending" | "processed"
) {
  let q = supabase.from("purchase_requests").select("id", { count: "exact", head: true });

  // Если передан ID проекта, фильтруем строго по нему, иначе по названию ветки
  if (projectId && projectId !== "all") {
    q = q.eq("project_id", projectId);
  } else {
    q = applyBranchFilter(q, branchFilter);
  }

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
    const projectId = (req.nextUrl.searchParams.get("project_id") || "all").trim();

    // Запрашиваем статистику параллельно
    const [total, pending, processed] = await Promise.all([
      countRequests(supabase, branchFilter, projectId, "all"),
      countRequests(supabase, branchFilter, projectId, "pending"),
      countRequests(supabase, branchFilter, projectId, "processed"),
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