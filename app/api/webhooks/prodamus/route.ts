/* app/api/webhooks/prodamus/route.ts */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseProdamusBody,
  verifyProdamusSignature,
} from "@/lib/payments/prodamus";
import { grantAccessForRequest } from "@/lib/requests/grants";
import { toStringArray } from "@/lib/materials/normalize";
import { logProdamusPayment } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Статусы платежа, которые считаем успешными. Пустой статус тоже = успех. */
const SUCCESS_PAYMENT_STATUSES = new Set([
  "success",
  "succeeded",
  "paid",
  "payment_succeeded",
  "payment_success",
  "completed",
  "ok",
  "1",
  "true",
]);

type RequestRow = {
  id: string;
  user_id: string;
  request_number?: string | null;
  created_at?: string | null;
  email?: string | null;
  full_name?: string | null;
  branch_type?: string | null;
  textbook_types?: unknown;
  material_kinds?: unknown;
  target_level?: unknown;
  target_levels?: unknown;
  class_level?: unknown;
  material_ids?: unknown;
  total_price?: number | null;
  project_id?: string | null;
  is_processed?: boolean | null;
};

function nowISO() {
  return new Date().toISOString();
}

type MaterialTitleRow = {
  id?: string;
  title?: string | null;
};

function errorMessage(error: unknown, fallback = "Unknown error") {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Выдача доступов и пометка заявки обработанной — строго по схеме ручной
 * модерации (см. app/api/admin/requests/route.ts, ветка PATCH is_processed=true):
 *   1. grantAccessForRequest — material_access (upsert) + уведомления;
 *   2. delete + insert в purchase_request_grants;
 *   3. атомарная пометка is_processed=true (защита от гонки дублей вебхука);
 *   4. прогресс рефовода (best-effort, как в админке).
 */
async function grantAndMarkProcessed(
  supabase: SupabaseClient,
  requestRow: RequestRow,
): Promise<{ grantsToStoreCount: number }> {
  // Актор выдачи = сам покупатель (в вебхуке нет админ-сессии, а granted_by —
  // это uuid NOT NULL с FK на profiles). Тот же паттерн уже используется
  // в реферальной выдаче (granted_by: userId).
  const grantedBy = requestRow.user_id;
  const now = nowISO();

  const { grantsToStore } = await grantAccessForRequest(supabase, grantedBy, requestRow);

  const delGrants = await supabase
    .from("purchase_request_grants")
    .delete()
    .eq("request_id", requestRow.id);

  if (delGrants.error) {
    throw new Error(`delete grants: ${delGrants.error.message}`);
  }

  if (grantsToStore.length) {
    const insGrants = await supabase.from("purchase_request_grants").insert(grantsToStore);

    if (insGrants.error) {
      // Уникальный ключ (request_id, kind, item_id): если параллельный вебхук
      // уже вставил те же гранты — состояние корректно, можно продолжать.
      const msg = String(insGrants.error.message || "");
      const isConflict = msg.includes("duplicate key") || msg.includes("23505");
      if (!isConflict) {
        throw new Error(`insert grants: ${msg}`);
      }
    }
  }

  // Атомарный claim: только один из дублей вебхука пройдёт дальше.
  const { data: claimed, error: claimErr } = await supabase
    .from("purchase_requests")
    .update({ is_processed: true, processed_at: now })
    .eq("id", requestRow.id)
    .or("is_processed.eq.false,is_processed.is.null")
    .select("id")
    .maybeSingle();

  if (claimErr) {
    throw new Error(`claim request: ${claimErr.message}`);
  }

  if (!claimed) {
    console.warn(
      "[ProdamusWebhook] Заявка уже обработана параллельным вызовом, пропускаем. order_id=",
      requestRow.id,
    );
    return { grantsToStoreCount: grantsToStore.length };
  }

  // Прогресс рефовода — как в ручной модерации (не роняет обработку).
  try {
    await updateReferralProgress(supabase, requestRow, grantsToStore.length);
  } catch (error) {
    console.error(
      "[ProdamusWebhook] Ошибка обновления прогресса рефовода:",
      errorMessage(error),
    );
  }

  return { grantsToStoreCount: grantsToStore.length };
}

/** Логика из админки: +grantsCount к referral_materials_purchased у реферрера. */
async function updateReferralProgress(
  supabase: SupabaseClient,
  requestRow: RequestRow,
  grantsCount: number,
) {
  if (!grantsCount) return;

  const { data: refLink } = await supabase
    .from("user_referrals")
    .select("referrer_id, created_at")
    .eq("referred_id", requestRow.user_id)
    .eq("status", "active")
    .maybeSingle();

  if (!refLink?.referrer_id) return;

  const requestDate = new Date(requestRow.created_at || 0);
  const linkDate = new Date(refLink.created_at || 0);

  if (requestDate.getTime() < linkDate.getTime()) return;

  const { data: refProfile } = await supabase
    .from("profiles")
    .select("referral_materials_purchased")
    .eq("id", refLink.referrer_id)
    .maybeSingle();

  const oldCount = Number(refProfile?.referral_materials_purchased || 0);
  const newCount = oldCount + grantsCount;

  await supabase
    .from("profiles")
    .update({ referral_materials_purchased: newCount })
    .eq("id", refLink.referrer_id);
}

/** Заголовки материалов по material_ids (для записи в Google Sheets). */
async function fetchMaterialTitles(supabase: SupabaseClient, requestRow: RequestRow): Promise<string[]> {
  const ids = toStringArray(requestRow.material_ids);
  if (!ids.length) return [];

  const { data } = await supabase
    .from("materials")
    .select("id, title")
    .in("id", ids);

  const titleById = new Map<string, string>(
    (data ?? []).map((mat: MaterialTitleRow) => [
      String(mat.id ?? ""),
      String(mat.title ?? "").trim(),
    ]),
  );

  return ids.map((id) => titleById.get(id)).filter((title): title is string => Boolean(title));
}

/**
 * Синк успешной оплаты в Google Sheets (отдельный лист). Ошибка НЕ роняет
 * выдачу доступов: пишем в sheet_sync_error и всё равно отвечаем 200.
 */
async function syncProdamusSheet(supabase: SupabaseClient, requestRow: RequestRow) {
  const paidAt = nowISO();

  try {
    const materialTitles = await fetchMaterialTitles(supabase, requestRow);

    const result = await logProdamusPayment({
      fullName: requestRow.full_name || "",
      email: requestRow.email || "",
      totalPrice: Number(requestRow.total_price) || 0,
      paidAt,
      materialTitles,
    });

    await supabase
      .from("purchase_requests")
      .update({
        sheet_synced_at: nowISO(),
        sheet_sync_error: null,
      })
      .eq("id", requestRow.id);

    console.log("[ProdamusWebhook] Google Sheets row:", result.rowNumber ?? "?", "order_id=", requestRow.id);
  } catch (error) {
    const msg = errorMessage(error, "Sheets sync error").slice(0, 500);
    console.error("[ProdamusWebhook] Google Sheets sync error:", msg);

    await supabase
      .from("purchase_requests")
      .update({
        sheet_synced_at: null,
        sheet_sync_error: msg,
      })
      .eq("id", requestRow.id);
  }
}

export async function POST(req: NextRequest) {
  const contentType = String(req.headers.get("content-type") ?? "");

  // 1. Парсим тело (json или form в зависимости от content-type).
  let body: Record<string, unknown>;
  try {
    body = await parseProdamusBody(req);
  } catch (error) {
    console.error("[ProdamusWebhook] Failed to parse body:", errorMessage(error));
    return new Response("Bad Request", { status: 400 });
  }

  // 2. Верификация подписи Sign.
  const signHeader = req.headers.get("Sign");
  const valid = verifyProdamusSignature(body, signHeader);

  if (!valid) {
    const orderIdHint = String(body?.order_id ?? "").slice(0, 64);
    console.error(
      "[ProdamusWebhook][HACK?] Невалидная подпись Sign. order_id=" +
        orderIdHint +
        " content-type=" +
        contentType +
        " sign-length=" +
        String(signHeader?.length ?? 0),
    );
    return new Response("Bad Request", { status: 400 });
  }

  // 3. order_id — это id заявки из purchase_requests.
  const orderId = String(body?.order_id ?? "").trim();
  if (!orderId) {
    console.error("[ProdamusWebhook] Missing order_id in verified payload");
    return new Response("Bad Request", { status: 400 });
  }

  // 4. Защитная проверка статуса: обрабатываем только успешные оплаты.
  const rawStatus = String(body?.payment_status ?? body?.status ?? "").toLowerCase();
  if (rawStatus && !SUCCESS_PAYMENT_STATUSES.has(rawStatus)) {
    console.warn("[ProdamusWebhook] Платёж не успешен, пропускаем. order_id=" + orderId, rawStatus);
    return new Response("OK", { status: 200 });
  }

  const supabase = getSupabaseAdminClient();

  // 5. Поиск заявки по order_id.
  const { data: requestRow, error: loadErr } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (loadErr) {
    // Ошибка БД — вернём 500, чтобы Продамус повторил доставку.
    console.error("[ProdamusWebhook] DB load error:", loadErr.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  if (!requestRow) {
    // Подпись валидна, но заявка не найдена (удалена / заказ не наш). Не долбим ретраями.
    console.warn("[ProdamusWebhook] Заявка не найдена по order_id=", orderId);
    return new Response("OK", { status: 200 });
  }

  // 6. Идемпотентность: повторный вебхук по обработанной заявке.
  if (requestRow.is_processed === true) {
    console.log("[ProdamusWebhook] Повторный вебхук, заявка уже обработана. order_id=", orderId);
    return new Response("OK", { status: 200 });
  }

  // 7. Выдача доступов + пометка обработанной.
  try {
    await grantAndMarkProcessed(supabase, requestRow);
  } catch (error) {
    // До is_processed=true ещё не дошли (или дошли частично, но всё идемпотентно).
    // Отдаём 500, чтобы Продамус повторил доставку и процесс завершился.
    console.error(
      "[ProdamusWebhook] Processing error:",
      errorMessage(error),
      "order_id=",
      orderId,
    );
    return new Response("Internal Server Error", { status: 500 });
  }

  // 8. Google Sheets (отдельный лист) — не роняет выдачу.
  await syncProdamusSheet(supabase, requestRow);

  console.log("[ProdamusWebhook] Заявка обработана автоматически. order_id=", orderId);
  return new Response("OK", { status: 200 });
}



