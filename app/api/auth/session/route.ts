import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SafeUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
};

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function toSafeUser(user: any): SafeUser {
  return {
    id: String(user?.id ?? ""),
    email: user?.email ?? null,
    email_confirmed_at: user?.email_confirmed_at ?? null,
  };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const msg = String(error.message || "").toLowerCase();

      if (
        msg.includes("auth session missing") ||
        msg.includes("session missing") ||
        msg.includes("jwt") ||
        msg.includes("invalid token")
      ) {
        return ok(
          {
            authenticated: false,
            user: null,
            profile: null,
          },
          noStoreInit(),
        );
      }

      return fail("Auth fetch failed", 500, "AUTH_FETCH_FAILED", noStoreInit());
    }

    const user = data.user;

    if (!user?.id) {
      return ok(
        {
          authenticated: false,
          user: null,
          profile: null,
        },
        noStoreInit(),
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        full_name,
        contact_phone,
        region,
        is_admin,
        completed_assignments_count,
        ga_completed_assignments_count
      `,
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return fail("Profile fetch failed", 500, "PROFILE_FETCH_FAILED", noStoreInit());
    }

    return ok(
      {
        authenticated: true,
        user: toSafeUser(user),
        profile: profile ?? null,
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        code: "SERVER_ERROR",
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store, max-age=0",
        },
      },
    );
  }
}