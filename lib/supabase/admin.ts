/* lib/supabase/admin.ts */
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { directFetch } from "@/lib/net/directFetch";

let adminClient: SupabaseClient<any> | null = null;
let adminClientKey = "";

function mustEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

function getClientKey(url: string, serviceRole: string) {
  return `${url}:${serviceRole.slice(0, 12)}`;
}

/**
 * Supabase Admin client через service_role.
 *
 * ВАЖНО:
 * - Только server-side.
 * - Никогда не импортировать в client components.
 * - intentionally any, пока нет сгенерированных Database types.
 */
export function getSupabaseAdminClient(): SupabaseClient<any> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  const nextKey = getClientKey(url, serviceRole);

  if (adminClient && adminClientKey === nextKey) {
    return adminClient;
  }

  adminClient = createClient<any>(url, serviceRole, {
    global: {
      fetch: directFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  adminClientKey = nextKey;

  return adminClient;
}