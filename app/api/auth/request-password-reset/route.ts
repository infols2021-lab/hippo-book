import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api/response";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

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
  // ✅ главный источник — env (стабильно работает локально/на проде)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  // fallback — из заголовков
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

    // 1) captcha
    const captcha = await verifyTurnstileToken({
      token: captchaToken,
      expectedAction: "reset_request",
      remoteIp: getRemoteIp(req),
    });
    if (!captcha.ok) return fail("Captcha failed", 400, captcha.code);

    // 2) validate email
    if (!email || !isValidEmail(email)) return fail("Неверный формат email", 400, "VALIDATION");

    // 3) send email (не палим существование юзера)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return fail("Supabase env missing", 500, "ENV_MISSING");

    const supabaseAnon = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const appUrl = getAppUrl(req);
    const redirectTo = appUrl ? `${appUrl}/update-password` : undefined;

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    // Даже если ошибка — не раскрываем существование email
    if (error) {
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
