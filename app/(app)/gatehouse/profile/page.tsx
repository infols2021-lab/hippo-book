import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GatehouseProfileClient, {
  type GatehouseProfileData,
  type GatehouseProfileRecentProgress,
  type GatehouseProfileStats,
} from "./GatehouseProfileClient";

function normalizeProfile(data: any, fallbackEmail: string): GatehouseProfileData {
  return {
    id: String(data?.id ?? ""),
    email: String(data?.email ?? fallbackEmail ?? ""),
    full_name: typeof data?.full_name === "string" ? data.full_name : "",
    contact_phone: typeof data?.contact_phone === "string" ? data.contact_phone : "",
    region: typeof data?.region === "string" ? data.region : "",
  };
}

function normalizeScore(value: unknown): number {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

export default async function GatehouseProfilePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profileRow },
    { count: totalMaterialsCount },
    { count: availableMaterialsCount },
    { count: completedAssignmentsCount },
    { data: recentRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, contact_phone, region, ga_completed_assignments_count")
      .eq("id", user.id)
      .single(),

    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("branch_type", "gatehouse")
      .eq("material_kind", "mock_test")
      .eq("is_active", true),

    supabase
      .from("material_access")
      .select("id, materials!inner(branch_type, material_kind, is_active)", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("materials.branch_type", "gatehouse")
      .eq("materials.material_kind", "mock_test")
      .eq("materials.is_active", true),

    supabase
      .from("user_progress")
      .select("id, assignments!inner(branch_type)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .eq("assignments.branch_type", "gatehouse"),

    supabase
      .from("user_progress")
      .select(
        `
        id,
        assignment_id,
        completed_at,
        score,
        assignments!inner(
          id,
          title,
          branch_type,
          material_id,
          materials(
            id,
            title,
            target_levels,
            material_kind
          )
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .eq("assignments.branch_type", "gatehouse")
      .order("completed_at", { ascending: false })
      .limit(5),
  ]);

  const profile = normalizeProfile(profileRow, user.email ?? "");

  const recentProgress: GatehouseProfileRecentProgress[] = Array.isArray(recentRows)
    ? recentRows.map((row: any) => {
        const assignment = Array.isArray(row?.assignments) ? row.assignments[0] : row?.assignments;
        const material = Array.isArray(assignment?.materials)
          ? assignment.materials[0]
          : assignment?.materials;

        return {
          id: String(row?.id ?? row?.assignment_id ?? ""),
          assignmentId: String(row?.assignment_id ?? assignment?.id ?? ""),
          assignmentTitle: String(assignment?.title ?? "Задание"),
          materialTitle: typeof material?.title === "string" ? material.title : "Gatehouse Awards",
          score: normalizeScore(row?.score),
          completedAt: typeof row?.completed_at === "string" ? row.completed_at : null,
          completedAtLabel: formatDate(row?.completed_at),
        };
      })
    : [];

  const fallbackCompleted = Number(profileRow?.ga_completed_assignments_count ?? 0);

  const stats: GatehouseProfileStats = {
    totalMaterials: totalMaterialsCount ?? 0,
    availableMaterials: availableMaterialsCount ?? 0,
    completedAssignments:
      completedAssignmentsCount ??
      (Number.isFinite(fallbackCompleted) ? fallbackCompleted : 0),
  };

  return (
    <GatehouseProfileClient
      initialProfile={profile}
      initialStats={stats}
      initialRecentProgress={recentProgress}
    />
  );
}