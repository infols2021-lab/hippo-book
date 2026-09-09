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
 * Превращает плоские ключи form-urlencoded вида "products[0][name]" во
 * вложенный объект/массив — как PHP сам разберёт их в $_POST:
 *
 *   products[0][name]=тест&products[0][price]=100
 *     → { products: [ { name: "тест", price: "100" } ] }
 *
 * Именно такое вложенное представление использует официальная библиотека
 * Продамуса Hmac.php при формировании подписи.
 */
export function unflattenBody(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const rawKey of Object.keys(data ?? {})) {
    const val = data[rawKey];
    // Регулярка разбивает ключ вида products[0][name] на ['products', '0', 'name']
    const parts = rawKey.replace(/\]/g, "").split(/\[/);

    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = val;
      } else {
        const nextPart = parts[i + 1];
        const isNextIndex = /^\d+$/.test(nextPart);

        const existing = current[part];
        const isContainer = existing !== null && typeof existing === "object";

        if (!isContainer) {
          const created: unknown[] | Record<string, unknown> = isNextIndex ? [] : {};
          current[part] = created;
          current = created as unknown as Record<string, unknown>;
        } else {
          current = existing as Record<string, unknown>;
        }
      }
    }
  }

  return result;
}

/**
 * Рекурсивная сортировка ключей объекта по алфавиту (аналог ksort в PHP).
 * Массивы сортируются поэлементно (порядок индексов сохраняется).
 */
export function sortObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => sortObject(item));

  const record = obj as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortObject(record[key]);
  }

  return sorted;
}

/**
 * Строка для подписи по правилам официальной библиотеки Продамуса Hmac.php:
 *
 *   1. вырезаем sign/Sign из тела;
 *   2. разворачиваем плоские ключи products[0][name] во вложенные (unflattenBody);
 *   3. рекурсивно сортируем ключи (sortObject, аналог ksort);
 *   4. сериализуем в компактный JSON.
 *
 * Дефолтный JSON.stringify в JS не экранирует ни юникод, ни слэши и не
 * добавляет пробелы — это ровно соответствует PHP json_encode с флагами
 * JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES.
 *
 * Строка вынесена отдельно, чтобы вебхук мог залогировать её при расхождении
 * подписей (сгенерированная vs полученная).
 *
 * @param bodyObj Распарсенное тело вебхука (json → объект, form → плоский объект)
 */
export function buildProdamusSignatureJson(
  bodyObj: Record<string, unknown> | null | undefined,
): string {
  if (!bodyObj || typeof bodyObj !== "object") {
    return "";
  }

  // Вырезаем поле подписи, если оно вдруг прилетело вместе с данными
  const cleanData: Record<string, unknown> = { ...bodyObj };
  delete cleanData.sign;
  delete cleanData.Sign;

  const unflattened = unflattenBody(cleanData);
  const sorted = sortObject(unflattened);

  return JSON.stringify(sorted);
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

  const jsonString = buildProdamusSignatureJson(bodyObj);
  if (!jsonString) {
    return "";
  }

  return createHmac("sha256", secret).update(jsonString).digest("hex").toLowerCase();
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

