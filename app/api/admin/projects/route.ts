// app/api/admin/projects/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { invalidateProjectsCache } from "@/lib/projects/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateProjectInput = {
  slug?: string;
  name?: string;
  description?: string | null;
  theme_color?: string | null;
  fallback_icon?: string | null;
  is_active?: boolean;
  order_index?: number;
  theme?: Record<string, unknown> | null;
  features?: Record<string, unknown> | null;
  ui_texts?: Record<string, unknown> | null;
  sheet_name?: string | null; 
};

type UpdateProjectInput = CreateProjectInput & { id: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-_]*$/i.test(slug);
}

// ---------------------------------------------------------------------------
// GET: список ВСЕХ проектов
// ---------------------------------------------------------------------------
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("order_index", { ascending: true })
    .order("slug", { ascending: true });

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ projects: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST: создать проект
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  let body: CreateProjectInput;
  try {
    body = (await req.json()) as CreateProjectInput;
  } catch {
    return fail("Неверный JSON", 400, "BAD_JSON");
  }

  const slug = (body.slug ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const sheet_name = (body.sheet_name ?? "").trim() || null;

  if (!isNonEmptyString(slug)) return fail("Поле slug обязательно", 400, "MISSING_SLUG");
  if (!isValidSlug(slug)) return fail("slug может содержать только латиницу, цифры, дефис и подчёркивание", 400, "INVALID_SLUG");
  if (!isNonEmptyString(name)) return fail("Поле name обязательно", 400, "MISSING_NAME");

  const insert = {
    slug,
    name,
    description: body.description ?? null,
    theme_color: body.theme_color ?? "#0ea5e9", // Дефолтный премиум-синий
    fallback_icon: body.fallback_icon ?? "📁",
    is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    order_index: typeof body.order_index === "number" ? body.order_index : 0,
    theme: body.theme ?? {}, 
    features: body.features ?? {},
    ui_texts: body.ui_texts ?? {},
    sheet_name,
  };

  const { data, error } = await supabase
    .from("projects")
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return fail(`Проект со slug «${slug}» уже существует`, 409, "DUPLICATE_SLUG");
    return fail(error.message, 500, "DB_ERROR");
  }

  invalidateProjectsCache();
  return ok({ project: data }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH: обновить существующий проект (вкл. ЦВЕТА И ТЕМУ)
// ---------------------------------------------------------------------------
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  let body: UpdateProjectInput;
  try {
    body = (await req.json()) as UpdateProjectInput;
  } catch {
    return fail("Неверный JSON", 400, "BAD_JSON");
  }

  const { id, ...updates } = body;
  if (!id) return fail("ID проекта обязателен", 400, "MISSING_ID");

  const updateData: any = {};
  
  if (updates.slug !== undefined) {
    const slug = updates.slug.trim().toLowerCase();
    if (!isNonEmptyString(slug)) return fail("Поле slug не может быть пустым", 400, "INVALID_SLUG");
    if (!isValidSlug(slug)) return fail("Неверный формат slug", 400, "INVALID_SLUG");
    updateData.slug = slug;
  }
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!isNonEmptyString(name)) return fail("Поле name не может быть пустым", 400, "INVALID_NAME");
    updateData.name = name;
  }
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.theme_color !== undefined) updateData.theme_color = updates.theme_color;
  if (updates.fallback_icon !== undefined) updateData.fallback_icon = updates.fallback_icon;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.order_index !== undefined) updateData.order_index = updates.order_index;
  if (updates.theme !== undefined) updateData.theme = updates.theme;
  if (updates.features !== undefined) updateData.features = updates.features;
  if (updates.ui_texts !== undefined) updateData.ui_texts = updates.ui_texts;
  if (updates.sheet_name !== undefined) updateData.sheet_name = (updates.sheet_name || "").trim() || null;

  const { data, error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return fail(`Проект с таким slug уже существует`, 409, "DUPLICATE_SLUG");
    return fail(error.message, 500, "DB_ERROR");
  }

  invalidateProjectsCache();
  return ok({ project: data });
}