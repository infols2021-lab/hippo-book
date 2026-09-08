/* lib/payments/prodamus.ts */
import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

// ----------------------------------------------------------------------------
// Env
// ----------------------------------------------------------------------------

function mustEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

// ----------------------------------------------------------------------------
// Типы
// ----------------------------------------------------------------------------

/**
 * Входные данные для генерации ссылки на оплату.
 * Берутся из строки таблицы purchase_requests.
 */
export type ProdamusPaymentLinkInput = {
  /** id заявки — передаётся Продамусу как order_id и возвращается в вебхуке. */
  id: string;
  /** email покупателя (customer_email). */
  email: string;
  /** Итоговая цена заявки (total_price). */
  total_price: number;
  /** Названия материалов для чека (products[0][name]). */
  materialNames: string[];
};

/** Типизированная часть payload вебхука Продамуса (json или urlencoded). */
export type ProdamusWebhookPayload = {
  order_id?: string | number;
  customer_email?: string;
  payment_status?: string;
  status?: string;
  payment_sum?: string | number;
  sum?: string | number;
  [key: string]: unknown;
};

/** Опциональные параметры ссылки на оплату. */
export type ProdamusPaymentLinkOptions = {
  /** URL, куда Продамус вернёт покупателя после успешной оплаты (urlSuccess). */
  successUrl?: string | null;
  /** URL, куда Продамус вернёт покупателя при отмене/ошибке оплаты (urlReturn). */
  returnUrl?: string | null;
};

// ----------------------------------------------------------------------------
// Генератор ссылки на оплату
// ----------------------------------------------------------------------------

/**
 * Собирает ссылку на оплату Продамуса (do=link).
 *
 * Базовый URL берётся из PRODAMUS_STORE_URL. Названия материалов склеиваются
 * в единую позицию products[0][name], а total_price уходит в products[0][price].
 */
export function buildProdamusPaymentUrl(
  input: ProdamusPaymentLinkInput,
  options?: ProdamusPaymentLinkOptions,
): string {
  const base = mustEnv("PRODAMUS_STORE_URL").trim().replace(/\/+$/, "");

  if (!input?.id) {
    throw new Error("buildProdamusPaymentUrl: id (order_id) is required");
  }

  const names = (Array.isArray(input.materialNames) ? input.materialNames : [])
    .map((name) => String(name ?? "").trim())
    .filter(Boolean);
  const productName = names.join(", ") || "Материалы";
  const price = Math.round(Number(input.total_price) || 0);

  // Ключи продуктов храним в нотации products[0][name] (как ожидает Продамус),
  // значения кодируем через encodeURIComponent.
  const query = [
    "do=pay",
    `order_id=${encodeURIComponent(String(input.id))}`,
    `customer_email=${encodeURIComponent(String(input.email ?? "").trim())}`,
    `products[0][name]=${encodeURIComponent(productName)}`,
    `products[0][price]=${encodeURIComponent(String(price))}`,
    "products[0][quantity]=1",
  ];

  if (options?.successUrl) {
    query.push(`urlSuccess=${encodeURIComponent(options.successUrl)}`);
  }

  if (options?.returnUrl) {
    query.push(`urlReturn=${encodeURIComponent(options.returnUrl)}`);
  }

  return `${base}/?${query.join("&")}`;
}

// ----------------------------------------------------------------------------
// Верификация подписи вебхука (заголовок Sign)
// ----------------------------------------------------------------------------

/**
 * Верификация подписи Продамуса.
 *
 * ВАЖНО: Продамус НЕ подписывает сырое тело запроса. Он сортирует данные
 * рекурсивно по своим правилам, склеивает их, а затем считает
 * HMAC-SHA256(hex) от полученной строки.
 *
 * @param bodyObj          Распарсенное тело вебхука (json → объект, form → плоский объект)
 * @param signatureHeader  Значение заголовка Sign
 * @param secretKey        PRODAMUS_SECRET_KEY (опционально, иначе читается из env)
 */
export function verifyProdamusSignature(
  bodyObj: Record<string, unknown> | null | undefined,
  signatureHeader: string | null | undefined,
  secretKey?: string,
): boolean {
  if (!bodyObj || typeof bodyObj !== "object" || !signatureHeader) {
    return false;
  }

  const secret = secretKey || mustEnv("PRODAMUS_SECRET_KEY");
  if (!secret) {
    return false;
  }

  // Рекурсивный алгоритм сортировки и склейки по правилам Продамуса
  const encode = (data: unknown): string => {
    if (Array.isArray(data)) {
      return data.map(encode).join(";");
    }

    if (data !== null && typeof data === "object") {
      const record = data as Record<string, unknown>;
      return Object.keys(record)
        .sort()
        .map((key) => `${key}=${encode(record[key])}`)
        .join("&");
    }

    return String(data);
  };

  // Убираем поле подписи из тела, если оно вдруг прилетело вместе с данными
  const dataToSign: Record<string, unknown> = { ...bodyObj };
  delete dataToSign.sign;
  delete dataToSign.Sign;

  const encodedStr = encode(dataToSign);

  const expectedSign = createHmac("sha256", secret)
    .update(encodedStr)
    .digest("hex")
    .toLowerCase();

  // Безопасное сравнение (timing-safe)
  try {
    const expectedBuffer = Buffer.from(expectedSign, "hex");
    const actualBuffer = Buffer.from(signatureHeader.toLowerCase(), "hex");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Парсинг тела вебхука
// ----------------------------------------------------------------------------

/**
 * Парсит сырое тело вебхука Продамуса в JS-объект.
 *
 * Продамус может слать как application/json, так и
 * application/x-www-form-urlencoded. Вернувшийся объект передаётся
 * в verifyProdamusSignature как есть.
 *
 * @param rawBody     Сырое тело запроса (req.text())
 * @param contentType Значение заголовка content-type
 */
export function parseProdamusBody(
  rawBody: string,
  contentType?: string | null,
): Record<string, unknown> {
  const type = String(contentType ?? "").toLowerCase();
  const text = String(rawBody ?? "").trim();

  if (!text) {
    return {};
  }

  if (type.includes("application/json")) {
    try {
      const json: unknown = JSON.parse(text);
      return json && typeof json === "object" && !Array.isArray(json)
        ? (json as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  // urlencoded: плоский словарь key => value.
  const obj: Record<string, unknown> = {};

  try {
    for (const [key, value] of new URLSearchParams(text).entries()) {
      obj[key] = typeof value === "string" ? value : String(value);
    }
  } catch {
    return obj;
  }

  return obj;
}
