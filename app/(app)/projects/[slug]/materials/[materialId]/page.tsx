import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import MaterialClient from "./MaterialClient";
import RoadmapMaterialView from "./RoadmapMaterialView";
import MaterialDetailSwitch from "./MaterialDetailSwitch";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string; materialId: string }>;
};

type MaterialDetailRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  material_kind: string;
  is_active: boolean;
  is_available: boolean;
  is_demo: boolean;
  is_pro: boolean;
  pro_material_id: string | null;
};

type AssignmentRow = {
  id: string;
  title: string;
  order_index: number;
  assignment_type: string;
};

function toStorageProxyUrl(raw: unknown) {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/api/storage/public/")) return value;
  if (value.startsWith("data:")) return value;

  const marker = "/storage/v1/object/public/";
  const idx = value.indexOf(marker);
  if (idx === -1) return value;

  const restWithQuery = value.slice(idx + marker.length);
  const cleanRest = restWithQuery.split("?")[0]?.split("#")[0] ?? "";
  const parts = cleanRest.split("/").filter(Boolean);
  const bucket = parts.shift();
  const path = parts.join("/");

  if (!bucket || !path) return value;
  return getStoragePublicUrl(bucket, path);
}

export default async function MaterialDetailsPage({ params }: PageProps) {
  const { slug, materialId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, is_active, theme_color, theme")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_active) notFound();

  const { data: materialRow } = await supabase
    .from("materials")
    .select("*")
    .eq("id", materialId)
    .eq("is_active", true)
    .single();

  const material = (materialRow ?? null) as MaterialDetailRow | null;
  if (!material) notFound();

  // ---------------------------------------------------------------------------
  // Разбор связки «База + PRO».
  // В URL обычно приходит id БАЗОВОГО материала (одна карточка на уровень).
  // Также поддерживаем прямые ссылки на PRO-запись (гранты / старые ссылки).
  // ---------------------------------------------------------------------------
  const isUrlPro = material.is_pro === true;
  const base = isUrlPro ? null : material;
  let pro = isUrlPro ? material : null;

  if (!isUrlPro && material.pro_material_id) {
    const { data: proRow } = await supabase
      .from("materials")
      .select("*")
      .eq("id", material.pro_material_id)
      .eq("is_pro", true)
      .eq("is_active", true)
      .maybeSingle();
    if (proRow) {
      pro = (proRow as MaterialDetailRow) ?? null;
    }
  }

  // ---------------------------------------------------------------------------
  // Права доступа текущего ученика к каждому тарифу связки.
  // ---------------------------------------------------------------------------
  async function userHasMaterialAccess(id: string, row: MaterialDetailRow | null): Promise<boolean> {
    if (!user) return false;
    if (!row) return false;
    if (row.is_available || row.is_demo) return true;
    const { data: access } = await supabase
      .from("material_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("material_id", id)
      .maybeSingle();
    return Boolean(access);
  }

  const hasBase = base ? await userHasMaterialAccess(base.id, base) : false;
  const hasPro = pro ? await userHasMaterialAccess(pro.id, pro) : false;

  const markText = slug.slice(0, 2).toUpperCase();
  const projectName = String(project.name || "");
  const baseCoverUrl = base ? toStorageProxyUrl(base.cover_image_url) : "";
  const proCoverUrl = pro ? toStorageProxyUrl(pro.cover_image_url) : "";

  // ---------------------------------------------------------------------------
  // Задания БАЗОВОГО материала (нужны для стандартного режима задачника).
  // ---------------------------------------------------------------------------
  const baseMaterialId = base?.id ?? null;
  let assignments: AssignmentRow[] = [];
  let completedIds: string[] = [];

  if (baseMaterialId) {
    const { data: assignmentsData } = await supabase
      .from("assignments")
      .select("id, title, order_index, assignment_type")
      .or(
        `material_id.eq.${baseMaterialId},textbook_id.eq.${baseMaterialId},crossword_id.eq.${baseMaterialId}`
      )
      .order("order_index", { ascending: true });

    assignments = ((assignmentsData as AssignmentRow[] | null) ?? []).filter(
      (a) => Boolean(a) && typeof a.id === "string",
    );
    const assignmentIds = assignments.map((a) => a.id);

    if (assignmentIds.length > 0) {
      const { data: progressRes } = await supabase
        .from("user_progress")
        .select("assignment_id")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .in("assignment_id", assignmentIds);
      completedIds = ((progressRes as { assignment_id: string }[] | null) ?? []).map(
        (p) => p.assignment_id,
      );
    }
  }

  const total = assignments.length;
  const completed = completedIds.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Маршрутизация режимов отображения.
  // ---------------------------------------------------------------------------
  // Прямой заход по PRO-записи — доступна только дорожка Roadmap.
  if (!base && pro) {
    return (
      <RoadmapMaterialView
        slug={slug}
        projectName={projectName}
        material={{ id: pro.id, title: pro.title, description: pro.description }}
        coverUrl={proCoverUrl}
        hasAccess={hasPro}
      />
    );
  }

  // Связка «База + PRO» существует.
  if (base && pro) {
    // Полный доступ — оба тарифа: показываем переключатель режимов (по умолчанию PRO).
    if (hasBase && hasPro) {
      return (
        <MaterialDetailSwitch
          slug={slug}
          projectName={projectName}
          markText={markText}
          baseMaterial={base}
          baseAssignments={assignments}
          baseCompletedIds={completedIds}
          baseProgressPct={progressPct}
          baseCompletedCount={completed}
          baseTotalCount={total}
          baseCoverUrl={baseCoverUrl}
          proMaterial={{ id: pro.id, title: pro.title, description: pro.description }}
          proCoverUrl={proCoverUrl}
        />
      );
    }

    // Только База — классический задачник.
    if (hasBase) {
      return (
        <MaterialClient
          slug={slug}
          projectName={projectName}
          markText={markText}
          material={base}
          assignments={assignments}
          completedIds={completedIds}
          progressPct={progressPct}
          completedCount={completed}
          totalCount={total}
          coverUrl={baseCoverUrl}
          hasAccess
          isDemoMaterial={Boolean(base.is_demo)}
        />
      );
    }

    // Только PRO — дорожка Roadmap без переключателя.
    if (hasPro) {
      return (
        <RoadmapMaterialView
          slug={slug}
          projectName={projectName}
          material={{ id: pro.id, title: pro.title, description: pro.description }}
          coverUrl={proCoverUrl}
          hasAccess
        />
      );
    }

    // Нет доступа ни к одному тарифу связки.
    return (
      <MaterialClient
        slug={slug}
        projectName={projectName}
        markText={markText}
        material={base}
        assignments={assignments}
        completedIds={completedIds}
        progressPct={progressPct}
        completedCount={completed}
        totalCount={total}
        coverUrl={baseCoverUrl}
        hasAccess={false}
      />
    );
  }

  // Без PRO-связки — историческое поведение для самостоятельных roadmap-курсов.
  if (base && base.material_kind === "roadmap") {
    return (
      <RoadmapMaterialView
        slug={slug}
        projectName={projectName}
        material={{ id: base.id, title: base.title, description: base.description }}
        coverUrl={baseCoverUrl}
        hasAccess={hasBase}
      />
    );
  }

  if (base) {
    return (
      <MaterialClient
        slug={slug}
        projectName={projectName}
        markText={markText}
        material={base}
        assignments={assignments}
        completedIds={completedIds}
        progressPct={progressPct}
        completedCount={completed}
        totalCount={total}
        coverUrl={baseCoverUrl}
        hasAccess={hasBase}
        isDemoMaterial={Boolean(base.is_demo)}
      />
    );
  }

  notFound();
}



