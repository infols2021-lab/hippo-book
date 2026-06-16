import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
// Убедись, что этот импорт существует в твоем проекте. Если нет — просто удали его и вызовы invalidateProjectsCache()
import { invalidateProjectsCache } from "@/lib/projects/loader"; 

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TabInput = {
  id?: string;
  slug?: string;
  title?: string;
  component_type?: string;
  material_kind?: string | null;
  icon?: string | null;
  order_index?: number;
  is_active?: boolean;
  is_hidden?: boolean;
  features?: Record<string, unknown> | null;
  ui_texts?: Record<string, unknown> | null;
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
async function projectExists(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>, id: string) {
  const { data, error } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

// GET: список табов проекта
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
    .from("project_tabs")
    .select("*")
    .eq("project_id", id)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("slug", { ascending: true });

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ tabs: data ?? [] });
}

// POST: создать или обновить таб (upsert по id, если есть)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id: projectId } = await params;

  let body: TabInput;
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

  const slug = (body.slug ?? "").trim();
  const title = (body.title ?? "").trim();

  if (!isNonEmptyString(slug)) {
    return fail("Поле slug обязательно", 400, "MISSING_SLUG");
  }
  if (!isNonEmptyString(title)) {
    return fail("Поле title обязательно", 400, "MISSING_TITLE");
  }

  const payload = cleanObject({
    project_id: projectId,
    slug,
    title,
    component_type: body.component_type ?? "materials",
    material_kind: body.material_kind ?? null,
    icon: body.icon ?? null,
    order_index: typeof body.order_index === "number" ? body.order_index : 0,
    is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    is_hidden: typeof body.is_hidden === "boolean" ? body.is_hidden : false,
    features: body.features ?? {},
    ui_texts: body.ui_texts ?? {},
  });

  if (isNonEmptyString(body.id)) {
    // UPDATE
    const { data, error } = await supabase
      .from("project_tabs")
      .update(payload)
      .eq("id", body.id)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return fail(`Таб со slug «${slug}» уже существует в этом проекте`, 409, "DUPLICATE_SLUG");
      }
      return fail(error.message, 500, "DB_ERROR");
    }

    try { invalidateProjectsCache(); } catch(e) {}
    return ok({ tab: data });
  }

  // INSERT
  const { data, error } = await supabase
    .from("project_tabs")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail(`Таб со slug «${slug}» уже существует в этом проекте`, 409, "DUPLICATE_SLUG");
    }
    return fail(error.message, 500, "DB_ERROR");
  }

  try { invalidateProjectsCache(); } catch(e) {}
  return ok({ tab: data }, { status: 201 });
}

// DELETE: удалить таб (по ?id=...)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id: projectId } = await params;
  const url = new URL(req.url);
  const tabId = url.searchParams.get("id");

  if (!tabId) {
    return fail("Нужен параметр ?id= (id таба)", 400, "MISSING_ID");
  }

  const { error } = await supabase
    .from("project_tabs")
    .delete()
    .eq("id", tabId)
    .eq("project_id", projectId);

  if (error) {
    if (error.code === "23503") {
      return fail(
        "Невозможно удалить таб: есть связанные материалы или задания. Сначала удалите их.",
        409,
        "HAS_REFERENCES",
      );
    }
    return fail(error.message, 500, "DB_ERROR");
  }

  try { invalidateProjectsCache(); } catch(e) {}
  return ok({ deleted: true, id: tabId });
}