import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

type Body = {
  user_id: string;
  textbook_ids?: string[];
  crossword_ids?: string[];
  material_ids?: string[];
};

function toUniqueStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const userId = String(body?.user_id || "").trim();

  if (!userId) return fail("user_id required", 400, "VALIDATION");

  const textbookIds = toUniqueStringArray(body.textbook_ids);
  const crosswordIds = toUniqueStringArray(body.crossword_ids);
  const materialIds = toUniqueStringArray(body.material_ids);

  try {
    const [{ error: dt }, { error: dc }, { error: dm }] = await Promise.all([
      supabase.from("textbook_access").delete().eq("user_id", userId),
      supabase.from("crossword_access").delete().eq("user_id", userId),
      supabase.from("material_access").delete().eq("user_id", userId),
    ]);

    if (dt) return fail(dt.message, 500, "DB_ERROR");
    if (dc) return fail(dc.message, 500, "DB_ERROR");
    if (dm) return fail(dm.message, 500, "DB_ERROR");

    if (textbookIds.length) {
      const { error } = await supabase.from("textbook_access").insert(
        textbookIds.map((id) => ({
          user_id: userId,
          textbook_id: id,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
        })),
      );

      if (error) return fail(error.message, 500, "DB_ERROR");
    }

    if (crosswordIds.length) {
      const { error } = await supabase.from("crossword_access").insert(
        crosswordIds.map((id) => ({
          user_id: userId,
          crossword_id: id,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
        })),
      );

      if (error) return fail(error.message, 500, "DB_ERROR");
    }

    if (materialIds.length) {
      const { error } = await supabase.from("material_access").insert(
        materialIds.map((id) => ({
          user_id: userId,
          material_id: id,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
        })),
      );

      if (error) return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ saved: true });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}