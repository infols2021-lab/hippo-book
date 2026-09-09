// app/api/requests/grants/route.ts
// Состав материалов, выданных по конкретной заявке пользователя.
// Используется после оплаты (?payment=success&order_num=...) в профиле, чтобы
// модалка «Оплата успешно завершена» сразу показала список фактически
// открытых материалов без ожидания перезагрузки страницы.
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { isValidUUID } from "@/lib/api/validate";
import { normalizeString } from "@/lib/materials/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  const orderNum = normalizeString(req.nextUrl.searchParams.get("order_num"));
  if (!orderNum) {
    return ok({ requestId: null, materials: [] }, noStoreInit());
  }

  try {
    // Продамус передаёт в order_num request_number заявки (фолбэк — её uuid),
    // поэтому ищем оба варианта, строго в рамках текущего пользователя.
    let requestId = "";

    const { data: byNumber, error: numberErr } = await supabase
      .from("purchase_requests")
      .select("id")
      .eq("request_number", orderNum)
      .eq("user_id", user.id)
      .maybeSingle();

    if (numberErr) {
      return fail(numberErr.message, 500, "DB_ERROR", noStoreInit());
    }

    if (byNumber) {
      requestId = String(byNumber.id);
    } else if (isValidUUID(orderNum)) {
      const { data: byId, error: idErr } = await supabase
        .from("purchase_requests")
        .select("id")
        .eq("id", orderNum)
        .eq("user_id", user.id)
        .maybeSingle();

      if (idErr) {
        return fail(idErr.message, 500, "DB_ERROR", noStoreInit());
      }

      if (byId) requestId = String(byId.id);
    }

    if (!requestId) {
      return ok({ requestId: null, materials: [] }, noStoreInit());
    }

    const { data: grants, error: grantsErr } = await supabase
      .from("purchase_request_grants")
      .select("item_id, title, kind")
      .eq("request_id", requestId)
      .eq("user_id", user.id);

    if (grantsErr) {
      return fail(grantsErr.message, 500, "DB_ERROR", noStoreInit());
    }

    const materials = (grants ?? [])
      .map((g) => ({
        id: String(g.item_id ?? ""),
        title: String(g.title ?? "").trim(),
        kind: String(g.kind ?? ""),
      }))
      .filter((m) => m.id && m.title);

    return ok({ requestId, materials }, noStoreInit());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e || "Server error");
    return fail(message, 500, "SERVER_ERROR", noStoreInit());
  }
}
