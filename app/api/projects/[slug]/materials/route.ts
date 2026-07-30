// app/api/projects/[slug]/materials/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { getProjectBySlug } from "@/lib/projects/loader";
import { loadProjectMaterialsData } from "@/lib/data/materials";
import type { MaterialWithProgress } from "@/lib/materials/types";

function toPublicMaterialDTO(material: MaterialWithProgress) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { created_by, updated_at, meta, is_active, ...rest } = material;
  return {
    ...rest,
    id: material.id,
    title: material.title,
    description: material.description,
    cover_image_url: material.cover_image_url,
    branch_type: material.branch_type,
    material_kind: material.material_kind,
    target_levels: material.target_levels,
    class_levels: material.class_levels,
    order_index: material.order_index,
    price: material.price,
    is_available: material.is_available,
    hasAccess: material.hasAccess,
    progress: material.progress,
    totalAssignments: material.totalAssignments,
    completedAssignments: material.completedAssignments,
    project_tab_id: material.project_tab_id,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // 1. Авторизация
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user, profile } = auth;
  const { slug } = await ctx.params;
  const { searchParams } = req.nextUrl;

  const tabSlug = searchParams.get("tab");
  const levelCode = searchParams.get("level");

  // 2. Получение конфига проекта
  const project = await getProjectBySlug(slug);
  if (!project) {
    return fail("Проект не найден или неактивен", 404, "NOT_FOUND");
  }

  // 3. Если таб не указан или не существует — возвращаем пустой список
  if (!tabSlug) {
    const res = ok({ materials: [] });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  }

  const tabExists = project.tabs.some((t) => t.slug === tabSlug && t.isActive);
  if (!tabExists) {
    const res = ok({ materials: [] });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  }

  // 4. Загрузка материалов через унифицированный слой
  const result = await loadProjectMaterialsData(
    { supabase, user, profile },
    slug,
    tabSlug,
  );

  if (result.error) {
    console.error("Ошибка загрузки материалов:", result.error);
    return fail(result.error, 500, "DB_ERROR");
  }

  let materials = result.materials;

  // 5. Фильтрация по уровню / классу
  if (levelCode) {
    materials = materials.filter((m) =>
      (m.target_levels ?? []).includes(levelCode) ||
      (m.class_levels ?? []).includes(levelCode),
    );
  }

  // 6. Преобразование в публичный DTO
  const dto = materials.map(toPublicMaterialDTO);

  const res = ok({ materials: dto });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}