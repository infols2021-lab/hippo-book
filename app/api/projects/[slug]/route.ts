// app/api/projects/[slug]/route.ts
// PUBLIC: полный конфиг одного проекта по slug (включая tabs + levels).

import { NextResponse } from "next/server";
import { getProjectBySlug } from "@/lib/projects/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);

    if (!project) {
      return NextResponse.json(
        { ok: false, error: `Проект «${slug}» не найден` },
        { status: 404 },
      );
    }

    // Публичный DTO: theme, tabs (без скрытых), levels, features.
    return NextResponse.json({
      ok: true,
      project: {
        slug: project.slug,
        name: project.name,
        label: project.label,
        shortLabel: project.shortLabel,
        adminLabel: project.adminLabel,
        description: project.description,
        fallbackIcon: project.fallbackIcon,
        themeColor: project.themeColor,
        theme: project.theme,
        features: project.features,
        uiTexts: project.uiTexts,
        routes: project.routes,
        portalCard: project.portalCard,
        tabs: project.tabs
          .filter((t) => t.isActive && !t.isHidden)
          .map((t) => ({
            id: t.id,
            slug: t.slug,
            title: t.title,
            icon: t.icon,
            componentType: t.componentType,
            materialKind: t.materialKind,
            orderIndex: t.orderIndex,
            isPlaceholder: t.isPlaceholder,
            uiTexts: t.uiTexts,
          })),
        levels: project.levels.map((l) => ({
          id: l.id,
          code: l.code,
          label: l.label,
          shortLabel: l.shortLabel,
          group: l.group,
          order: l.order,
          description: l.description,
        })),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Не удалось загрузить проект" },
      { status: 500 },
    );
  }
}
