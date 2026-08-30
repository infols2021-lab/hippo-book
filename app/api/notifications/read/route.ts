import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return fail("Unauthorized", 401, "UNAUTHORIZED");

  let id: string | null = null;
  try {
    const body = await req.json();
    id = typeof body?.id === "string" && body.id ? String(body.id) : null;
  } catch {
    /* ignore */
  }

  if (!id) return fail("id required", 400, "VALIDATION");

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .is("read_at", null);

  if (error) return fail(error.message, 500, "DB_ERROR");
  return ok({ success: true });
}
