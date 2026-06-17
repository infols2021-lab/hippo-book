import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string; materialId: string }>;
};

// Функция для получения прямой ссылки на картинку
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

  // 1. Получаем проект и тему
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, is_active, theme_color, theme")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_active) notFound();

  const theme = project.theme || {};
  const primaryColor = theme?.colors?.primary || theme.primaryColor || project.theme_color || "#3b82f6";

  // 2. Получаем сам материал
  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", materialId)
    .eq("is_active", true)
    .single();

  if (!material) notFound();

  // 3. Проверка доступа
  let hasAccess = material.is_available;
  if (!hasAccess) {
    const { data: access } = await supabase
      .from("material_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("material_id", materialId)
      .single();
    if (access) hasAccess = true;
  }

  if (!hasAccess) {
    return (
      <div style={{ padding: 50, textAlign: "center", backgroundColor: "var(--project-bg)", minHeight: "100vh" }}>
        <h2 style={{ color: "var(--project-text)" }}>У вас нет доступа к этому материалу 🔒</h2>
        <Link href={`/projects/${slug}/materials`} style={{ color: "var(--project-primary)", textDecoration: "underline" }}>
          Вернуться назад
        </Link>
      </div>
    );
  }

  // 4. Получаем список заданий. ДОБАВЛЕН ОТЛОВ ОШИБОК!
  const { data: assignmentsData, error: assignmentsError } = await supabase
    .from("assignments")
    .select("id, title, description, order_index")
    // Если запрос падает из-за отсутствия старых колонок, он выведет ошибку в терминал
    .or(`material_id.eq.${materialId},textbook_id.eq.${materialId},crossword_id.eq.${materialId}`)
    .order("order_index", { ascending: true });

  if (assignmentsError) {
    console.error("🔴 ОШИБКА SUPABASE ПРИ ПОИСКЕ ЗАДАНИЙ:", assignmentsError.message);
  }

  const assignments = assignmentsData || [];
  const assignmentIds = assignments.map(a => a.id);

  // 5. Получаем прогресс пользователя по этим заданиям
  let completedSet = new Set<string>();
  if (assignmentIds.length > 0) {
    const { data: progressRes } = await supabase
      .from("user_progress")
      .select("assignment_id")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .in("assignment_id", assignmentIds);

    completedSet = new Set((progressRes || []).map(p => p.assignment_id));
  }

  // Математика прогресса
  const total = assignments.length;
  const completed = completedSet.size;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const coverUrl = toStorageProxyUrl(material.cover_image_url);

  return (
    <div style={{ backgroundColor: "var(--project-bg)", color: "var(--project-text)", minHeight: "100vh" }}>
      <AppHeader
        themeColor={primaryColor}
        nav={[
          { kind: "link", href: `/projects/${slug}/materials`, label: "К материалам", className: "btn" },
          { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn secondary" },
        ]}
      />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px" }}>
        {/* Кнопка назад */}
        <Link 
          href={`/projects/${slug}/materials`} 
          style={{ display: "inline-block", marginBottom: 20, color: "var(--project-primary)", textDecoration: "none", fontWeight: 600 }}
        >
          ← Назад к материалам
        </Link>

        {/* Карточка материала (Шапка) - ТЕПЕРЬ ДИНАМИЧЕСКАЯ */}
        <div style={{ 
          display: "flex", gap: 24, padding: 24, 
          backgroundColor: "var(--project-card-bg)", 
          border: "1px solid var(--project-border)",
          borderRadius: 16, 
          boxShadow: "0 4px 12px var(--project-glow)", 
          marginBottom: 32,
          flexWrap: "wrap" 
        }}>
          <div style={{ 
            flexShrink: 0, width: 140, height: 140, borderRadius: 12, overflow: "hidden", 
            backgroundColor: "var(--project-bg)", 
            border: "1px solid var(--project-border)",
            display: "flex", alignItems: "center", justifyContent: "center" 
          }}>
            {coverUrl ? (
              <img src={coverUrl} alt={material.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "3rem", opacity: 0.5 }}>📄</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 250 }}>
            <h1 style={{ margin: "0 0 8px 0", fontSize: 24, color: "var(--project-text)" }}>{material.title}</h1>
            <p style={{ color: "var(--project-muted)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              {material.description || "Изучайте материалы и выполняйте задания."}
            </p>
            
            {/* Полоска прогресса */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 8, backgroundColor: "var(--project-border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", backgroundColor: "var(--project-primary)", transition: "width 0.3s" }} />
              </div>
              <span style={{ fontWeight: 600, color: "var(--project-primary)" }}>{progressPct}%</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--project-muted)", marginTop: 8 }}>
              Выполнено {completed} из {total} заданий
            </div>
          </div>
        </div>

        {/* Список заданий */}
        <h2 style={{ fontSize: 20, marginBottom: 16, color: "var(--project-text)" }}>Список заданий</h2>
        
        {assignments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assignments.map((a, index) => {
              const isDone = completedSet.has(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/projects/${slug}/assignment?id=${a.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    backgroundColor: "var(--project-card-bg)",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "inherit",
                    border: "1px solid var(--project-border)",
                    transition: "border-color 0.2s, transform 0.2s"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--project-primary)")}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--project-border)")}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: "var(--project-text)" }}>
                      {index + 1}. {a.title || "Задание без названия"}
                    </div>
                    {a.description && <div style={{ fontSize: 13, color: "var(--project-muted)" }}>{a.description}</div>}
                  </div>
                  
                  {/* Статус-бейдж */}
                  <div style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: isDone ? "var(--project-glow)" : "transparent",
                    color: "var(--project-primary)",
                    border: isDone ? "1px solid transparent" : "1px solid var(--project-primary)",
                    whiteSpace: "nowrap",
                    marginLeft: 16
                  }}>
                    {isDone ? "✅ Выполнено" : "▶ Начать"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ 
            padding: 30, textAlign: "center", 
            backgroundColor: "var(--project-card-bg)", 
            borderRadius: 12, color: "var(--project-muted)", 
            border: "1px solid var(--project-border)" 
          }}>
            В этом материале пока нет добавленных заданий.
          </div>
        )}
      </div>
    </div>
  );
}