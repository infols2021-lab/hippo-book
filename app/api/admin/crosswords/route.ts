import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from("crosswords")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return fail(error.message, 500, "DB_ERROR");
    return ok({ crosswords: data ?? [] });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const class_level = Array.isArray(body?.class_level) ? body.class_level.map(String) : [];
  const order_index = Number.isFinite(Number(body?.order_index)) ? Number(body.order_index) : 0;
  const is_available = Boolean(body?.is_available);
  const cover_image_url = body?.cover_image_url ? String(body.cover_image_url) : null;

  if (!title) return fail("title required", 400, "VALIDATION");
  if (!class_level.length) return fail("class_level required", 400, "VALIDATION");

  const payload: any = {
    title,
    description,
    class_level,
    order_index,
    is_available,
    is_active: true,
    created_by: user.id,
  };
  if (cover_image_url) payload.cover_image_url = cover_image_url;

  const { data, error } = await supabase.from("crosswords").insert(payload).select("*").single();
  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ crossword: data });
}
