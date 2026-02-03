import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string; code?: string };

export function ok<T extends Record<string, any>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data } satisfies ApiOk<T>, init);
}

export function fail(error: string, status = 400, code?: string, init?: ResponseInit) {
  const body: ApiErr = { ok: false, error, ...(code ? { code } : {}) };
  return NextResponse.json(body, { status, ...init });
}
