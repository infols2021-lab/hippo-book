// lib/assignments/access.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Единая проверка доступа к заданию через родительский материал.
 * Пользователь имеет право открыть задание (в т.ч. кроссворд) только при наличии
 * записи в material_access для родительского material_id.
 * Если материал открыт для всех (is_available = true) или демо (is_demo = true) — пропускает.
 */
async function assertMaterialAccess(
  supabase: SupabaseClient,
  userId: string,
  materialId: string
): Promise<void> {
  const { data: material, error: materialError } = await supabase
    .from("materials")
    .select("id, is_active, is_available, is_demo")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) throw new Error(materialError.message);
  if (!material || material.is_active === false) {
    throw Object.assign(new Error("Material not found or inactive"), { status: 404 });
  }

  if (material.is_available || material.is_demo) return; // открыто для всех / демо

  const { data: access, error: accessError } = await supabase
    .from("material_access")
    .select("id")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .maybeSingle();

  if (accessError) throw new Error(accessError.message);
  if (!access) {
    throw Object.assign(new Error("No access to this material"), { status: 403 });
  }
}

/** Извлекает material_id из задания (прямое поле или связанный material). */
function resolveMaterialId(assignment: any): string | null {
  if (typeof assignment?.material_id === "string" && assignment.material_id) {
    return assignment.material_id;
  }

  const material = Array.isArray(assignment?.materials)
    ? assignment.materials[0]
    : assignment?.materials;
  if (typeof material?.id === "string" && material.id) return material.id;

  if (Array.isArray(assignment?.material)) {
    const first = assignment.material[0];
    if (typeof first?.id === "string" && first.id) return first.id;
  }
  if (typeof assignment?.material?.id === "string" && assignment.material.id) {
    return assignment.material.id;
  }

  return null;
}

/**
 * Проверяет, что пользователь имеет доступ к заданию олимпиадной ветки.
 * Доступ возможен только через родительский material_id в таблице material_access.
 */
export async function assertOlympiadAssignmentAccess(
  supabase: SupabaseClient,
  userId: string,
  assignment: any
): Promise<void> {
  const materialId = resolveMaterialId(assignment);

  if (!materialId) {
    throw Object.assign(new Error("Assignment has no material_id"), { status: 400 });
  }

  await assertMaterialAccess(supabase, userId, materialId);
}

/**
 * Проверяет, что пользователь имеет доступ к заданию Gatehouse Awards / Unified Materials.
 */
export async function assertGatehouseAssignmentAccess(
  supabase: SupabaseClient,
  userId: string,
  assignment: any
): Promise<void> {
  const materialId = resolveMaterialId(assignment);

  if (!materialId) {
    throw Object.assign(new Error("Gatehouse assignment has no material"), { status: 400 });
  }

  await assertMaterialAccess(supabase, userId, materialId);
}
