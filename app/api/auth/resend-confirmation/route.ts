// app/api/auth/resend-confirmation/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api/response";
import { directFetch } from "@/lib/net/directFetch";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendBody = {
  email?: string;
  captchaToken?: string;
};

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRemoteIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const xr = req.headers.get("x-real-ip");
  return xr || null;
}

function getAppUrl(req: Request): string | null {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (!host) return null;

  return `${proto}://${host}`;
}

function mapResendError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (msg.includes("rate limit") || code === "rate_limit_exceeded") {
    return {
      message: "⚠️ Слишком много попыток. Попробуйте через несколько минут.",
      status: 429,
      code: "RATE_LIMIT",
    };
  }

  if (msg.includes("email rate limit")) {
    return {
      message: "⚠️ Письмо уже недавно отправлялось. Подождите пару минут и попробуйте снова.",
      status: 429,
      code: "EMAIL_RATE_LIMIT",
    };
  }

  return {
    message: "Не удалось отправить письмо подтверждения: " + (error?.message || "Неизвестная ошибка"),
    status: 400,
    code: "RESEND_FAILED",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as ResendBody | null;

    if (!body) return fail("Bad request", 400, "BAD_REQUEST", noStoreInit());

    const email = String(body.email ?? "").trim().toLowerCase();
    const captchaToken = String(body.captchaToken ?? "");

    // ✅ Turnstile проверка (как в reset-password)
    const captcha = await verifyTurnstileToken({
      token: captchaToken,
      expectedAction: "resend_confirmation",
      remoteIp: getRemoteIp(req) ?? undefined,
    });

    if (!captcha.ok) {
      return fail("Капча не пройдена", 400, captcha.code, noStoreInit());
    }

    if (!email || !isValidEmail(email)) {
      return fail("Неверный формат email", 400, "VALIDATION", noStoreInit());
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
      return fail("Supabase env missing", 500, "ENV_MISSING", noStoreInit());
    }

    const supabaseAnon = createClient(url, anon, {
      global: {
        fetch: directFetch,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const appUrl = getAppUrl(req);
    // Всегда передаём emailRedirectTo: Supabase сам сверит его со списком
    // разрешённых Redirect URLs. Если URL не разрешён — fallback на Site URL.
    const emailRedirectTo = appUrl ? `${appUrl.replace(/\/$/, "")}/email-confirmed` : undefined;

    const { error } = await supabaseAnon.auth.resend({
      type: "signup",
      email,
      ...(emailRedirectTo
        ? {
            options: {
              emailRedirectTo,
            },
          }
        : {}),
    });

    if (error) {
      const mapped = mapResendError(error);
      return fail(mapped.message, mapped.status, mapped.code, noStoreInit());
    }

    return ok(
      {
        message: "📧 Письмо с подтверждением отправлено повторно. Проверьте почту.",
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