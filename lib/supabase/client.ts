import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Browser (client-side) Supabase client singleton.
 * Надёжно: один клиент на вкладку, не пересоздаётся на каждый рендер.
 *
 * ⚠️ ВАЖНО:
 * Эти auth-настройки КРИТИЧНЫ для:
 * - recovery (reset password)
 * - magic link
 * - exchangeCodeForSession(code)
 */
export function getSupabaseBrowserClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _client = createBrowserClient(url, anon, {
    auth: {
      // ✅ ОБЯЗАТЕЛЬНО для восстановления пароля
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}
