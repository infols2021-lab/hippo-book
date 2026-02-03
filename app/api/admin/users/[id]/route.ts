import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id: userId } = await ctx.params;

  try {
    const [
      { data: textbooks, error: tErr },
      { data: crosswords, error: cErr },
      { data: ta, error: taErr },
      { data: ca, error: caErr },
    ] = await Promise.all([
      supabase
        .from("textbooks")
        .select("id,title,class_level,is_active,order_index")
        .eq("is_active", true)
        .order("order_index", { ascending: true }),
      supabase
        .from("crosswords")
        .select("id,title,class_level,is_active,order_index")
        .eq("is_active", true)
        .order("order_index", { ascending: true }),
      supabase.from("textbook_access").select("textbook_id").eq("user_id", userId),
      supabase.from("crossword_access").select("crossword_id").eq("user_id", userId),
    ]);

    const err = tErr || cErr || taErr || caErr;
    if (err) return fail(err.message, 500, "DB_ERROR");

    const selectedTextbookIds = (ta ?? []).map((x: any) => String(x.textbook_id));
    const selectedCrosswordIds = (ca ?? []).map((x: any) => String(x.crossword_id));

    return ok({
      textbooks: textbooks ?? [],
      crosswords: crosswords ?? [],
      selectedTextbookIds,
      selectedCrosswordIds,
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
