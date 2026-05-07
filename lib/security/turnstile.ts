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

export async function verifyTurnstileToken(
  args: VerifyArgs
): Promise<
  | { ok: true; action?: string; skipped?: boolean }
  | { ok: false; code: string; details?: string }
> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Если секрет не задан — пропускаем (dev-режим или Turnstile отключён)
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY не задан — верификация пропущена");
    return { ok: true, skipped: true };
  }

  const token = (args.token || "").trim();

  // Если токен пустой — значит виджет не загрузился (заблокирован в РФ, сеть и т.д.)
  // Пропускаем мягко, не блокируем пользователя
  if (!token) {
    console.warn("[turnstile] Токен отсутствует — виджет не загрузился, верификация пропущена");
    return { ok: true, skipped: true };
  }

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
  } catch (e: any) {
    // Сеть недоступна (например, сервер не может достучаться до Cloudflare)
    // Пропускаем мягко — не блокируем пользователя из-за инфраструктуры
    console.warn("[turnstile] Ошибка сети при верификации:", e?.message || e);
    return { ok: true, skipped: true };
  }

  if (!json?.success) {
    const codes = (json?.["error-codes"] || []).join(",");

    // timeout-or-duplicate и missing-input-response — часто означают
    // что виджет не загрузился нормально (заблокирован). Пропускаем мягко.
    if (
      codes.includes("timeout-or-duplicate") ||
      codes.includes("missing-input-response")
    ) {
      console.warn("[turnstile] Мягкий пропуск по коду:", codes);
      return { ok: true, skipped: true };
    }

    return { ok: false, code: "TURNSTILE_FAILED", details: codes || "unknown" };
  }

  // Проверка action — мягко (если action не пришёл, не валим)
  if (
    args.expectedAction &&
    json.action &&
    json.action !== args.expectedAction
  ) {
    return {
      ok: false,
      code: "TURNSTILE_ACTION_MISMATCH",
      details: `${json.action} != ${args.expectedAction}`,
    };
  }

  return { ok: true, action: json.action };
}