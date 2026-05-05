// lib/supabase/server.ts
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { directFetch } from "@/lib/net/directFetch";

/**
 * Server Supabase client: Server Components / Route Handlers.
 *
 * В Next 15+ cookies() async -> обязательно await.
 * directFetch нужен, чтобы server-side запросы к Supabase не шли через
 * сломанный глобальный proxy/agent и не ловили ECONNRESET / 90s timeout.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anon, {
    global: {
      fetch: directFetch,
    },

    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // В Server Components set может быть недоступен.
          // Route Handlers / Server Actions смогут выставить cookies нормально.
        }
      },
    },
  });
}