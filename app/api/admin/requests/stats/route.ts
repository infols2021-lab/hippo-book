// app/api/admin/requests/stats/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const { data, error } = await supabase.from("purchase_requests").select("id,is_processed");
    if (error) return fail(error.message, 500, "DB_ERROR");

    const rows = data ?? [];
    const total = rows.length;
    const pending = rows.filter((r: any) => !r.is_processed).length;
    const processed = total - pending;

    return ok({
      stats: { total, pending, processed },
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
