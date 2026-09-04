// app/api/projects/[slug]/materials/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { getProjectBySlug } from "@/lib/projects/loader";
import { loadProjectMaterialsData } from "@/lib/data/materials";
import type {
  LinkedProMaterial,
  MaterialWithProgress,
} from "@/lib/materials/types";

// Дополнительные поля, которые кладут нормализаторы загрузчика в реальные строки
// (их нет в строгом типе MaterialDbRow, но они всегда есть на сервере).
type MaterialExtras = {
  is_demo?: boolean;
  is_secret?: boolean;
  project_id?: string | null;
};

type MaterialRow = MaterialWithProgress & MaterialExtras;

function toLinkedProMaterial(pro: MaterialWithProgress["pro"]): LinkedProMaterial | null {
  if (!pro) return null;
  return {
    id: pro.id,
    title: pro.title,
    price: pro.price,
    description: pro.description,
    checkout_description: pro.checkout_description,
    image: pro.cover_image_url,
    is_active: pro.is_active,
  };
}

function toPublicMaterialDTO(material: MaterialRow) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { created_by, updated_at, meta, is_active, pro, ...rest } = material;
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
    is_demo: material.is_demo,
    is_secret: Boolean(material.is_secret),
    is_pro: material.is_pro,
    pro_material_id: material.pro_material_id,
    checkout_description: material.checkout_description,
    hasAccess: material.hasAccess,
    hasProAccess: material.hasProAccess,
    accessMode: material.accessMode,
    progress: material.progress,
    totalAssignments: material.totalAssignments,
    completedAssignments: material.completedAssignments,
    project_tab_id: material.project_tab_id,
    pro: toLinkedProMaterial(pro),
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
  // Каталог заявок передаёт этот флаг явно: демо-материалы нельзя купить,
  // поэтому их нужно полностью убрать из выдачи для витрины заявок.
  const purchasableOnly = searchParams.get("purchasable") === "true";

  // 2. Получение конфига проекта
  const project = await getProjectBySlug(slug);
  if (!project) {
    return fail("Проект не найден или неактивен", 404, "NOT_FOUND");
  }

  const activeTabs = (project.tabs || []).filter((t) => t.isActive);
  const activeTabSlugs = activeTabs.map((t) => t.slug);
  const activeTabIds = new Set(activeTabs.map((t) => t.id));

  // 3. Определение списка табов для загрузки
  let targetSlugs: string[] = [];

  if (tabSlug) {
    if (!activeTabSlugs.includes(tabSlug)) {
      const res = ok({ materials: [] });
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }
    targetSlugs = [tabSlug];
  } else {
    targetSlugs = activeTabSlugs;
  }

  // 4. Загрузка материалов по целевым табам
  const results = await Promise.all(
    targetSlugs.map((s) =>
      loadProjectMaterialsData({ supabase, user, profile }, slug, s)
    )
  );

  const rawMaterials: MaterialWithProgress[] = [];
  const seenIds = new Set<string>();

  for (const res of results) {
    if (res.materials) {
      for (const m of res.materials) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          rawMaterials.push(m);
        }
      }
    }
  }

  // 5. Защита от фантомных легаси-материалов и ФИЛЬТРАЦИЯ СЕКРЕТНЫХ / ПОКУПАЕМЫХ
  let materials = rawMaterials.filter((item) => {
    const m = item as MaterialRow;
    const isDemo = Boolean(m.is_demo);
    const hasValidTab = m.project_tab_id ? activeTabIds.has(m.project_tab_id) : false;
    const isProjectDirect = m.project_id === project.id;

    // PRO-версии никогда не отдаются как самостоятельные карточки витрины:
    // они доступны только как вложенный `pro` у своей базовой записи.
    if (m.is_pro) {
      return false;
    }

    // Демо-материалы сквозные: пропускаем проверку "принадлежит ли табу этого проекта",
    // они физически могут жить в табе другого проекта и это ок.
    if (!isDemo && !hasValidTab && !isProjectDirect) {
      return false;
    }

    // Секретные материалы видны ученику ТОЛЬКО после получения доступа (hasAccess === true)
    if (m.is_secret && !m.hasAccess) {
      return false;
    }

    // Для витрины заявок демо-материалы исключаются полностью — их нельзя купить.
    if (isDemo && purchasableOnly) {
      return false;
    }

    return true;
  });

  // 6. Фильтрация по уровню / классу
  if (levelCode) {
    materials = materials.filter((m) =>
      (m.target_levels ?? []).includes(levelCode) ||
      (m.class_levels ?? []).includes(levelCode)
    );
  }

  // 7. Преобразование в публичный DTO
  const dto = materials.map(toPublicMaterialDTO);

  const res = ok({ materials: dto });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}