/* app/api/webhooks/prodamus/route.ts */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/api/validate";
import {
  buildProdamusSignatureJson,
  computeProdamusSignature,
  verifyProdamusSignature,
} from "@/lib/payments/prodamus";
import { grantAccessForRequest } from "@/lib/requests/grants";
import { toStringArray } from "@/lib/materials/normalize";
import { logProdamusPayment } from "@/lib/integrations/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * Ищет заявку по orderRef (Продамус возвращает наш id в order_num или order_id).
 * Сначала пробуем request_number, затем id (uuid) — железобетонно для обоих сценариев.
 */
async function findRequestByOrderRef(
  supabase: SupabaseClient,
  orderRef: string,
): Promise<RequestRow | null> {
  // 1) По request_number (человекочитаемый PR-номер).
  const byNumber = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("request_number", orderRef)
    .maybeSingle();

  if (byNumber.data) {
    return byNumber.data as RequestRow;
  }
  if (byNumber.error) {
    console.error("[ProdamusWebhook] Ошибка поиска по request_number:", byNumber.error.message);
  }

  // 2) По id (uuid) — только если это валидный uuid, чтобы не ловить ошибку каста.
  if (isValidUUID(orderRef)) {
    const byId = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("id", orderRef)
      .maybeSingle();

    if (byId.data) {
      return byId.data as RequestRow;
    }
    if (byId.error) {
      console.error("[ProdamusWebhook] Ошибка поиска по id:", byId.error.message);
    }
  } else {
    console.log("[ProdamusWebhook] orderRef не похож на uuid, поиск по id пропущен.");
  }

  return null;
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
  const startedAt = Date.now();
  const method = req.method;
  const contentType = String(req.headers.get("content-type") ?? "");
  const signHeader = String(req.headers.get("Sign") ?? req.headers.get("sign") ?? "").trim();

  // 1. Подробный лог входящего запроса: метод, заголовки (особенно Sign и
  //    Content-Type) и сырое тело. Продамус ретраит не-200 ответы, поэтому
  //    по этим логам удобно сверять подпись/поля даже после ошибок.
  const headersLog: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersLog[key] = value;
  });

  console.log("[ProdamusWebhook] ──────────────────────────────────────────");
  console.log("[ProdamusWebhook] Входящий POST вебхук. method=", method, "| url=", req.url);
  console.log("[ProdamusWebhook] Content-Type=", contentType);
  console.log("[ProdamusWebhook] Заголовки:", JSON.stringify(headersLog));
  console.log("[ProdamusWebhook] Sign=", signHeader || "(отсутствует)");

  // 2. Сырое тело (читаем один раз и логируем, затем «переигрываем» запрос,
  //    чтобы ниже можно было использовать req.formData()).
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (error) {
    console.error("[ProdamusWebhook] Не удалось прочитать тело:", errorMessage(error));
    return new Response("Bad Request", { status: 400 });
  }
  console.log("[ProdamusWebhook] Сырое тело:", rawBody.slice(0, 6000) || "(пусто)");

  // 3. Универсальный парсинг тела. Продамус присылает вебхук НЕ в чистом JSON,
  //    а как multipart/form-data (см. help.prodamus.ru: «Веб-хук отправляется
  //    POST-запросом в формате multipart/form-data»). Раньше тело парсилось
  //    через URLSearchParams от req.text() — для multipart это давало мусор,
  //    подпись не сходилась, и мы отвечали 400.
  let body: Record<string, unknown>;
  try {
    if (contentType.includes("application/json")) {
      const parsedJson: unknown = rawBody ? JSON.parse(rawBody) : {};
      body =
        parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)
          ? (parsedJson as Record<string, unknown>)
          : {};
    } else {
      // req.text() уже «съел» стрим тела, поэтому собираем новый Request
      // из сырой строки — formData() сам разберёт и multipart, и urlencoded.
      // Content-length/transfer-encoding не копируем: длина тела после
      // «переигрывания» может отличаться от исходной.
      const replayHeaders: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey === "content-length" || lowerKey === "transfer-encoding") return;
        replayHeaders[key] = value;
      });
      const replayReq = new Request(req.url, {
        method: "POST",
        headers: replayHeaders,
        body: rawBody,
      });
      const formData = await replayReq.formData();
      body = {};
      formData.forEach((value, key) => {
        body[key] = typeof value === "string" ? value : String(value);
      });
    }
  } catch (error) {
    console.error(
      "[ProdamusWebhook] Ошибка парсинга тела. content-type=",
      contentType,
      "| error=",
      errorMessage(error),
    );
    return new Response("Bad Request", { status: 400 });
  }

  if (!body || Object.keys(body).length === 0) {
    console.error("[ProdamusWebhook] Тело пустое или не распарсилось. content-type=", contentType);
    return new Response("Bad Request", { status: 400 });
  }
  console.log("[ProdamusWebhook] Распарсенное тело:", JSON.stringify(body).slice(0, 6000));

  // 4. Верификация подписи. При расхождении логируем КАНОНИЧЕСКУЮ строку,
  //    нашу подпись и полученную — чтобы было видно точную причину 400.
  if (!signHeader) {
    console.error(
      "[ProdamusWebhook][SIGN-FAIL] Заголовок Sign отсутствует. headers=",
      JSON.stringify(headersLog),
    );
    return new Response("Bad Request", { status: 400 });
  }

  let expectedSign = "";
  try {
    expectedSign = computeProdamusSignature(body);
  } catch (error) {
    console.error(
      "[ProdamusWebhook][SIGN-FAIL] computeProdamusSignature завершился ошибкой " +
        "(проверьте PRODAMUS_SECRET_KEY в env):",
      errorMessage(error),
    );
    return new Response("Internal Server Error", { status: 500 });
  }
  const receivedSign = signHeader.toLowerCase();

  if (!expectedSign) {
    console.error(
      "[ProdamusWebhook][SIGN-FAIL] Не задан/пуст PRODAMUS_SECRET_KEY или нечего подписывать.",
    );
    return new Response("Internal Server Error", { status: 500 });
  }

  const valid = verifyProdamusSignature(body, receivedSign);

  if (!valid) {
    console.error(
      "[ProdamusWebhook][SIGN-FAIL] Подпись НЕ совпала.\n" +
        "  jsonString     = " + buildProdamusSignatureJson(body) + "\n" +
        "  computed (ours) = " + expectedSign + "\n" +
        "  received (Sign) = " + receivedSign,
    );
    return new Response("Bad Request", { status: 400 });
  }

  console.log(
    "[ProdamusWebhook] Подпись валидна. Sign=",
    receivedSign,
    "| обработка заняла",
    Date.now() - startedAt,
    "ms",
  );

  // 5. order_ref: Продамус возвращает наш id в order_num (иногда в order_id).
  const orderRef = String(body?.order_num ?? body?.order_id ?? "").trim();
  console.log(
    "[ProdamusWebhook] order_num=",
    String(body?.order_num ?? ""),
    "| order_id=",
    String(body?.order_id ?? ""),
    "| orderRef=",
    orderRef,
  );

  if (!orderRef) {
    console.error("[ProdamusWebhook] В payload нет order_num/order_id");
    return new Response("Bad Request", { status: 400 });
  }

  // 6. Статус платежа: выдаём доступы только при payment_status = success.
  const paymentStatusRaw = String(body?.payment_status ?? "").trim();
  const paymentStatus = paymentStatusRaw.toLowerCase();
  console.log("[ProdamusWebhook] payment_status=", JSON.stringify(paymentStatusRaw));

  if (paymentStatus && paymentStatus !== "success") {
    console.warn(
      "[ProdamusWebhook] payment_status != 'success' -> пропускаем выдачу. orderRef=" + orderRef,
    );
    return new Response("OK", { status: 200 });
  }

  if (!paymentStatus) {
    console.warn("[ProdamusWebhook] payment_status отсутствует в payload — продолжаем по умолчанию.");
  }

  const supabase = getSupabaseAdminClient();

  // 7. Поиск заявки: сначала по request_number, затем по id (uuid).
  const requestRow = await findRequestByOrderRef(supabase, orderRef);

  if (!requestRow) {
    console.error("[ProdamusWebhook] Заявка не найдена по orderRef=", orderRef);
    return new Response("OK", { status: 200 });
  }

  console.log(
    "[ProdamusWebhook] Заявка найдена:",
    JSON.stringify({
      id: requestRow.id,
      request_number: requestRow.request_number,
      user_id: requestRow.user_id,
      material_ids: requestRow.material_ids ?? [],
      total_price: requestRow.total_price ?? null,
      email: requestRow.email ?? "",
      full_name: requestRow.full_name ?? "",
      is_processed: requestRow.is_processed,
    }),
  );

  // 8. Идемпотентность: повторный вебхук по обработанной заявке.
  if (requestRow.is_processed === true) {
    console.log("[ProdamusWebhook] Повторный вебхук, заявка уже обработана. id=", requestRow.id);
    return new Response("OK", { status: 200 });
  }

  // 9. Выдача доступов + пометка обработанной.
  try {
    console.log("[ProdamusWebhook] Начинаем выдачу доступов. id=", requestRow.id);
    const grantResult = await grantAndMarkProcessed(supabase, requestRow);
    console.log(
      "[ProdamusWebhook] Доступы выданы. grants=",
      grantResult.grantsToStoreCount,
      "id=",
      requestRow.id,
    );
  } catch (error) {
    // До is_processed=true ещё не дошли (или дошли частично, но всё идемпотентно).
    // Отдаём 500, чтобы Продамус повторил доставку и процесс завершился.
    console.error(
      "[ProdamusWebhook] Ошибка при выдаче доступов:",
      errorMessage(error),
      "id=",
      requestRow.id,
    );
    return new Response("Internal Server Error", { status: 500 });
  }

  // 10. Google Sheets (отдельный лист) — не роняет выдачу.
  await syncProdamusSheet(supabase, requestRow);

  console.log("[ProdamusWebhook] Заявка обработана автоматически. id=", requestRow.id);
  return new Response("OK", { status: 200 });
}



