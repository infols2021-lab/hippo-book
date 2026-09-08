/* app/api/payments/prodamus-link/route.ts */
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { isValidUUID } from "@/lib/api/validate";
import { normalizeString, toStringArray } from "@/lib/materials/normalize";
import { buildProdamusPaymentUrl } from "@/lib/payments/prodamus";

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

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Возвращает ссылку на оплату Продамуса для заявки пользователя.
 *
 * order_id = id заявки (purchase_requests.id). Ссылка строится только для
 * необработанных заявок текущего пользователя.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const { supabase, user } = auth;

    const body = await safeJson(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
    }

    const requestId = normalizeString(body?.request_id);
    if (!requestId || !isValidUUID(requestId)) {
      return fail("request_id required", 400, "VALIDATION", noStoreInit());
    }

    // Проверяем конфиг до всех вызовов, чтобы клиент видел точную причину.
    const storeUrl = normalizeString(process.env.PRODAMUS_STORE_URL);
    if (!storeUrl) {
      console.error("[ProdamusLink] PRODAMUS_STORE_URL is not configured");
      return fail(
        "Платёжная система не настроена: не задан PRODAMUS_STORE_URL",
        500,
        "PAYMENT_NOT_CONFIGURED",
        noStoreInit()
      );
    }

    const { data: requestRow, error: loadErr } = await supabase
      .from("purchase_requests")
      .select(
        "id,user_id,request_number,email,total_price,material_ids,material_kinds,textbook_types,is_processed"
      )
      .eq("id", requestId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (loadErr) {
      console.error("[ProdamusLink] DB load error:", loadErr.message);
      return fail(loadErr.message, 500, "PAYMENT_LOAD_ERROR", noStoreInit());
    }

    if (!requestRow) {
      return fail("Заявка не найдена", 404, "NOT_FOUND", noStoreInit());
    }

    if (Boolean(requestRow.is_processed)) {
      return fail("Заявка уже обработана", 409, "ALREADY_PROCESSED", noStoreInit());
    }

    // Названия материалов из единой таблицы materials (для чека).
    const materialIds = toStringArray(requestRow.material_ids);
    let materialNames: string[] = [];

    if (materialIds.length > 0) {
      const { data: materials, error: materialsErr } = await supabase
        .from("materials")
        .select("id, title")
        .in("id", materialIds);

      if (materialsErr) {
        console.error("[ProdamusLink] Materials load error:", materialsErr.message);
        return fail(materialsErr.message, 500, "PAYMENT_LOAD_ERROR", noStoreInit());
      }

      const titleById = new Map<string, string>(
        (materials ?? []).map((mat: { id?: string; title?: string | null }) => [
          String(mat.id ?? ""),
          String(mat.title ?? ""),
        ])
      );

      materialNames = materialIds
        .map((id) => titleById.get(id))
        .filter((title): title is string => Boolean(title));
    }

    // Фолбэк для legacy-заявок без material_ids.
    if (materialNames.length === 0) {
      materialNames = toStringArray(
        requestRow.material_kinds ?? requestRow.textbook_types ?? []
      );
    }

    const origin = req.nextUrl?.origin || "https://hipposha-book.ru";

    const url = buildProdamusPaymentUrl(
      {
        id: requestRow.id,
        email: normalizeString(requestRow.email),
        total_price: Number(requestRow.total_price) || 0,
        materialNames,
      },
      {
        successUrl: `${origin}/payment/success`,
        returnUrl: `${origin}/payment/fail`,
      }
    );

    console.log("[ProdamusLink] OK order_id=", requestRow.id);
    return ok({ url }, noStoreInit());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error || "Unknown server error");
    console.error("[ProdamusLink] Unexpected error:", message);
    return fail(message, 500, "PAYMENT_LINK_ERROR", noStoreInit());
  }
}
