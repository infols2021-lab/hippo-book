// app/api/admin/requests/route.ts
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

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function fmtLabel(kind: "textbook" | "crossword", title: string) {
  return `${kind === "textbook" ? "📚" : "🧩"} ${title}`;
}

/** материалы для ТАБА "обработанные" — показываем именно по заявке */
async function buildGrantedMaterialsByRequestMap(supabase: any, requestIds: string[]) {
  const map = new Map<string, string[]>();
  requestIds.forEach((id) => map.set(id, []));

  if (!requestIds.length) return map;

  const { data, error } = await supabase
    .from("purchase_request_grants")
    .select("request_id,kind,title")
    .in("request_id", requestIds);

  if (error || !data) return map;

  for (const row of data as any[]) {
    const request_id = String(row.request_id || "");
    const kind = String(row.kind || "") as "textbook" | "crossword";
    const title = String(row.title || "");
    if (!request_id || !title) continue;
    if (kind !== "textbook" && kind !== "crossword") continue;

    map.get(request_id)?.push(fmtLabel(kind, title));
  }

  for (const [k, v] of map.entries()) {
    map.set(k, uniq(v));
  }
  return map;
}

/** выдаём доступы и готовим строки для purchase_request_grants */
async function grantAccessForRequest(supabase: any, adminId: string, r: ReqRow) {
  const classLevels = toArr(r.class_level);
  const types = toArr(r.textbook_types).map((x) => String(x).toLowerCase());

  const nowISO = new Date().toISOString();

  const grantedLabels: string[] = [];
  const grantsToStore: Array<{
    request_id: string;
    user_id: string;
    kind: "textbook" | "crossword";
    item_id: string;
    title: string;
    granted_by: string;
    granted_at: string;
  }> = [];

  if (!classLevels.length) return { grantedLabels: [], grantsToStore: [] };

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
          granted_at: nowISO,
        },
        { onConflict: "user_id,textbook_id" }
      );

      if (!up.error) {
        grantedLabels.push(`📚 ${tb.title}`);
        grantsToStore.push({
          request_id: r.id,
          user_id: r.user_id,
          kind: "textbook",
          item_id: tb.id,
          title: tb.title,
          granted_by: adminId,
          granted_at: nowISO,
        });
      }
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
          granted_at: nowISO,
        },
        { onConflict: "user_id,crossword_id" }
      );

      if (!up.error) {
        grantedLabels.push(`🧩 ${cw.title}`);
        grantsToStore.push({
          request_id: r.id,
          user_id: r.user_id,
          kind: "crossword",
          item_id: cw.id,
          title: cw.title,
          granted_by: adminId,
          granted_at: nowISO,
        });
      }
    }
  }

  return { grantedLabels: uniq(grantedLabels), grantsToStore };
}

/** есть ли другая обработанная заявка, которая тоже “держит” этот материал */
async function existsOtherProcessedGrant(
  supabase: any,
  requestId: string,
  userId: string,
  kind: "textbook" | "crossword",
  itemId: string
) {
  const { data, error } = await supabase
    .from("purchase_request_grants")
    .select("request_id, purchase_requests!inner(is_processed)")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("item_id", itemId)
    .neq("request_id", requestId)
    .eq("purchase_requests.is_processed", true)
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

/** для возврата: какие материалы были выданы по этой заявке */
async function getTargetsForUnprocess(supabase: any, r: ReqRow) {
  const { data, error } = await supabase
    .from("purchase_request_grants")
    .select("kind,item_id,title,granted_by")
    .eq("request_id", r.id);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];
  return rows.map((x) => ({
    kind: String(x.kind) as "textbook" | "crossword",
    item_id: String(x.item_id),
    title: String(x.title),
    granted_by: String(x.granted_by || ""),
  }));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const sp = req.nextUrl.searchParams;
    const status = (sp.get("status") || "all").trim(); // all | pending | processed
    const name = (sp.get("name") || "").trim();
    const email = (sp.get("email") || "").trim();
    const includeMaterials = sp.get("includeMaterials") === "1";

    let q = supabase.from("purchase_requests").select("*");

    if (status === "pending") q = q.eq("is_processed", false).order("created_at", { ascending: false });
    else if (status === "processed")
      q = q.eq("is_processed", true).order("processed_at", { ascending: false }).order("created_at", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    if (name) q = q.ilike("full_name", `%${name}%`);
    if (email) q = q.ilike("email", `%${email}%`);

    const { data, error } = await q;
    if (error) return fail(error.message, 500, "DB_ERROR");

    const rows = (data ?? []) as ReqRow[];

    let materialsByRequest: Record<string, string[]> = {};
    if (includeMaterials && rows.length) {
      const requestIds = rows.map((r) => r.id).filter(Boolean);
      const map = await buildGrantedMaterialsByRequestMap(supabase, requestIds);
      materialsByRequest = Object.fromEntries(map.entries());
    }

    return ok({ requests: rows, materialsByRequest });
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
    const { data: reqs, error: rErr } = await supabase.from("purchase_requests").select("*").in("id", ids);
    if (rErr) return fail(rErr.message, 500, "DB_ERROR");

    const rows = (reqs ?? []) as ReqRow[];

    const results: Record<string, { ok: boolean; granted?: string[]; error?: string }> = {};

    for (const r of rows) {
      try {
        let granted: string[] = [];

        if (is_processed) {
          // 1) выдаём доступы
          const { grantedLabels, grantsToStore } = await grantAccessForRequest(supabase, user.id, r);

          // 2) обновляем “что выдано по этой заявке”
          await supabase.from("purchase_request_grants").delete().eq("request_id", r.id);

          if (grantsToStore.length) {
            const ins = await supabase.from("purchase_request_grants").insert(grantsToStore);
            if (ins.error) throw new Error(ins.error.message);
          }

          granted = grantedLabels;
        } else {
          // ✅ ВОЗВРАТ: снимаем доступ ТОЛЬКО по выданному в ЭТОЙ заявке
          // ✅ ВАЖНО: НЕ фильтруем по granted_by, иначе другой админ не сможет корректно вернуть
          const targets = await getTargetsForUnprocess(supabase, r);

          for (const t of targets) {
            // если этот материал всё ещё “нужен” другой обработанной заявке — НЕ трогаем
            const keep = await existsOtherProcessedGrant(supabase, r.id, r.user_id, t.kind, t.item_id);
            if (keep) continue;

            if (t.kind === "textbook") {
              const del = await supabase
                .from("textbook_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("textbook_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
            } else {
              const del = await supabase
                .from("crossword_access")
                .delete()
                .eq("user_id", r.user_id)
                .eq("crossword_id", t.item_id);

              if (del.error) throw new Error(del.error.message);
            }
          }

          // чистим историю выдачи этой заявки (важно делать ПОСЛЕ удаления access)
          await supabase.from("purchase_request_grants").delete().eq("request_id", r.id);
        }

        // обновляем статус заявки
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
