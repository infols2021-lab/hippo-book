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
 * Каноническая строка для подписи по правилам Продамуса.
 *
 * ВАЖНО: Продамус НЕ подписывает сырое тело запроса. Он сортирует ключи
 * рекурсивно (в т.ч. внутри вложенных массивов/объектов), склеивает их в
 * строку `key=value`, затем считает HMAC-SHA256(hex) от полученной строки.
 *
 * Строка вынесена отдельно, чтобы вебхук мог залогировать её при расхождении
 * подписей (сгенерированная vs полученная) — это резко ускоряет диагностику.
 *
 * @param bodyObj Распарсенное тело вебхука (json → объект, form → плоский объект)
 */
export function buildProdamusSignatureString(
  bodyObj: Record<string, unknown> | null | undefined,
): string {
  if (!bodyObj || typeof bodyObj !== "object") {
    return "";
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

  return encode(dataToSign);
}

/**
 * Считает ожидаемую подпись HMAC-SHA256(hex) для тела вебхука.
 *
 * Секретный ключ из PRODAMUS_SECRET_KEY обязательно `.trim()` — в переменных
 * окружения (особенно при чтении из .env) часто прилипают пробелы/переносы,
 * из-за которых подпись никогда не совпадёт.
 *
 * @param bodyObj   Распарсенное тело вебхука
 * @param secretKey PRODAMUS_SECRET_KEY (опционально, иначе читается из env)
 */
export function computeProdamusSignature(
  bodyObj: Record<string, unknown> | null | undefined,
  secretKey?: string,
): string {
  const secret = String(secretKey || mustEnv("PRODAMUS_SECRET_KEY") || "").trim();
  if (!secret) {
    return "";
  }

  const encodedStr = buildProdamusSignatureString(bodyObj);
  if (!encodedStr) {
    return "";
  }

  return createHmac("sha256", secret).update(encodedStr).digest("hex").toLowerCase();
}

/**
 * Верификация подписи Продамуса.
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

  try {
    const expectedSign = computeProdamusSignature(bodyObj, secretKey);
    if (!expectedSign) {
      return false;
    }

    // Безопасное сравнение (timing-safe)
    const expectedBuffer = Buffer.from(expectedSign, "hex");
    const actualBuffer = Buffer.from(String(signatureHeader).trim().toLowerCase(), "hex");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    console.error(
      "[Prodamus] verifyProdamusSignature error:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

