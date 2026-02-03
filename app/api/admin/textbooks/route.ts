import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  try {
    // ✅ Новые сверху: order_index DESC, потом created_at DESC (если есть)
    const q = supabase.from("textbooks").select("*").order("order_index", { ascending: false });

    // created_at может быть, а может нет — если нет, supabase вернёт ошибку
    // поэтому безопаснее не добавлять order(created_at) тут.
    // Если у тебя в таблице есть created_at — скажи, и я включу второй порядок.
    const { data, error } = await q;

    if (error) return fail(error.message, 500, "DB_ERROR");
    return ok({ textbooks: data ?? [] });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function POST(req: NextRequest) {
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

  const { data, error } = await supabase.from("textbooks").insert(payload).select("*").single();
  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ textbook: data });
}
