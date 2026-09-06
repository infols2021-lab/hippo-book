import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string; code?: string };

export function ok<T extends Record<string, any>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data } satisfies ApiOk<T>, init);
}

/**
 * Безопасный текст для внутренних ошибок (не раскрываем схемы БД/стек клиенту).
 */
const INTERNAL_ERROR_MESSAGES: Partial<Record<string, string>> = {
  DB_ERROR: "Ошибка базы данных. Попробуйте позже.",
  SERVER_ERROR: "Внутренняя ошибка сервера. Попробуйте позже.",
};

export function fail(error: string, status = 400, code?: string, init?: ResponseInit) {
  const isInternal = code === "DB_ERROR" || code === "SERVER_ERROR";

  // Сырой текст ошибки (Postgres и т.п.) логируем ТОЛЬКО на сервере.
  if (isInternal && error) {
    console.error(`[${code}]`, error);
  }

  const body: ApiErr = {
    ok: false,
    // Клиенту отдаём обобщённый текст вместо сырой ошибки БД/сервера.
    error: isInternal ? (INTERNAL_ERROR_MESSAGES[code] ?? "Внутренняя ошибка сервера.") : error,
    ...(code ? { code } : {}),
  };
  return NextResponse.json(body, { status, ...init });
}
