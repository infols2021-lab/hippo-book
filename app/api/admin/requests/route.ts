import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

type ReqRow = {
  id: string;
  user_id: string;
  request_number: string | null;
  created_at: string | null;
  processed_at: string | null;
  is_processed: boolean | null;
  full_name: string | null;
  email: string | null;
  class_level: any;
  textbook_types: any;
};

function toArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

async function buildGrantedMaterialsMap(supabase: any, adminId: string, userIds: string[]) {
  const map = new Map<string, string[]>();
  userIds.forEach((id) => map.set(id, []));

  if (!userIds.length) return map;

  const [tRes, cRes] = await Promise.all([
    supabase
      .from("textbook_access")
      .select("user_id, textbooks(title)")
      .eq("granted_by", adminId)
      .in("user_id", userIds),
    supabase
      .from("crossword_access")
      .select("user_id, crosswords(title)")
      .eq("granted_by", adminId)
      .in("user_id", userIds),
  ]);

  if (!tRes.error && tRes.data) {
    for (const row of tRes.data as any[]) {
      const title = row?.textbooks?.title;
      if (!title) continue;
      map.get(row.user_id)?.push(`📚 ${title}`);
    }
  }

  if (!cRes.error && cRes.data) {
    for (const row of cRes.data as any[]) {
      const title = row?.crosswords?.title;
      if (!title) continue;
      map.get(row.user_id)?.push(`🧩 ${title}`);
    }
  }

  // уникализируем
  for (const [k, v] of map.entries()) {
    map.set(k, Array.from(new Set(v)));
  }

  return map;
}

async function grantAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  const classLevels = toArr(r.class_level);
  const types = toArr(r.textbook_types).map((x) => x.toLowerCase());

  const granted: string[] = [];

  if (!classLevels.length) return granted;

  // учебники
  if (types.includes("учебник") || types.includes("textbook")) {
    const { data: textbooks, error } = await supabase
      .from("textbooks")
      .select("id,title,class_level")
      .eq("is_active", true)
      .overlaps("class_level", classLevels);

    if (error) throw new Error(error.message);

    for (const tb of (textbooks ?? []) as any[]) {
      const up = await supabase.from("textbook_access").upsert(
        {
          user_id: r.user_id,
          textbook_id: tb.id,
          granted_by: adminId,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "user_id,textbook_id" }
      );
      if (!up.error) granted.push(`📚 ${tb.title}`);
    }
  }

  // кроссворды
  if (types.includes("кроссворд") || types.includes("crossword")) {
    const { data: crosswords, error } = await supabase
      .from("crosswords")
      .select("id,title,class_level")
      .eq("is_active", true)
      .overlaps("class_level", classLevels);

    if (error) throw new Error(error.message);

    for (const cw of (crosswords ?? []) as any[]) {
      const up = await supabase.from("crossword_access").upsert(
        {
          user_id: r.user_id,
          crossword_id: cw.id,
          granted_by: adminId,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "user_id,crossword_id" }
      );
      if (!up.error) granted.push(`🧩 ${cw.title}`);
    }
  }

  return Array.from(new Set(granted));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  try {
    const sp = req.nextUrl.searchParams;
    const status = (sp.get("status") || "all").trim(); // all | pending | processed
    const name = (sp.get("name") || "").trim();
    const email = (sp.get("email") || "").trim();
    const includeMaterials = sp.get("includeMaterials") === "1";

    let q = supabase.from("purchase_requests").select("*").order("created_at", { ascending: false });

    if (status === "pending") q = q.eq("is_processed", false);
    if (status === "processed") q = q.eq("is_processed", true);

    if (name) q = q.ilike("full_name", `%${name}%`);
    if (email) q = q.ilike("email", `%${email}%`);

    const { data, error } = await q;
    if (error) return fail(error.message, 500, "DB_ERROR");

    const rows = (data ?? []) as ReqRow[];

    let materialsByUser: Record<string, string[]> = {};
    if (includeMaterials && rows.length) {
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const map = await buildGrantedMaterialsMap(supabase, user.id, userIds);
      materialsByUser = Object.fromEntries(map.entries());
    }

    return ok({ requests: rows, materialsByUser });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  const is_processed = Boolean(body?.is_processed);

  if (!ids.length) return fail("ids required", 400, "VALIDATION");

  try {
    // грузим заявки
    const { data: reqs, error: rErr } = await supabase
      .from("purchase_requests")
      .select("*")
      .in("id", ids);

    if (rErr) return fail(rErr.message, 500, "DB_ERROR");

    const rows = (reqs ?? []) as ReqRow[];

    const results: Record<string, { ok: boolean; granted?: string[]; error?: string }> = {};

    for (const r of rows) {
      try {
        let granted: string[] = [];

        if (is_processed) {
          granted = await grantAccessForRequest(supabase, user.id, r);
        } else {
          // откат: удаляем доступы, выданные этим админом (как в старом html)
          await supabase.from("textbook_access").delete().eq("user_id", r.user_id).eq("granted_by", user.id);
          await supabase.from("crossword_access").delete().eq("user_id", r.user_id).eq("granted_by", user.id);
        }

        const upd = await supabase
          .from("purchase_requests")
          .update({
            is_processed,
            processed_at: is_processed ? new Date().toISOString() : null,
          })
          .eq("id", r.id);

        if (upd.error) throw new Error(upd.error.message);

        results[r.id] = { ok: true, granted };
      } catch (e: any) {
        results[r.id] = { ok: false, error: e?.message || String(e) };
      }
    }

    return ok({ updated: true, results });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
