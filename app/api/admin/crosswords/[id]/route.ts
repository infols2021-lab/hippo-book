// app/api/admin/crosswords/[id]/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { id } = await ctx.params;

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
  const cover_image_url =
    body?.cover_image_url === "" || body?.cover_image_url == null ? null : String(body.cover_image_url);

  if (!title) return fail("title required", 400, "VALIDATION");
  if (!class_level.length) return fail("class_level required", 400, "VALIDATION");

  const payload: any = {
    title,
    description,
    class_level,
    order_index,
    is_available,
    cover_image_url,
  };

  const { data, error } = await supabase
    .from("crosswords")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ crossword: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { id } = await ctx.params;

  // (опционально) сначала можно удалить задания кроссворда, если FK не CASCADE:
  // await supabase.from("assignments").delete().eq("crossword_id", id);

  const { error } = await supabase.from("crosswords").delete().eq("id", id);
  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ deleted: true });
}
