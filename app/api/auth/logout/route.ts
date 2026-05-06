import { NextResponse } from "next/server";
import { ok } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

async function logout() {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    const msg = String(error.message || "").toLowerCase();

    if (
      msg.includes("auth session missing") ||
      msg.includes("session missing") ||
      msg.includes("no session")
    ) {
      return ok({ message: "Вы уже вышли из аккаунта." }, noStoreInit());
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Не удалось выйти из аккаунта: " + error.message,
        code: "LOGOUT_FAILED",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store, max-age=0",
        },
      },
    );
  }

  return ok({ message: "Вы вышли из аккаунта." }, noStoreInit());
}

export async function POST() {
  try {
    return await logout();
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

export async function GET() {
  try {
    return await logout();
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