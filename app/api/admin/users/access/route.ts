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

  try {
    // ❗️ ИСПРАВЛЕНО: Меняем тип на any[], чтобы TypeScript не ругался на формат Supabase PostgrestBuilder
    const promises: any[] = [];

    // ==========================================
    // 1. УМНАЯ СИНХРОНИЗАЦИЯ УЧЕБНИКОВ (LEGACY)
    // ==========================================
    if (body.textbook_ids !== undefined) {
      const targetIds = toUniqueStringArray(body.textbook_ids);
      const { data: current } = await supabase.from("textbook_access").select("textbook_id").eq("user_id", userId);
      const currentIds = (current || []).map((row) => row.textbook_id);

      const toAdd = targetIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !targetIds.includes(id));

      if (toRemove.length > 0) {
        promises.push(supabase.from("textbook_access").delete().eq("user_id", userId).in("textbook_id", toRemove));
      }
      if (toAdd.length > 0) {
        promises.push(
          supabase.from("textbook_access").insert(
            toAdd.map((id) => ({
              user_id: userId,
              textbook_id: id,
              granted_by: user.id,
              granted_at: new Date().toISOString(),
            }))
          )
        );
      }
    }

    // ==========================================
    // 2. УМНАЯ СИНХРОНИЗАЦИЯ КРОССВОРДОВ (LEGACY)
    // ==========================================
    if (body.crossword_ids !== undefined) {
      const targetIds = toUniqueStringArray(body.crossword_ids);
      const { data: current } = await supabase.from("crossword_access").select("crossword_id").eq("user_id", userId);
      const currentIds = (current || []).map((row) => row.crossword_id);

      const toAdd = targetIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !targetIds.includes(id));

      if (toRemove.length > 0) {
        promises.push(supabase.from("crossword_access").delete().eq("user_id", userId).in("crossword_id", toRemove));
      }
      if (toAdd.length > 0) {
        promises.push(
          supabase.from("crossword_access").insert(
            toAdd.map((id) => ({
              user_id: userId,
              crossword_id: id,
              granted_by: user.id,
              granted_at: new Date().toISOString(),
            }))
          )
        );
      }
    }

    // ==========================================
    // 3. УМНАЯ СИНХРОНИЗАЦИЯ МАТЕРИАЛОВ (NEW ARCHITECTURE)
    // ==========================================
    if (body.material_ids !== undefined) {
      const targetIds = toUniqueStringArray(body.material_ids);
      const { data: current } = await supabase.from("material_access").select("material_id").eq("user_id", userId);
      const currentIds = (current || []).map((row) => row.material_id);

      const toAdd = targetIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !targetIds.includes(id));

      if (toRemove.length > 0) {
        promises.push(supabase.from("material_access").delete().eq("user_id", userId).in("material_id", toRemove));
      }
      if (toAdd.length > 0) {
        promises.push(
          supabase.from("material_access").insert(
            toAdd.map((id) => ({
              user_id: userId,
              material_id: id,
              granted_by: user.id,
              granted_at: new Date().toISOString(),
            }))
          )
        );
      }
    }

    // Выполняем все операции параллельно
    if (promises.length > 0) {
      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.error) throw new Error(res.error.message);
      }
    }

    return ok({ saved: true });
  } catch (e: any) {
    console.error("🔴 [ADMIN USER ACCESS] Ошибка сохранения:", e);
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}