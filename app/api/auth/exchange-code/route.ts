import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExchangeBody = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
};

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

function toSafeUser(user: any): SafeUser | null {
  if (!user?.id) return null;

  return {
    id: String(user.id),
    email: user.email ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}

function mapExchangeError(error: any) {
  const msg = String(error?.message || "").toLowerCase();

  if (
    msg.includes("invalid") ||
    msg.includes("expired") ||
    msg.includes("code verifier") ||
    msg.includes("pkce") ||
    msg.includes("otp")
  ) {
    return {
      message: "Ссылка недействительна или устарела. Запросите восстановление заново.",
      status: 401,
      code: "INVALID_OR_EXPIRED_LINK",
    };
  }

  return {
    message: "Не удалось обработать ссылку: " + (error?.message || "Неизвестная ошибка"),
    status: 400,
    code: "EXCHANGE_FAILED",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as ExchangeBody | null;

    if (!body) return fail("Bad request", 400, "BAD_REQUEST", noStoreInit());

    const code = String(body.code ?? "").trim();
    const accessToken = String(body.access_token ?? "").trim();
    const refreshToken = String(body.refresh_token ?? "").trim();

    if (!code && (!accessToken || !refreshToken)) {
      return fail(
        "Не найден код или токены восстановления. Откройте страницу по ссылке из письма.",
        400,
        "MISSING_AUTH_DATA",
        noStoreInit(),
      );
    }

    const supabase = await createSupabaseServerClient();

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        const mapped = mapExchangeError(error);
        return fail(mapped.message, mapped.status, mapped.code, noStoreInit());
      }

      return ok(
        {
          hasSession: Boolean(data.session),
          user: toSafeUser(data.user),
        },
        noStoreInit(),
      );
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      const mapped = mapExchangeError(error);
      return fail(mapped.message, mapped.status, mapped.code, noStoreInit());
    }

    return ok(
      {
        hasSession: Boolean(data.session),
        user: toSafeUser(data.user),
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