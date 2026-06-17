import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

// Гибкий тип для поддержки и старой, и новой архитектуры
type MatPick = {
  branch_type?: string;
  kind?: string;
  material_id: string | null;
  textbook_id: string | null;
  crossword_id: string | null;
  error?: string;
};

// Больше не форсируем жесткие типы, доверяем фронтенду, но оставляем фолбэк
function normalizeBranchType(value: unknown): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "gatehouse" || v === "ga" || v === "ga_exam" || v === "exam" || v === "gatehouse_awards") {
    return "gatehouse";
  }
  return v || "olympiad"; // Если передали кастомную ветку - сохраним её, иначе olympiad
}

function pickMaterial(body: any): MatPick {
  const branch_type = normalizeBranchType(body?.branch_type);
  const kind = String(body?.kind || "").trim().toLowerCase();
  const material_id = String(body?.material_id || "").trim();
  const textbook_id = body?.textbook_id ? String(body.textbook_id).trim() : "";
  const crossword_id = body?.crossword_id ? String(body.crossword_id).trim() : "";

  // 1. НОВАЯ АРХИТЕКТУРА: Если явно передан material_id или kind === "material"
  if (material_id && (!kind || kind === "material")) {
    return {
      branch_type,
      kind: "material",
      material_id,
      textbook_id: null,
      crossword_id: null,
    };
  }

  // 2. ЛЕГАСИ: Учебники
  if (kind === "textbook" || textbook_id) {
    return {
      branch_type,
      kind: "textbook",
      material_id: null,
      textbook_id: textbook_id || material_id,
      crossword_id: null,
    };
  }

  // 3. ЛЕГАСИ: Кроссворды
  if (kind === "crossword" || crossword_id) {
    return {
      branch_type,
      kind: "crossword",
      material_id: null,
      textbook_id: null,
      crossword_id: crossword_id || material_id,
    };
  }

  // Фоллбэк: если есть хоть какой-то ID, считаем его material_id
  const anyId = material_id || textbook_id || crossword_id;
  if (anyId) {
    return {
      branch_type,
      kind: "material",
      material_id: anyId,
      textbook_id: null,
      crossword_id: null,
    };
  }

  return { material_id: null, textbook_id: null, crossword_id: null, error: "kind/material_id required" };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  // Фронтенд может передавать ID материала как `id` или `material_id`. Читаем любой доступный.
  const id = String(req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("material_id") || "").trim();

  if (!id) return ok({ assignments: [] });

  // ❗️ ИДЕАЛЬНОЕ РЕШЕНИЕ: Ищем задания, у которых этот ID совпадает с ЛЮБЫМ из полей привязки.
  // Это автоматически покрывает и старые олимпиады (textbook_id), и новые табы (material_id),
  // игнорируя жесткие привязки к branch_type.
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .or(`material_id.eq.${id},textbook_id.eq.${id},crossword_id.eq.${id}`)
    .order("order_index", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("🔴 [ADMIN GET ASSIGNMENTS] Ошибка БД:", error.message);
    return fail(error.message, 500, "DB_ERROR");
  }

  return ok({ assignments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const title = String(body?.title ?? "").trim();
  const order_index = Number.isFinite(Number(body?.order_index)) ? Number(body.order_index) : 0;
  const content = body?.content;
  
  // Получаем тип задания, по умолчанию test
  const assignment_type = body?.assignment_type === "intro" ? "intro" : "test";

  if (!title) return fail("title required", 400, "VALIDATION");
  if (!content || typeof content !== "object") return fail("content required", 400, "VALIDATION");

  const mat = pickMaterial(body);
  if (mat.error) return fail(mat.error, 400, "VALIDATION");

  const payload: any = {
    title,
    order_index,
    content,
    assignment_type,
    created_by: user.id,

    branch_type: mat.branch_type,
    material_id: mat.material_id,
    textbook_id: mat.textbook_id,
    crossword_id: mat.crossword_id,
  };

  // Если фронтенд передает project_tab_id, бережно его сохраняем
  if (body?.project_tab_id) {
    payload.project_tab_id = body.project_tab_id;
  }

  const { data, error } = await supabase.from("assignments").insert(payload).select("*").single();

  if (error) {
    console.error("🔴 [ADMIN POST ASSIGNMENT] Ошибка создания:", error.message);
    return fail(error.message, 500, "DB_ERROR");
  }

  return ok({ assignment: data });
}