/* lib/net/directFetch.ts */
import "server-only";

import { Agent, type Dispatcher } from "undici";

const directDispatcher = new Agent({
  connect: {
    timeout: 30_000,
  },
  headersTimeout: 120_000,
  bodyTimeout: 180_000,
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
});

type RequestInitWithDispatcher = RequestInit & {
  dispatcher?: Dispatcher;
};

/**
 * Server-side fetch c прямым undici dispatcher.
 *
 * Нужен для Supabase/Google/server-side запросов, если окружение или хостинг
 * подмешивает проблемный global proxy/agent и появляются:
 * - fetch failed
 * - ECONNRESET
 * - socket hang up
 * - terminated
 * - timeout
 */
export async function directFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const finalInit: RequestInitWithDispatcher = {
    ...init,
    dispatcher: directDispatcher,
  };

  return fetch(input, finalInit);
}