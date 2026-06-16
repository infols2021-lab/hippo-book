// app/api/admin/projects/route.ts
// ADMIN: список всех проектов (включая неактивные) + создание нового.

import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { invalidateProjectsCache } from "@/lib/projects/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Минимальный набор полей для создания проекта.
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
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** slug должен быть безопасным: латиница/цифры/дефис/подчёркивание. */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-_]*$/i.test(slug);
}

// ---------------------------------------------------------------------------
// GET: список ВСЕХ проектов (админ видит и неактивные)
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

  if (!isNonEmptyString(slug)) {
    return fail("Поле slug обязательно", 400, "MISSING_SLUG");
  }
  if (!isValidSlug(slug)) {
    return fail(
      "slug может содержать только латиницу, цифры, дефис и подчёркивание",
      400,
      "INVALID_SLUG",
    );
  }
  if (!isNonEmptyString(name)) {
    return fail("Поле name обязательно", 400, "MISSING_NAME");
  }

  const insert = {
    slug,
    name,
    description: body.description ?? null,
    theme_color: body.theme_color ?? "#10b981",
    fallback_icon: body.fallback_icon ?? "📁",
    is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    order_index: typeof body.order_index === "number" ? body.order_index : 0,
    theme: body.theme ?? {},
    features: body.features ?? {},
    ui_texts: body.ui_texts ?? {},
  };

  const { data, error } = await supabase
    .from("projects")
    .insert(insert)
    .select()
    .single();

  if (error) {
    // 23505 — unique_violation (slug уже существует)
    if (error.code === "23505") {
      return fail(`Проект со slug «${slug}» уже существует`, 409, "DUPLICATE_SLUG");
    }
    return fail(error.message, 500, "DB_ERROR");
  }

  invalidateProjectsCache();

  return ok({ project: data }, { status: 201 });
}
