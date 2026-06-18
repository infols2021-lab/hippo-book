// app/api/projects/[slug]/requests/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

/**
 * GET: получить список заявок текущего пользователя по конкретному проекту.
 * Используется для отображения истории заявок на странице /projects/[slug]/requests.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { slug } = await ctx.params;

  try {
    // 1. Получаем ID проекта по slug
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .single();

    if (projectError || !project) {
      return fail("Проект не найден", 404, "NOT_FOUND");
    }

    // 2. Загружаем заявки пользователя для этого проекта
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки заявок:", error.message);
      return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ requests: data ?? [] });
  } catch (e: any) {
    console.error("Ошибка в GET /api/projects/[slug]/requests:", e);
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}

// POST удалён — создание заявок происходит через единый эндпоинт /api/requests/create
// с передачей project_id и других параметров.