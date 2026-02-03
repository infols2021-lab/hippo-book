import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient<any> | null = null;

/**
 * Supabase Admin client (service_role).
 * ВАЖНО: здесь intentionally any, чтобы TS не превращал таблицы в never
 * (пока ты не подключил сгенерированные Database types).
 */
export function getSupabaseAdminClient(): SupabaseClient<any> {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

  _adminClient = createClient<any>(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _adminClient;
}
