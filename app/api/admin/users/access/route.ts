// app/api/admin/users/access/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { isValidUUID } from "@/lib/api/validate";
import type { NextRequest } from "next/server";

type Body = {
  user_id: string;
  material_ids?: string[];
};

function toUniqueStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        // ✅ Фильтруем только валидные UUID
        .filter((id) => isValidUUID(id))
    )
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

  // ✅ Валидация userId
  if (!userId || !isValidUUID(userId)) {
    return fail("Некорректный user_id", 400, "VALIDATION");
  }

  try {
    const promises: any[] = [];

    // ==========================================
    // СИНХРОНИЗАЦИЯ ДОСТУПОВ К МАТЕРИАЛАМ (NEW ARCHITECTURE)
    // ==========================================
    if (body.material_ids !== undefined) {
      const targetIds = toUniqueStringArray(body.material_ids);
      const { data: current } = await supabase
        .from("material_access")
        .select("material_id")
        .eq("user_id", userId);
      const currentIds = (current || []).map((row) => row.material_id);

      const toAdd = targetIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !targetIds.includes(id));

      if (toRemove.length > 0) {
        promises.push(
          supabase
            .from("material_access")
            .delete()
            .eq("user_id", userId)
            .in("material_id", toRemove)
        );
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