import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Получаем единственный активный демо-материал
    const { data: material, error: matError } = await supabase
      .from("materials")
      .select("*")
      .eq("is_demo", true)
      .eq("is_active", true)
      .maybeSingle();

    if (matError) {
      return fail(matError.message, 500, "DB_ERROR");
    }

    if (!material) {
      return fail("Демо-материал не найден", 404, "NOT_FOUND");
    }

    // 2. Получаем все задания для этого демо-материала
    const { data: assignments, error: assignError } = await supabase
      .from("assignments")
      .select("*")
      .or(`material_id.eq.${material.id},textbook_id.eq.${material.id},crossword_id.eq.${material.id}`)
      .order("order_index", { ascending: true });

    if (assignError) {
      return fail(assignError.message, 500, "DB_ERROR");
    }

    return ok({
      material,
      assignments: assignments || [],
    });
  } catch (e: any) {
    return fail(e?.message || "Internal Server Error", 500, "SERVER_ERROR");
  }
}