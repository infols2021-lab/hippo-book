// app/api/admin/projects/[id]/route.ts
// ADMIN: управление одним проектом (GET/PUT/DELETE) + его табами и уровнями.

import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { invalidateProjectsCache } from "@/lib/projects/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateProjectInput = {
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

type LevelInput = {
  id?: string;
  code?: string;
  label?: string;
  short_label?: string | null;
  level_group?: string | null;
  order_index?: number;
  description?: string | null;
  is_active?: boolean;
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

// ---------------------------------------------------------------------------
// GET: проект + табы + уровни (всё для редактора)
// ---------------------------------------------------------------------------
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id } = await params;

  const [
    { data: project, error: projectError },
    { data: tabs, error: tabsError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("project_tabs")
      .select("*")
      .eq("project_id", id)
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase
      .from("project_levels")
      .select("*")
      .eq("project_id", id)
      .order("order_index", { ascending: true }),
  ]);

  if (projectError) return fail(projectError.message, 500, "DB_ERROR");
  if (!project) return fail("Проект не найден", 404, "NOT_FOUND");
  if (tabsError) return fail(tabsError.message, 500, "DB_ERROR");
  if (levelsError) return fail(levelsError.message, 500, "DB_ERROR");

  return ok({ project, tabs: tabs ?? [], levels: levels ?? [] });
}

// ---------------------------------------------------------------------------
// PUT: обновить проект + (опционально) заменить табы/уровни
// ---------------------------------------------------------------------------
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase, user } = guard;

  const { id } = await params;

  let body: UpdateProjectInput & {
    tabs?: TabInput[];
    levels?: LevelInput[];
  };
  try {
    body = await req.json();
  } catch {
    return fail("Неверный JSON", 400, "BAD_JSON");
  }

  // --- 1. Обновление полей проекта ---
  const patch: UpdateProjectInput = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.theme_color !== undefined) patch.theme_color = body.theme_color;
  if (body.fallback_icon !== undefined) patch.fallback_icon = body.fallback_icon;
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.order_index !== undefined) patch.order_index = body.order_index;
  if (body.theme !== undefined) patch.theme = body.theme;
  if (body.features !== undefined) patch.features = body.features;
  if (body.ui_texts !== undefined) patch.ui_texts = body.ui_texts;

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", id);

    if (updateError) return fail(updateError.message, 500, "DB_ERROR");
  }

  // --- 2. Табы (upsert + удаление отсутствующих) ---
  if (Array.isArray(body.tabs)) {
    const incomingIds = new Set<string>();

    for (const tab of body.tabs) {
      if (!isNonEmptyString(tab.slug) || !isNonEmptyString(tab.title)) continue;

      const payload = cleanObject({
        project_id: id,
        slug: tab.slug,
        title: tab.title,
        component_type: tab.component_type ?? "materials",
        material_kind: tab.material_kind ?? null,
        icon: tab.icon ?? null,
        order_index: typeof tab.order_index === "number" ? tab.order_index : 0,
        is_active: typeof tab.is_active === "boolean" ? tab.is_active : true,
        is_hidden: typeof tab.is_hidden === "boolean" ? tab.is_hidden : false,
        features: tab.features ?? {},
        ui_texts: tab.ui_texts ?? {},
      });

      if (isNonEmptyString(tab.id)) {
        incomingIds.add(tab.id);
        const { error } = await supabase
          .from("project_tabs")
          .update(payload)
          .eq("id", tab.id)
          .eq("project_id", id);
        if (error) return fail(`Таб ${tab.slug}: ${error.message}`, 500, "DB_ERROR");
      } else {
        const { data, error } = await supabase
          .from("project_tabs")
          .insert(payload)
          .select("id")
          .single();
        if (error) return fail(`Таб ${tab.slug}: ${error.message}`, 500, "DB_ERROR");
        if (data?.id) incomingIds.add(data.id);
      }
    }

    // Удалить табы, которых нет в новом списке
    const { data: existingTabs, error: listErr } = await supabase
      .from("project_tabs")
      .select("id")
      .eq("project_id", id);
    if (listErr) return fail(listErr.message, 500, "DB_ERROR");

    const toDelete = (existingTabs ?? [])
      .map((t: { id: string }) => t.id)
      .filter((tid: string) => !incomingIds.has(tid));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("project_tabs")
        .delete()
        .in("id", toDelete);
      if (delErr) return fail(delErr.message, 500, "DB_ERROR");
    }
  }

  // --- 3. Уровни (upsert + удаление отсутствующих) ---
  if (Array.isArray(body.levels)) {
    const incomingIds = new Set<string>();

    for (const level of body.levels) {
      if (!isNonEmptyString(level.code) || !isNonEmptyString(level.label)) continue;

      const payload = cleanObject({
        project_id: id,
        code: level.code,
        label: level.label,
        short_label: level.short_label ?? null,
        level_group: level.level_group ?? null,
        order_index: typeof level.order_index === "number" ? level.order_index : 0,
        description: level.description ?? null,
        is_active: typeof level.is_active === "boolean" ? level.is_active : true,
      });

      if (isNonEmptyString(level.id)) {
        incomingIds.add(level.id);
        const { error } = await supabase
          .from("project_levels")
          .update(payload)
          .eq("id", level.id)
          .eq("project_id", id);
        if (error) return fail(`Уровень ${level.code}: ${error.message}`, 500, "DB_ERROR");
      } else {
        const { data, error } = await supabase
          .from("project_levels")
          .insert(payload)
          .select("id")
          .single();
        if (error) return fail(`Уровень ${level.code}: ${error.message}`, 500, "DB_ERROR");
        if (data?.id) incomingIds.add(data.id);
      }
    }

    const { data: existingLevels, error: listErr } = await supabase
      .from("project_levels")
      .select("id")
      .eq("project_id", id);
    if (listErr) return fail(listErr.message, 500, "DB_ERROR");

    const toDelete = (existingLevels ?? [])
      .map((l: { id: string }) => l.id)
      .filter((lid: string) => !incomingIds.has(lid));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("project_levels")
        .delete()
        .in("id", toDelete);
      if (delErr) return fail(delErr.message, 500, "DB_ERROR");
    }
  }

  invalidateProjectsCache();

  // Вернём обновлённый проект + табы + уровни
  const [
    { data: project, error: projectError },
    { data: tabs, error: tabsError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase
      .from("project_tabs")
      .select("*")
      .eq("project_id", id)
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase
      .from("project_levels")
      .select("*")
      .eq("project_id", id)
      .order("order_index", { ascending: true }),
  ]);

  if (projectError) return fail(projectError.message, 500, "DB_ERROR");
  if (tabsError) return fail(tabsError.message, 500, "DB_ERROR");
  if (levelsError) return fail(levelsError.message, 500, "DB_ERROR");

  return ok({ project, tabs: tabs ?? [], levels: levels ?? [] });
}

// ---------------------------------------------------------------------------
// DELETE: удалить проект (каскадно снесёт табы/уровни по FK ON DELETE CASCADE)
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { supabase } = guard;

  const { id } = await params;

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    // 23503 — foreign_key_violation (на проект ссылаются материалы/заявки)
    if (error.code === "23503") {
      return fail(
        "Невозможно удалить проект: есть связанные материалы, задания или заявки. Сначала перенесите их или снимите проект с публикации (is_active = false).",
        409,
        "HAS_REFERENCES",
      );
    }
    return fail(error.message, 500, "DB_ERROR");
  }

  invalidateProjectsCache();
  return ok({ deleted: true, id });
}
