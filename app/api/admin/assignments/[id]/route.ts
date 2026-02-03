import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

type MatPick =
  | { kind: "textbook"; textbook_id: string; crossword_id: null; error?: undefined }
  | { kind: "crossword"; textbook_id: null; crossword_id: string; error?: undefined }
  | { error: string; kind?: undefined; textbook_id?: undefined; crossword_id?: undefined };

function pickMaterial(body: any): MatPick {
  const kind = String(body?.kind || "").trim();
  const material_id = String(body?.material_id || "").trim();

  const textbook_id = body?.textbook_id ? String(body.textbook_id).trim() : "";
  const crossword_id = body?.crossword_id ? String(body.crossword_id).trim() : "";

  if (kind && material_id) {
    if (kind !== "textbook" && kind !== "crossword") return { error: "Bad kind" };
    if (kind === "textbook") return { kind: "textbook", textbook_id: material_id, crossword_id: null };
    return { kind: "crossword", textbook_id: null, crossword_id: material_id };
  }

  if (textbook_id) return { kind: "textbook", textbook_id, crossword_id: null };
  if (crossword_id) return { kind: "crossword", textbook_id: null, crossword_id };

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

  if (!title) return fail("title required", 400, "VALIDATION");
  if (!content || typeof content !== "object") return fail("content required", 400, "VALIDATION");

  const mat = pickMaterial(body);
  if (mat.error) return fail(mat.error, 400, "VALIDATION");

  const payload: any = {
    title,
    order_index,
    content,
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
