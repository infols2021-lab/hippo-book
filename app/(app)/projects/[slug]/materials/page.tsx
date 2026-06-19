// app/(app)/projects/[slug]/materials/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";
import AppHeader from "@/components/AppHeader";
import { getProjectBySlug } from "@/lib/projects/loader";
import { loadProjectMaterialsData } from "@/lib/data/materials";
import type { MaterialWithProgress } from "@/lib/materials/types";

import "./materials.css";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, contact_phone, region, is_admin, completed_assignments_count, ga_completed_assignments_count",
    )
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Ошибка загрузки профиля:", profileError.message);
    return (
      <div className="materials-page">
        <div className="materials-container">
          <AppHeader
            nav={[
              { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn ghost" },
              { kind: "logout", label: "Выйти", className: "btn secondary" },
            ]}
          />
          <div className="materials-empty card">
            <p>⚠️ Не удалось загрузить профиль</p>
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
        <div className="materials-container">
          <AppHeader
            nav={[
              { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn ghost" },
              { kind: "logout", label: "Выйти", className: "btn secondary" },
            ]}
          />
          <div className="materials-empty card">
            <p>📭 В этом проекте пока нет разделов</p>
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
    activeTab.slug,
  );

  if (materialsResult.error) {
    console.error("Ошибка загрузки материалов:", materialsResult.error);
    return (
      <div className="materials-page">
        <div className="materials-container">
          <AppHeader
            nav={[
              { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn ghost" },
              { kind: "logout", label: "Выйти", className: "btn secondary" },
            ]}
          />
          <div className="materials-empty card">
            <p>⚠️ Не удалось загрузить материалы</p>
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
    if (m.hasAccess) {
      availableMats.push(m);
    } else {
      lockedMats.push(m);
    }
  }

  return (
    <div className="materials-page">
      <div className="materials-container">
        <AppHeader
          nav={[
            { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn ghost" },
            { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
          ]}
        />

        {tabs.length > 0 && (
          <div className="materials-tabs" role="tablist" aria-label="Материалы">
            {tabs.map((tab) => {
              const isActive = tab.slug === activeTab.slug;
              return (
                <Link
                  key={tab.id}
                  href={`/projects/${slug}/materials?tab=${tab.slug}`}
                  className={`material-tab ${isActive ? "active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                >
                  {tab.icon || ""} {tab.title}
                </Link>
              );
            })}
          </div>
        )}

        <div className="materials-section active">
          <div className="materials-panel">
            <h3 className="materials-title">{activeTab.title}</h3>
            <p className="materials-subtitle">Выберите материал для изучения и выполнения заданий</p>

            {materials.length > 0 ? (
              <div className="materials-grid">
                {availableMats.map((m) => {
                  const coverUrl = toStorageProxyUrl(m.cover_image_url);
                  return (
                    <Link
                      key={m.id}
                      href={`/projects/${slug}/materials/${m.id}`}
                      className="material-card"
                    >
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title || "Обложка"} loading="lazy" decoding="async" />
                        ) : (
                          <div className="material-cover-placeholder">📄</div>
                        )}
                      </div>
                      <div className="material-title">{m.title || "Без названия"}</div>
                      <div className="material-description">{m.description || "Материалы и задания для выполнения"}</div>
                      
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${m.progress}%` }} />
                      </div>
                      <div className="material-stats">
                        <span>{m.completedAssignments}/{m.totalAssignments} заданий</span>
                        <span className="pct">{m.progress}%</span>
                      </div>
                    </Link>
                  );
                })}

                {lockedMats.map((m) => {
                  const coverUrl = toStorageProxyUrl(m.cover_image_url);
                  return (
                    <div key={m.id} className="material-card locked">
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title || "Обложка"} loading="lazy" decoding="async" />
                        ) : (
                          <div className="material-cover-placeholder">📄</div>
                        )}
                      </div>
                      <div className="material-title">{m.title || "Без названия"}</div>
                      <div className="material-description">{m.description || "Материал временно недоступен"}</div>
                      <div className="locked-overlay">
                        <span className="locked-badge">🔒 Недоступен</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="materials-empty card">
                <p>📭 В этом разделе пока пусто</p>
                <p className="materials-subtitle" style={{ margin: 0 }}>Ожидайте, когда администратор загрузит сюда материалы.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}