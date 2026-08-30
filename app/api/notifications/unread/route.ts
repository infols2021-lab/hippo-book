import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return fail("Unauthorized", 401, "UNAUTHORIZED");

  const projectSlug = req.nextUrl.searchParams.get("project");
  let q = supabase.from("user_notifications").select("*").eq("user_id", authData.user.id).is("read_at", null).order("created_at", { ascending: false });
  if (projectSlug) q = q.eq("project_slug", projectSlug);
  const { data, error } = await q;
  if (error) return fail(error.message, 500, "DB_ERROR");
  return ok({ notifications: data || [] });
}
