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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const kind = String(req.nextUrl.searchParams.get("kind") || "").trim();
  const id = String(req.nextUrl.searchParams.get("id") || "").trim();

  if (!kind || !id) return ok({ assignments: [] });

  let q = supabase.from("assignments").select("*");
  if (kind === "textbook") q = q.eq("textbook_id", id);
  else if (kind === "crossword") q = q.eq("crossword_id", id);
  else return fail("Bad kind", 400, "VALIDATION");

  const { data, error } = await q.order("order_index", { ascending: false }).order("created_at", { ascending: false });
  if (error) return fail(error.message, 500, "DB_ERROR");

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

  if (!title) return fail("title required", 400, "VALIDATION");
  if (!content || typeof content !== "object") return fail("content required", 400, "VALIDATION");

  const mat = pickMaterial(body);
  if (mat.error) return fail(mat.error, 400, "VALIDATION");

  const payload: any = {
    title,
    order_index,
    content,
    created_by: user.id,
    textbook_id: mat.textbook_id,
    crossword_id: mat.crossword_id,
  };

  const { data, error } = await supabase.from("assignments").insert(payload).select("*").single();
  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ assignment: data });
}
