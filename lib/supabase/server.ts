/* lib/supabase/server.ts */
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { directFetch } from "@/lib/net/directFetch";

function mustPublicEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

/**
 * Supabase SSR client для Server Components / Route Handlers / Server Actions.
 *
 * Next 15+/16: cookies() async, поэтому обязательно await.
 * directFetch нужен для server-side запросов к Supabase, чтобы обходить проблемный
 * global dispatcher/proxy и не ловить fetch failed / ECONNRESET / timeout.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const url = mustPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient<any>(url, anon, {
    global: {
      fetch: directFetch,
    },

    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /**
           * В Server Components запись cookies может быть недоступна.
           * В Route Handlers / Server Actions cookies выставятся нормально.
           */
        }
      },
    },
  });
}