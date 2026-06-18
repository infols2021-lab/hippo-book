// lib/security/turnstile.ts
// Turnstile верификация — строгий режим для production, опциональный для dev/staging.

type VerifyArgs = {
  token: string;
  expectedAction?: string;
  remoteIp?: string | null;
};

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
};

/**
 * Верифицирует токен Turnstile.
 * 
 * Поведение:
 * - В production (NODE_ENV === 'production') — всегда строгая проверка.
 *   Если токен невалидный или отсутствует → возвращается { ok: false }.
 * - В разработке или если TURNSTILE_OPTIONAL=true — мягкий пропуск при проблемах.
 * 
 * Это защищает от ботов в проде, но не мешает локальной разработке.
 */
export async function verifyTurnstileToken(
  args: VerifyArgs
): Promise<
  | { ok: true; action?: string; skipped?: boolean }
  | { ok: false; code: string; details?: string }
> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  const isOptional = process.env.TURNSTILE_OPTIONAL === "true";

  // 1. Секрет не задан — только в dev/optional пропускаем, в production блокируем.
  if (!secret) {
    const msg = "[turnstile] TURNSTILE_SECRET_KEY не задан";
    if (isProduction && !isOptional) {
      console.error(msg + " — блокируем запрос (production)");
      return { ok: false, code: "TURNSTILE_MISSING_SECRET", details: "Secret not configured" };
    }
    console.warn(msg + " — пропускаем (dev/optional)");
    return { ok: true, skipped: true };
  }

  const token = (args.token || "").trim();

  // 2. Токен пустой — в production блокируем, иначе пропускаем.
  if (!token) {
    if (isProduction && !isOptional) {
      console.error("[turnstile] Токен отсутствует — блокируем (production)");
      return { ok: false, code: "TURNSTILE_MISSING_TOKEN", details: "Token is empty" };
    }
    console.warn("[turnstile] Токен отсутствует — пропускаем (dev/optional)");
    return { ok: true, skipped: true };
  }

  // 3. Вызов Cloudflare API.
  let json: TurnstileResponse | null = null;
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (args.remoteIp) form.set("remoteip", args.remoteIp);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }
    );
    json = (await res.json().catch(() => null)) as TurnstileResponse | null;
  } catch (err: any) {
    // Ошибка сети — в production блокируем, иначе пропускаем.
    if (isProduction && !isOptional) {
      console.error("[turnstile] Ошибка сети при верификации:", err?.message || err);
      return { ok: false, code: "TURNSTILE_NETWORK_ERROR", details: err?.message || "Network error" };
    }
    console.warn("[turnstile] Ошибка сети — пропускаем (dev/optional):", err?.message || err);
    return { ok: true, skipped: true };
  }

  // 4. Проверка ответа Cloudflare.
  if (!json?.success) {
    const codes = (json?.["error-codes"] || []).join(",");
    // В production — всегда блокируем, в dev/optional можно пропустить только определённые коды.
    if (isProduction && !isOptional) {
      console.error(`[turnstile] Ошибка верификации: ${codes}`);
      return { ok: false, code: "TURNSTILE_FAILED", details: codes || "unknown" };
    }

    // В dev/optional мягко пропускаем только определённые ошибки (загрузка виджета, таймаут).
    if (
      codes.includes("timeout-or-duplicate") ||
      codes.includes("missing-input-response")
    ) {
      console.warn(`[turnstile] Мягкий пропуск в dev/optional: ${codes}`);
      return { ok: true, skipped: true };
    }

    // Остальные ошибки (например, invalid-input-response) блокируем даже в dev.
    console.warn(`[turnstile] Ошибка верификации в dev/optional: ${codes}`);
    return { ok: false, code: "TURNSTILE_FAILED", details: codes || "unknown" };
  }

  // 5. Проверка action (если передана).
  if (
    args.expectedAction &&
    json.action &&
    json.action !== args.expectedAction
  ) {
    // В production — блокируем, иначе пропускаем (но с предупреждением).
    if (isProduction && !isOptional) {
      console.error(`[turnstile] Несовпадение action: ${json.action} != ${args.expectedAction}`);
      return { ok: false, code: "TURNSTILE_ACTION_MISMATCH", details: `${json.action} != ${args.expectedAction}` };
    }
    console.warn(`[turnstile] Несовпадение action (пропускаем в dev/optional): ${json.action} != ${args.expectedAction}`);
    // Всё равно возвращаем ok, но помечаем skipped.
    return { ok: true, action: json.action, skipped: true };
  }

  // ✅ Всё хорошо.
  return { ok: true, action: json.action };
}