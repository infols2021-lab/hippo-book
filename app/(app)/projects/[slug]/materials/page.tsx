import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";
import { getProjectBySlug } from "@/lib/projects/loader";
import { loadProjectMaterialsData } from "@/lib/data/materials";
import type { MaterialWithProgress } from "@/lib/materials/types";
import MaterialsClient from "./MaterialsClient";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function toStorageProxyUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/api/storage/public/") || value.startsWith("data:")) {
    return value;
  }
  return rewriteSupabasePublicStorageUrl(value);
}

export default async function ProjectMaterialsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tab: activeTabSlug } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, contact_phone, region, is_admin, completed_assignments_count, ga_completed_assignments_count"
    )
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Ошибка загрузки профиля:", profileError.message);
    return (
      <div className="materials-page">
        <div className="materials-container materials-container--state">
          <div className="materials-empty card">
            <p>Не удалось загрузить профиль</p>
            <p className="materials-subtitle">{profileError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const tabs = project.tabs;
  if (tabs.length === 0) {
    return (
      <div className="materials-page">
        <div className="materials-container materials-container--state">
          <div className="materials-empty card">
            <p>В этом проекте пока нет разделов</p>
            <p className="materials-subtitle">Обратитесь к администратору</p>
          </div>
        </div>
      </div>
    );
  }

  let activeTab = tabs.find((t) => t.slug === activeTabSlug);
  if (!activeTab) {
    redirect(`/projects/${slug}/materials?tab=${tabs[0].slug}`);
  }

  const materialsResult = await loadProjectMaterialsData(
    { supabase, user, profile },
    slug,
    activeTab.slug
  );

  if (materialsResult.error) {
    console.error("Ошибка загрузки материалов:", materialsResult.error);
    return (
      <div className="materials-page">
        <div className="materials-container materials-container--state">
          <div className="materials-empty card">
            <p>Не удалось загрузить материалы</p>
            <p className="materials-subtitle">{materialsResult.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { materials } = materialsResult;

  const availableMats: MaterialWithProgress[] = [];
  const lockedMats: MaterialWithProgress[] = [];

  for (const m of materials) {
    // Карточка доступна, если ученик имеет доступ хотя бы к одному из тарифов
    // связки «База + PRO» (дальше режим открытия определяет бейдж accessMode).
    if (m.hasAccess || m.hasProAccess) {
      availableMats.push(m);
    } else {
      lockedMats.push(m);
    }
  }

  const markText = project.slug.slice(0, 2).toUpperCase();

  return (
    <MaterialsClient
      slug={slug}
      projectName={project.name}
      markText={markText}
      tabs={tabs.map((t) => ({ id: t.id, slug: t.slug, title: t.title, icon: t.icon }))}
      activeTab={{ id: activeTab.id, slug: activeTab.slug, title: activeTab.title, icon: activeTab.icon }}
      availableMats={availableMats}
      lockedMats={lockedMats}
    />
  );
}
