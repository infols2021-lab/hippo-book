import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DataAuthProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  contact_phone: string | null;
  region: string | null;
  is_admin: boolean | null;
  completed_assignments_count?: number | null;
  ga_completed_assignments_count?: number | null;
};

export type DataAuthContext = {
  supabase: SupabaseServerClient;
  user: User;
  profile: DataAuthProfile | null;
};

export type DataAuthError = {
  status: number;
  code: string;
  message: string;
};

export type DataAuthResult =
  | {
      ok: true;
      ctx: DataAuthContext;
    }
  | {
      ok: false;
      error: DataAuthError;
    };

const DEFAULT_PROFILE_SELECT = `
  id,
  email,
  full_name,
  contact_phone,
  region,
  is_admin,
  completed_assignments_count,
  ga_completed_assignments_count
`;

function isMissingSessionError(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();

  return (
    msg.includes("auth session missing") ||
    msg.includes("session missing") ||
    msg.includes("no session") ||
    msg.includes("jwt") ||
    msg.includes("invalid token")
  );
}

function normalizeProfile(row: any): DataAuthProfile | null {
  if (!row?.id) return null;

  return {
    id: String(row.id),
    email: typeof row.email === "string" ? row.email : null,
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    contact_phone: typeof row.contact_phone === "string" ? row.contact_phone : null,
    region: typeof row.region === "string" ? row.region : null,
    is_admin: typeof row.is_admin === "boolean" ? row.is_admin : null,
    completed_assignments_count:
      typeof row.completed_assignments_count === "number" ? row.completed_assignments_count : null,
    ga_completed_assignments_count:
      typeof row.ga_completed_assignments_count === "number" ? row.ga_completed_assignments_count : null,
  };
}

export async function getDataAuthContext(options?: {
  requireProfile?: boolean;
  profileSelect?: string;
}): Promise<DataAuthResult> {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    if (isMissingSessionError(authError)) {
      return {
        ok: false,
        error: {
          status: 401,
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
      };
    }

    return {
      ok: false,
      error: {
        status: 500,
        code: "AUTH_FETCH_FAILED",
        message: authError.message || "Auth fetch failed",
      },
    };
  }

  if (!authData.user) {
    return {
      ok: false,
      error: {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      },
    };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(options?.profileSelect || DEFAULT_PROFILE_SELECT)
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: {
        status: 500,
        code: "PROFILE_FETCH_FAILED",
        message: profileError.message || "Profile fetch failed",
      },
    };
  }

  const profile = normalizeProfile(profileRow);

  if (options?.requireProfile && !profile) {
    return {
      ok: false,
      error: {
        status: 404,
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found",
      },
    };
  }

  return {
    ok: true,
    ctx: {
      supabase,
      user: authData.user,
      profile,
    },
  };
}

export async function requireDataAuthContext(options?: {
  requireProfile?: boolean;
  profileSelect?: string;
}): Promise<DataAuthContext> {
  const result = await getDataAuthContext(options);

  if (!result.ok) {
    const error = new Error(result.error.message) as Error & {
      status?: number;
      code?: string;
    };

    error.status = result.error.status;
    error.code = result.error.code;

    throw error;
  }

  return result.ctx;
}

export async function getProfileByUserId(
  supabase: SupabaseServerClient,
  userId: string,
  select = DEFAULT_PROFILE_SELECT,
): Promise<DataAuthProfile | null> {
  const { data, error } = await supabase.from("profiles").select(select).eq("id", userId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeProfile(data);
}

export function getSafeUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}

export function isAdminProfile(profile: DataAuthProfile | null | undefined) {
  return Boolean(profile?.is_admin);
}