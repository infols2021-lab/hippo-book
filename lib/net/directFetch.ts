// lib/net/directFetch.ts
import "server-only";

import { Agent, type Dispatcher } from "undici";

const directDispatcher = new Agent({
  connect: {
    timeout: 20_000,
  },
  headersTimeout: 30_000,
  bodyTimeout: 30_000,
});

type RequestInitWithDispatcher = RequestInit & {
  dispatcher?: Dispatcher;
};

/**
 * Server-side fetch без глобального proxy dispatcher.
 * Нужен для Supabase SSR client, если локально/на сервере включён proxy,
 * который рвёт соединение и даёт ECONNRESET / fetch failed.
 */
export async function directFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const finalInit: RequestInitWithDispatcher = {
    ...init,
    dispatcher: directDispatcher,
  };

  return fetch(input, finalInit);
}