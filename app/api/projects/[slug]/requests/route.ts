// app/api/projects/[slug]/requests/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { normalizeOlympiadRequest, normalizeGatehouseRequest } from "@/lib/data/requests";

/**
 * GET: получить список заявок текущего пользователя по конкретному проекту.
 * Поддерживает как новые проекты с project_id, так и легаси-заявки по branch_type.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { slug } = await ctx.params;

  try {
    // 1. Попытка получить ID проекта из таблицы projects
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    // 2. Формируем гибкий фильтр под проект и легаси-ветки
    let query = supabase
      .from("purchase_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const isOlympiad = slug === "olympiad" || !slug;

    if (project?.id) {
      if (isOlympiad) {
        query = query.or(`project_id.eq.${project.id},branch_type.eq.olympiad,branch_type.is.null`);
      } else {
        query = query.or(`project_id.eq.${project.id},branch_type.eq.${slug}`);
      }
    } else {
      if (isOlympiad) {
        query = query.or("branch_type.eq.olympiad,branch_type.is.null");
      } else {
        query = query.eq("branch_type", slug);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Ошибка загрузки заявок:", error.message);
      return fail(error.message, 500, "DB_ERROR");
    }

    // 3. Нормализуем полученные заявки
    const requests = (data ?? []).map((row) => {
      if (slug === "gatehouse" || row.branch_type === "gatehouse") {
        return normalizeGatehouseRequest(row);
      }
      return normalizeOlympiadRequest(row);
    });

    const res = ok({ requests });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (e: any) {
    console.error("Ошибка в GET /api/projects/[slug]/requests:", e);
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}