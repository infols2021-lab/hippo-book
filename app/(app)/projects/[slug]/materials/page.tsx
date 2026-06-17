import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import AppHeader from "@/components/AppHeader"; // Твоя родная шапка

export const revalidate = 0; // Отключаем кэш для актуальных данных

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

// Хелпер для получения правильных ссылок на обложки
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

export default async function ProjectMaterialsPage({ params, searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  
  // Убрали дурацкий level! Оставили только табы.
  const { tab: activeTabSlug } = await searchParams;

  // 1. Проверяем авторизацию
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Получаем ядро ветки
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, is_active")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_active) notFound();

  // 3. Получаем список табов для этой ветки
  const { data: tabsRes } = await supabase
    .from("project_tabs")
    .select("*")
    .eq("project_id", project.id)
    .eq("is_active", true)
    .order("order_index");
    
  const tabs = tabsRes || [];

  // Если таб не выбран в URL, кидаем на первый доступный
  if (!activeTabSlug && tabs.length > 0) {
    redirect(`/projects/${slug}/materials?tab=${tabs[0].slug}`);
  }

  const activeTab = tabs.find(t => t.slug === activeTabSlug);

  // 4. Формируем запрос на материалы только для этого таба
  let materialsQuery = supabase
    .from("materials")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: false });

  if (activeTab) {
    materialsQuery = materialsQuery.eq("project_tab_id", activeTab.id);
  } else {
    // Если табов нет, выдаем пустоту (защита)
    materialsQuery = materialsQuery.eq("project_tab_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: materialsData } = await materialsQuery;
  const materials = materialsData || [];
  const materialIds = materials.map(m => m.id);

  // 5. Собираем доступы и прогресс (Всё происходит на сервере, клиент не ждет!)
  let grantedMaterialIds = new Set<string>();
  let completedSet = new Set<string>();
  let assignments: any[] = [];

  if (materialIds.length > 0) {
    const idsString = materialIds.join(',');

    const [accessRes, assignmentsRes] = await Promise.all([
      supabase.from("material_access").select("material_id").eq("user_id", user.id).in("material_id", materialIds),
      supabase.from("assignments").select("id, material_id, textbook_id, crossword_id").or(`material_id.in.(${idsString}),textbook_id.in.(${idsString}),crossword_id.in.(${idsString})`)
    ]);

    grantedMaterialIds = new Set((accessRes.data || []).map(a => a.material_id));
    assignments = assignmentsRes.data || [];
    const assignmentIds = assignments.map(a => a.id);

    if (assignmentIds.length > 0) {
      const { data: progressRes } = await supabase
        .from("user_progress")
        .select("assignment_id")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .in("assignment_id", assignmentIds);
        
      completedSet = new Set((progressRes || []).map(p => p.assignment_id));
    }
  }

  // 6. Разбиваем на доступные и заблокированные
  const availableMats = [];
  const lockedMats = [];

  for (const m of materials) {
    if (m.is_available || grantedMaterialIds.has(m.id)) {
      availableMats.push(m);
    } else {
      lockedMats.push(m);
    }
  }

  // Хелпер расчета прогресса (0-100%)
  function getProgress(matId: string) {
    const related = assignments.filter(a => a.material_id === matId || a.textbook_id === matId || a.crossword_id === matId);
    const total = related.length;
    let completed = 0;
    for (const a of related) {
      if (completedSet.has(a.id)) completed++;
    }
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress };
  }

  // ВОЗВРАЩАЕМ ТВОЙ РОДНОЙ CSS И ДИЗАЙН
  return (
    <div className="materials-page">
      <div className="materials-container">
        
        {/* ТВОЯ РОДНАЯ ШАПКА */}
        <AppHeader
          nav={[
            { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn" },
            { kind: "logout", label: "Выйти", className: "btn secondary" },
          ]}
        />

        {/* ТВОИ РОДНЫЕ ТАБЫ (Теперь генерируются из БД) */}
        {tabs.length > 0 && (
          <div className="materials-tabs" role="tablist" aria-label="Материалы">
            {tabs.map((tab) => {
              const isActive = tab.slug === activeTabSlug;
              return (
                <Link
                  key={tab.id}
                  href={`/projects/${slug}/materials?tab=${tab.slug}`}
                  className={`material-tab ${isActive ? "active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                  style={isActive ? { 
                    backgroundColor: "var(--project-primary)", 
                    borderColor: "var(--project-primary)", 
                    color: "#fff" 
                  } : {}}
                >
                  {tab.icon || ""} {tab.title}
                </Link>
              );
            })}
          </div>
        )}

        <div className="materials-section active">
          <div className="materials-panel">
            <h3 className="materials-title">
              {activeTab ? activeTab.title : "Материалы"}
            </h3>
            <p className="materials-subtitle">Выберите материал для изучения и выполнения заданий</p>

            {materials.length > 0 ? (
              <div className="materials-grid">
                
                {/* ДОСТУПНЫЕ МАТЕРИАЛЫ */}
                {availableMats.map((m) => {
                  const { total, completed, progress } = getProgress(m.id);
                  const coverUrl = toStorageProxyUrl(m.cover_image_url);

                  return (
                    <Link
                      key={m.id}
                      href={`/projects/${slug}/materials/${m.id}`}
                      className="material-card"
                    >
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title} loading="lazy" decoding="async" />
                        ) : (
                          <div style={{ fontSize: "3rem", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>📄</div>
                        )}
                      </div>

                      <div className="material-title">{m.title}</div>
                      <div className="material-description">{m.description || "Материалы и задания для выполнения"}</div>

                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progress}%`, backgroundColor: "var(--project-primary)" }} 
                        />
                      </div>

                      <div className="material-stats">
                        <span>{completed}/{total} заданий</span>
                        <span className="pct" style={{ color: "var(--project-primary)" }}>{progress}%</span>
                      </div>
                    </Link>
                  );
                })}

                {/* ЗАБЛОКИРОВАННЫЕ МАТЕРИАЛЫ */}
                {lockedMats.map((m) => {
                  const coverUrl = toStorageProxyUrl(m.cover_image_url);

                  return (
                    <div key={m.id} className="material-card locked">
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title} loading="lazy" decoding="async" />
                        ) : (
                          <div style={{ fontSize: "3rem", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>📄</div>
                        )}
                      </div>

                      <div className="material-title">{m.title}</div>
                      <div className="material-description">{m.description || "Материал временно недоступен"}</div>
                      <div className="locked-overlay">🔒 Недоступен</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // ЕСЛИ МАТЕРИАЛОВ В ТАБЕ НЕТ
              <div className="materials-empty">
                <p>📭 В этом разделе пока пусто</p>
                <p className="materials-subtitle" style={{ margin: 0 }}>
                  Ожидайте, когда администратор загрузит сюда материалы.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}