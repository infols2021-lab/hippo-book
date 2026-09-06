// app/api/admin/users/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { buildIlikeOrFilter, isValidUUID } from "@/lib/api/validate";
import type { NextRequest } from "next/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_phone: string | null;
  region: string | null;
  is_admin: boolean;
  created_at: string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim();
    const region = (sp.get("region") || "").trim();
    const materials = (sp.get("materials") || "").trim();

    let query = supabase
      .from("profiles")
      .select("id,full_name,email,contact_phone,region,is_admin,created_at")
      .order("created_at", { ascending: false });

    // ✅ Безопасный поиск через ILIKE с экранированием и quoted PostgREST values
    if (q) {
      query = query.or(
        buildIlikeOrFilter(["full_name", "email", "contact_phone"], q)
      );
    }

    if (region) {
      query = query.eq("region", region);
    }

    const { data: usersRaw, error: uErr } = await query;

    if (uErr) return fail(uErr.message, 500, "DB_ERROR");

    const users = (usersRaw ?? []) as ProfileRow[];
    const userIds = users.map((u) => u.id);

    const hasSet = new Set<string>();

    if (userIds.length) {
      const { data: ma, error: maErr } = await supabase
        .from("material_access")
        .select("user_id")
        .in("user_id", userIds);

      if (maErr) return fail(maErr.message, 500, "DB_ERROR");

      for (const r of ma ?? []) hasSet.add(String((r as any).user_id));
    }

    let usersWithFlag = users.map((u) => ({ ...u, hasMaterials: hasSet.has(u.id) }));

    if (materials === "has") usersWithFlag = usersWithFlag.filter((u) => u.hasMaterials);
    if (materials === "none") usersWithFlag = usersWithFlag.filter((u) => !u.hasMaterials);

    const stats = {
      totalUsers: usersWithFlag.length,
      usersWithMaterials: usersWithFlag.filter((u) => u.hasMaterials).length,
    };

    return ok({ users: usersWithFlag, stats });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  let body: any;

  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const userId = String(body?.user_id || "").trim();
  const is_admin = Boolean(body?.is_admin);

  if (!userId || !isValidUUID(userId)) {
    return fail("Некорректный user_id", 400, "VALIDATION");
  }

  const { error } = await supabase.from("profiles").update({ is_admin }).eq("id", userId);

  if (error) return fail(error.message, 500, "DB_ERROR");

  return ok({ updated: true });
}