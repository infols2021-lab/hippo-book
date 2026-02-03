import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

type Body = {
  user_id: string;
  textbook_ids?: string[];
  crossword_ids?: string[];
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const userId = String(body?.user_id || "").trim();
  if (!userId) return fail("user_id required", 400, "VALIDATION");

  const textbookIds = Array.isArray(body.textbook_ids) ? body.textbook_ids.map(String) : [];
  const crosswordIds = Array.isArray(body.crossword_ids) ? body.crossword_ids.map(String) : [];

  try {
    // 1) чистим старые доступы
    const [{ error: dt }, { error: dc }] = await Promise.all([
      supabase.from("textbook_access").delete().eq("user_id", userId),
      supabase.from("crossword_access").delete().eq("user_id", userId),
    ]);

    if (dt) return fail(dt.message, 500, "DB_ERROR");
    if (dc) return fail(dc.message, 500, "DB_ERROR");

    // 2) вставляем новые
    if (textbookIds.length) {
      const { error } = await supabase.from("textbook_access").insert(
        textbookIds.map((id) => ({
          user_id: userId,
          textbook_id: id,
        }))
      );
      if (error) return fail(error.message, 500, "DB_ERROR");
    }

    if (crosswordIds.length) {
      const { error } = await supabase.from("crossword_access").insert(
        crosswordIds.map((id) => ({
          user_id: userId,
          crossword_id: id,
        }))
      );
      if (error) return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ saved: true });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
