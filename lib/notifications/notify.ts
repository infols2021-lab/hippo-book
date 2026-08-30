// lib/notifications/notify.ts
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationInput = {
  userId: string;
  kind?: string;
  requestId?: string | null;
  materialId?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  materialTitle?: string;
  tabTitle?: string | null;
  tabSlug?: string | null;
  coverUrl?: string | null;
};

type NotifyMaterialRow = {
  id: string;
  title?: string | null;
  cover_image_url?: string | null;
  project_tab_id?: string | null;
};
type NotifyTabRow = { id: string; title?: string | null; slug?: string | null; project_id?: string | null; };
type NotifyProjectRow = { id: string; slug?: string | null; };

export async function notifyGrantedMaterials(
  admin: any,
  userId: string,
  materialIds: string[],
  kind: string,
  requestId?: string | null,
) {
  const ids = Array.from(new Set((materialIds || []).filter(Boolean)));
  if (!ids.length) return;
  try {
    const { data: mats } = (await admin
      .from("materials")
      .select("id, title, cover_image_url, project_tab_id")
      .in("id", ids) as any);
    const matsRows = (mats || []) as NotifyMaterialRow[];
    const tabIds = Array.from(new Set(matsRows.map((m) => m.project_tab_id).filter(Boolean)));
    const { data: tabsRaw } = tabIds.length
      ? await admin.from("project_tabs").select("id, title, slug, project_id").in("id", tabIds)
      : { data: [] };
    const tabs = (tabsRaw || []) as NotifyTabRow[];
    const projIds = Array.from(new Set(tabs.map((t) => t.project_id).filter(Boolean)));
    const { data: projectsRaw } = projIds.length
      ? await admin.from("projects").select("id, slug").in("id", projIds)
      : { data: [] };
    const projects = (projectsRaw || []) as NotifyProjectRow[];
    const tabById = new Map(tabs.map((t) => [t.id, t]));
    const slugById = new Map(projects.map((p) => [p.id, p.slug]));
    for (const m of matsRows) {
      const tab = m.project_tab_id ? tabById.get(m.project_tab_id) : undefined;
      const tabProjectId = tab?.project_id ?? undefined;
      await createMaterialNotification({
        userId,
        kind,
        requestId: requestId ?? null,
        materialId: String(m.id),
        projectId: tabProjectId ?? null,
        projectSlug: tab && tab.project_id ? (slugById.get(tab.project_id) ?? null) : null,
        materialTitle: String(m.title || " "),
        tabTitle: tab?.title ?? null,
        tabSlug: tab?.slug ?? null,
        coverUrl: m.cover_image_url ?? null,
      });
    }
  } catch (e) {
    console.error("notifyGrantedMaterials", e);
  }
}

export async function createMaterialNotification(input: NotificationInput) {
  const admin = getSupabaseAdminClient();
  const row = {
    user_id: input.userId,
    kind: input.kind || 'material_grant',
    request_id: input.requestId ?? null,
    material_id: input.materialId ?? null,
    project_id: input.projectId ?? null,
    project_slug: input.projectSlug ?? null,
    material_title: String(input.materialTitle || " "),
    tab_title: input.tabTitle ?? null,
    tab_slug: input.tabSlug ?? null,
    cover_url: input.coverUrl ?? null,
  };
  const { error } = await admin.from("user_notifications").insert(row);
  if (error) {
    console.error(error.message);
  }
  return !error;
}
