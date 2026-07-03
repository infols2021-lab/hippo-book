// app/api/admin/projects/[id]/levels/route.ts
// ADMIN: управление уровнями проекта (GET список / POST upsert / DELETE по id).

import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { invalidateProjectsCache } from "@/lib/projects/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LevelInput = {
  id?: string;
  code?: string;
  label?: string;
  short_label?: string | null;
  level_group?: string | null;
  order_index?: number;
  description?: string | null;
  is_active?: boolean;
  price?: number | null;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function cleanObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Проверка, что проект существует. */
async function projectExists(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  id: string,
) {
  const { data, error } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

// GET: список уровней проекта
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id } = await params;

  try {
    if (!(await projectExists(supabase, id))) {
      return fail("Проект не найден", 404, "NOT_FOUND");
    }
  } catch (e: any) {
    return fail(e?.message || "DB error", 500, "DB_ERROR");
  }

  const { data, error } = await supabase
    .from("project_levels")
    .select("*")
    .eq("project_id", id)
    .order("order_index", { ascending: true })
    .order("code", { ascending: true });

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ levels: data ?? [] });
}

// POST: создать или обновить уровень (upsert по id, если есть)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id: projectId } = await params;

  let body: LevelInput;
  try {
    body = await req.json();
  } catch {
    return fail("Неверный JSON", 400, "BAD_JSON");
  }

  try {
    if (!(await projectExists(supabase, projectId))) {
      return fail("Проект не найден", 404, "NOT_FOUND");
    }
  } catch (e: any) {
    return fail(e?.message || "DB error", 500, "DB_ERROR");
  }

  const code = (body.code ?? "").trim();
  const label = (body.label ?? "").trim();

  if (!isNonEmptyString(code)) {
    return fail("Поле code обязательно", 400, "MISSING_CODE");
  }
  if (!isNonEmptyString(label)) {
    return fail("Поле label обязательно", 400, "MISSING_LABEL");
  }

  const payload = cleanObject({
    project_id: projectId,
    code,
    label,
    short_label: body.short_label ?? null,
    level_group: body.level_group ?? null,
    order_index: typeof body.order_index === "number" ? body.order_index : 0,
    description: body.description ?? null,
    is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    price: typeof body.price === "number" ? body.price : null,
  });

  if (isNonEmptyString(body.id)) {
    const { data, error } = await supabase
      .from("project_levels")
      .update(payload)
      .eq("id", body.id)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return fail(`Уровень с кодом «${code}» уже существует в этом проекте`, 409, "DUPLICATE_CODE");
      }
      return fail(error.message, 500, "DB_ERROR");
    }

    invalidateProjectsCache();
    return ok({ level: data });
  }

  const { data, error } = await supabase
    .from("project_levels")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail(`Уровень с кодом «${code}» уже существует в этом проекте`, 409, "DUPLICATE_CODE");
    }
    return fail(error.message, 500, "DB_ERROR");
  }

  invalidateProjectsCache();
  return ok({ level: data }, { status: 201 });
}

// DELETE: удалить уровень (по ?id=...)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id: projectId } = await params;
  const url = new URL(req.url);
  const levelId = url.searchParams.get("id");

  if (!levelId) {
    return fail("Нужен параметр ?id= (id уровня)", 400, "MISSING_ID");
  }

  const { error } = await supabase
    .from("project_levels")
    .delete()
    .eq("id", levelId)
    .eq("project_id", projectId);

  if (error) return fail(error.message, 500, "DB_ERROR");

  invalidateProjectsCache();
  return ok({ deleted: true, id: levelId });
}