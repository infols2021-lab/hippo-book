// app/(app)/gatehouse/profile/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GatehouseProfileClient, {
  type GatehouseProfileData,
  type GatehouseMaterialProgress,
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

export default async function GatehouseProfilePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/login");
  }

  // Запрашиваем базовые данные профиля и общие счетчики параллельно
  const [
    { data: profileRow },
    { count: totalMaterialsCount },
    { count: availableMaterialsCount },
    { count: completedAssignmentsCount },
    { data: materialsRows },
    { data: allowedAccessRows },
    { data: allAssignmentsRows },
    { data: userProgressRows }
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

    // Получаем все активные материалы Gatehouse Awards
    supabase
      .from("materials")
      .select("id, title, is_available")
      .eq("branch_type", "gatehouse")
      .eq("material_kind", "mock_test")
      .eq("is_active", true)
      .order("order_index", { ascending: true }),

    // Получаем индивидуальные доступы текущего юзера
    supabase
      .from("material_access")
      .select("material_id")
      .eq("user_id", user.id),

    // Получаем все задания для подсчета общего количества
    supabase
      .from("assignments")
      .select("id, material_id")
      .eq("branch_type", "gatehouse"),

    // Получаем все завершенные прогрессы юзера
    supabase
      .from("user_progress")
      .select("assignment_id")
      .eq("user_id", user.id)
      .eq("is_completed", true)
  ]);

  const profile = normalizeProfile(profileRow, user.email ?? "");

  // Множества для быстрого поиска доступов и выполненных заданий
  const allowedMaterialIds = new Set(allowedAccessRows?.map(a => a.material_id) || []);
  const completedAssignmentIds = new Set(userProgressRows?.map(p => p.assignment_id) || []);

  // Фильтруем материалы, к которым у пользователя реально есть доступ
  const accessibleMaterials = (materialsRows || []).filter(
    (m: any) => m.is_available === true || allowedMaterialIds.has(m.id)
  );

  // Считаем прогресс в процентах для каждого доступного материала
  const materialsProgress: GatehouseMaterialProgress[] = accessibleMaterials.map((material: any) => {
    // Находим все задания, привязанные к этому материалу
    const materialAssignments = (allAssignmentsRows || []).filter(
      (a: any) => a.material_id === material.id
    );

    const total = materialAssignments.length;
    
    // Считаем сколько из этих заданий юзер уже выполнил
    const completed = materialAssignments.filter(
      (a: any) => completedAssignmentIds.has(a.id)
    ).length;

    // Считаем строго в процентах (без деления на 0)
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      id: material.id,
      title: material.title,
      totalAssignments: total,
      completedAssignments: completed,
      percentage: percentage
    };
  });

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
      initialMaterialsProgress={materialsProgress}
    />
  );
}