// lib/assignments/access.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Проверяет, что пользователь имеет доступ к олимпиадному заданию.
 * Если задание привязано к учебнику – проверяет textbook_access,
 * если к кроссворду – crossword_access.
 * Если доступ открыт для всех (is_available = true) – пропускает.
 */
export async function assertOlympiadAssignmentAccess(
  supabase: SupabaseClient,
  userId: string,
  assignment: any
): Promise<void> {
  const textbookId = typeof assignment?.textbook_id === "string" ? assignment.textbook_id : null;
  const crosswordId = typeof assignment?.crossword_id === "string" ? assignment.crossword_id : null;

  if (textbookId) {
    const { data: textbook, error: textbookError } = await supabase
      .from("textbooks")
      .select("id, is_available, is_active, branch_type")
      .eq("id", textbookId)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .maybeSingle();

    if (textbookError) throw new Error(textbookError.message);
    if (!textbook || textbook.is_active === false) {
      const err = new Error("Textbook not found or inactive") as any;
      err.status = 404;
      throw err;
    }

    if (textbook.is_available) return; // открыт для всех

    const { data: access, error: accessError } = await supabase
      .from("textbook_access")
      .select("id")
      .eq("user_id", userId)
      .eq("textbook_id", textbookId)
      .maybeSingle();

    if (accessError) throw new Error(accessError.message);
    if (!access) {
      const err = new Error("No access to this textbook") as any;
      err.status = 403;
      throw err;
    }
    return;
  }

  if (crosswordId) {
    const { data: crossword, error: crosswordError } = await supabase
      .from("crosswords")
      .select("id, is_available, is_active, branch_type")
      .eq("id", crosswordId)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .maybeSingle();

    if (crosswordError) throw new Error(crosswordError.message);
    if (!crossword || crossword.is_active === false) {
      const err = new Error("Crossword not found or inactive") as any;
      err.status = 404;
      throw err;
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
      const err = new Error("No access to this crossword") as any;
      err.status = 403;
      throw err;
    }
    return;
  }

  throw Object.assign(new Error("Olympiad assignment has no textbook_id or crossword_id"), { status: 400 });
}

/**
 * Проверяет, что пользователь имеет доступ к заданию Gatehouse Awards.
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
    .select("id, is_active, is_available, branch_type")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) throw new Error(materialError.message);
  if (!material || material.is_active === false) {
    throw Object.assign(new Error("Material not found or inactive"), { status: 404 });
  }

  if (material.is_available) return;

  const { data: access, error: accessError } = await supabase
    .from("material_access")
    .select("id")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .maybeSingle();

  if (accessError) throw new Error(accessError.message);
  if (!access) {
    throw Object.assign(new Error("No access to this Gatehouse material"), { status: 403 });
  }
}