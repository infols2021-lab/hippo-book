import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

type BranchType = "olympiad" | "gatehouse";

type MatPick =
  | {
      branch_type: "olympiad";
      kind: "textbook";
      material_id: null;
      textbook_id: string;
      crossword_id: null;
      error?: undefined;
    }
  | {
      branch_type: "olympiad";
      kind: "crossword";
      material_id: null;
      textbook_id: null;
      crossword_id: string;
      error?: undefined;
    }
  | {
      branch_type: "gatehouse";
      kind: "material";
      material_id: string;
      textbook_id: null;
      crossword_id: null;
      error?: undefined;
    }
  | {
      error: string;
      branch_type?: undefined;
      kind?: undefined;
      material_id?: undefined;
      textbook_id?: undefined;
      crossword_id?: undefined;
    };

function normalizeBranchType(value: unknown): BranchType {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "gatehouse" || v === "ga" || v === "ga_exam" || v === "exam" || v === "gatehouse_awards") {
    return "gatehouse";
  }

  return "olympiad";
}

function pickMaterial(body: any): MatPick {
  const branch_type = normalizeBranchType(body?.branch_type);
  const kind = String(body?.kind || "").trim().toLowerCase();
  const material_id = String(body?.material_id || "").trim();

  const textbook_id = body?.textbook_id ? String(body.textbook_id).trim() : "";
  const crossword_id = body?.crossword_id ? String(body.crossword_id).trim() : "";

  if (branch_type === "gatehouse" || kind === "material") {
    if (!material_id) return { error: "material_id required for gatehouse assignment" };

    return {
      branch_type: "gatehouse",
      kind: "material",
      material_id,
      textbook_id: null,
      crossword_id: null,
    };
  }

  if (kind && material_id) {
    if (kind !== "textbook" && kind !== "crossword") return { error: "Bad kind" };

    if (kind === "textbook") {
      return {
        branch_type: "olympiad",
        kind: "textbook",
        material_id: null,
        textbook_id: material_id,
        crossword_id: null,
      };
    }

    return {
      branch_type: "olympiad",
      kind: "crossword",
      material_id: null,
      textbook_id: null,
      crossword_id: material_id,
    };
  }

  if (textbook_id) {
    return {
      branch_type: "olympiad",
      kind: "textbook",
      material_id: null,
      textbook_id,
      crossword_id: null,
    };
  }

  if (crossword_id) {
    return {
      branch_type: "olympiad",
      kind: "crossword",
      material_id: null,
      textbook_id: null,
      crossword_id,
    };
  }

  return { error: "kind/material_id or textbook_id/crossword_id required" };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id } = await ctx.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const title = String(body?.title ?? "").trim();
  const order_index = Number.isFinite(Number(body?.order_index)) ? Number(body.order_index) : 0;
  const content = body?.content;
  
  // Добавляем обработку типа задания
  const assignment_type = body?.assignment_type === "intro" ? "intro" : "test";

  if (!title) return fail("title required", 400, "VALIDATION");
  if (!content || typeof content !== "object") return fail("content required", 400, "VALIDATION");

  const mat = pickMaterial(body);
  if (mat.error) return fail(mat.error, 400, "VALIDATION");

  const payload: any = {
    title,
    order_index,
    content,
    assignment_type, // Сохраняем тип

    branch_type: mat.branch_type,
    material_id: mat.material_id,

    textbook_id: mat.textbook_id,
    crossword_id: mat.crossword_id,
  };

  const { data, error } = await supabase.from("assignments").update(payload).eq("id", id).select("*").single();

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ assignment: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id } = await ctx.params;

  const { error } = await supabase.from("assignments").delete().eq("id", id);

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ deleted: true });
}