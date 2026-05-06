/* lib/supabase/client.ts */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<any> | null = null;

function mustPublicEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

/**
 * Browser Supabase client singleton.
 *
 * Используется только в client components.
 * Сейчас нужен для оставшихся client-side мест:
 * - recovery / reset password
 * - magic link / OAuth callback handling
 * - временные старые клиентские операции, которые ещё переносим на API routes
 */
export function getSupabaseBrowserClient(): SupabaseClient<any> {
  if (browserClient) {
    return browserClient;
  }

  const url = mustPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  browserClient = createBrowserClient<any>(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}