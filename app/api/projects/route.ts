// app/api/projects/route.ts
// PUBLIC: список всех активных проектов (веток).
// Используется порталом и навигацией фронтенда.

import { NextResponse } from "next/server";
import { getProjects } from "@/lib/projects/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // кэш на минуту на уровне ISR

export async function GET() {
  try {
    const projects = await getProjects();

    // Отдаём лёгкий DTO: только то, что нужно фронтенду для рендера портала/меню.
    const dto = projects.map((p) => ({
      slug: p.slug,
      name: p.name,
      label: p.label,
      shortLabel: p.shortLabel,
      description: p.description,
      fallbackIcon: p.fallbackIcon,
      themeColor: p.themeColor,
      portalCard: p.portalCard,
      routes: {
        portal: p.routes.portal,
        profile: p.routes.profile,
        materials: p.routes.materials,
        requests: p.routes.requests,
      },
      tabs: p.tabs
        .filter((t) => t.isActive && !t.isHidden)
        .map((t) => ({
          slug: t.slug,
          title: t.title,
          icon: t.icon,
          componentType: t.componentType,
          isPlaceholder: t.isPlaceholder,
        })),
      features: p.features,
    }));

    return NextResponse.json({ ok: true, projects: dto });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Не удалось загрузить проекты" },
      { status: 500 },
    );
  }
}
