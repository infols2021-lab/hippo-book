import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

// Получить список заявок текущего юзера по конкретному проекту
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const { slug } = await ctx.params;

  try {
    // Находим ID проекта
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!project) return fail("Проект не найден", 404, "NOT_FOUND");

    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (error) return fail(error.message, 500, "DB_ERROR");

    return ok({ requests: data ?? [] });
  } catch (e: any) {
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}

// Создать новую заявку
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase, user, profile } = auth;
  const { slug } = await ctx.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Неверный формат JSON", 400, "BAD_JSON");
  }

  try {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!project) return fail("Проект не найден", 404, "NOT_FOUND");

    // Читаем данные из фронта (универсальный подход)
    const request_number = body.request_number || `REQ-${Date.now()}`;
    const level_code = String(body.level_code ?? "").trim();
    const requested_tabs = Array.isArray(body.requested_tabs) ? body.requested_tabs : []; // Массив ID табов, которые нужны юзеру

    if (!level_code) return fail("Необходимо выбрать уровень", 400, "VALIDATION");

    // Универсальный payload (адаптируй под свою структуру, если поля называются чуть иначе)
    const payload = {
      user_id: user.id,
      project_id: project.id,
      request_number,
      target_levels: [level_code], 
      class_level: level_code, // Фоллбэк для обратной совместимости, пока легаси не удалено
      material_kinds: requested_tabs, // Сохраняем запрошенные табы (для автовыдачи)
      email: profile?.email || user.email,
      full_name: profile?.full_name || "Не указано",
      is_processed: false,
    };

    const { data, error } = await supabase
      .from("requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500, "DB_ERROR");

    return ok({ request: data });
  } catch (e: any) {
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}