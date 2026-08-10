// lib/assignments/access.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Проверяет, что пользователь имеет доступ к заданию (включая легаси олимпиады и новые ветки).
 * - Если задание привязано к унифицированному material_id -> проверяет material_access
 * - Если к textbook_id (легаси) -> проверяет textbook_access
 * - Если к crossword_id (легаси) -> проверяет crossword_access
 * Если доступ открыт для всех (is_available = true) или материал демо (is_demo = true) – пропускает.
 */
export async function assertOlympiadAssignmentAccess(
  supabase: SupabaseClient,
  userId: string,
  assignment: any
): Promise<void> {
  // Извлекаем все возможные идентификаторы привязки
  const textbookId = typeof assignment?.textbook_id === "string" ? assignment.textbook_id : null;
  const crosswordId = typeof assignment?.crossword_id === "string" ? assignment.crossword_id : null;
  const materialId = typeof assignment?.material_id === "string" ? assignment.material_id : null;

  // 1. ПРОВЕРКА ПО НОВОЙ СИСТЕМЕ (materials) - Для новых веток
  if (materialId) {
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
    return;
  }

  // 2. ПРОВЕРКА ПО ЛЕГАСИ СИСТЕМЕ УЧЕБНИКОВ (textbooks)
  if (textbookId) {
    const { data: textbook, error: textbookError } = await supabase
      .from("textbooks")
      .select("id, is_available, is_active, branch_type")
      .eq("id", textbookId)
      .maybeSingle(); // Убрал or() проверку веток, так как легаси может конфликтовать с новыми ветками

    if (textbookError) throw new Error(textbookError.message);
    if (!textbook || textbook.is_active === false) {
      throw Object.assign(new Error("Textbook not found or inactive"), { status: 404 });
    }

    if (textbook.is_available) return; // открыто для всех

    const { data: access, error: accessError } = await supabase
      .from("textbook_access")
      .select("id")
      .eq("user_id", userId)
      .eq("textbook_id", textbookId)
      .maybeSingle();

    if (accessError) throw new Error(accessError.message);
    if (!access) {
      throw Object.assign(new Error("No access to this textbook"), { status: 403 });
    }
    return;
  }

  // 3. ПРОВЕРКА ПО ЛЕГАСИ СИСТЕМЕ КРОССВОРДОВ (crosswords)
  if (crosswordId) {
    const { data: crossword, error: crosswordError } = await supabase
      .from("crosswords")
      .select("id, is_available, is_active, branch_type")
      .eq("id", crosswordId)
      .maybeSingle();

    if (crosswordError) throw new Error(crosswordError.message);
    if (!crossword || crossword.is_active === false) {
      throw Object.assign(new Error("Crossword not found or inactive"), { status: 404 });
    }

    if (crossword.is_available) return;

    const { data: access, error: accessError } = await supabase
      .from("crossword_access")
      .select("id")
      .eq("user_id", userId)
      .eq("crossword_id", crosswordId)
      .maybeSingle();

    if (accessError) throw new Error(accessError.message);
    if (!access) {
      throw Object.assign(new Error("No access to this crossword"), { status: 403 });
    }
    return;
  }

  // Если ни одного ID нет, выдаем понятную ошибку
  throw Object.assign(new Error("Assignment has no material_id, textbook_id, or crossword_id"), { status: 400 });
}

/**
 * Проверяет, что пользователь имеет доступ к заданию Gatehouse Awards / Unified Materials.
 */
export async function assertGatehouseAssignmentAccess(
  supabase: SupabaseClient,
  userId: string,
  assignment: any
): Promise<void> {
  const materialId = assignment?.material_id ?? (() => {
    const material = Array.isArray(assignment?.materials) ? assignment.materials[0] : assignment?.materials;
    return material?.id ?? null;
  })();

  if (!materialId) {
    throw Object.assign(new Error("Gatehouse assignment has no material"), { status: 400 });
  }

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