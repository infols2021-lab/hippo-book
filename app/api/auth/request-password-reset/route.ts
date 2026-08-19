import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api/response";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { isAllowedRedirectUrl } from "@/lib/api/validate";

function isValidEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function getRemoteIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const xr = req.headers.get("x-real-ip");
  return xr || null;
}

function getAppUrl(req: Request): string | null {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { email?: string; captchaToken?: string }
      | null;

    if (!body) return fail("Bad request", 400, "BAD_REQUEST");

    const email = String(body.email ?? "").trim().toLowerCase();
    const captchaToken = String(body.captchaToken ?? "");

    const captcha = await verifyTurnstileToken({
      token: captchaToken,
      expectedAction: "reset_request",
      remoteIp: getRemoteIp(req) ?? undefined,
    });

    if (!captcha.ok) {
      return fail("Капча не пройдена", 400, captcha.code);
    }

    if (!email || !isValidEmail(email)) {
      return fail("Неверный формат email", 400, "VALIDATION");
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return fail("Supabase env missing", 500, "ENV_MISSING");

    // Формируем корректный URL для редиректа на страницу ввода нового пароля
    let redirectTo: string | undefined;
    const appUrl = getAppUrl(req);
    
    if (appUrl) {
      const fullRedirect = `${appUrl}/update-password`;
      if (isAllowedRedirectUrl(fullRedirect)) {
        redirectTo = fullRedirect;
      } else {
        redirectTo = `${appUrl}/update-password`; // Fallback на абсолютный URL
      }
    }

    const supabaseAnon = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    // Не раскрываем существование email в целях безопасности
    if (error) {
      console.error("Auth reset password error:", error.message);
      return ok({
        message:
          "✅ Если такой email существует, мы отправили письмо со ссылкой для смены пароля.\nПроверьте папку Входящие/Спам.",
      });
    }

    return ok({
      message:
        "✅ Если такой email существует, мы отправили письмо со ссылкой для смены пароля.\nПроверьте папку Входящие/Спам.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}