import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const ALLOWED_DOMAINS = [
  "gmail.com",
  "yandex.ru",
  "mail.ru",
  "ya.ru",
  "yandex.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "rambler.ru",
  "bk.ru",
  "list.ru",
  "inbox.ru",
  "yandex.ua",
  "mail.ua",
  "ukr.net",
  "i.ua",
  "meta.ua",
  "email.ua",
];

const BLOCKED_DOMAINS = [
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "temp-mail.org",
  "trashmail.com",
  "getnada.com",
  "tmpmail.org",
  "maildrop.cc",
  "disposablemail.com",
  "fake-mail.com",
  "tempinbox.com",
  "jetable.org",
  "mailnesia.com",
  "sharklasers.com",
  "guerrillamail.biz",
  "grr.la",
  "guerrillamail.info",
  "spam4.me",
  "tmpmail.net",
];

function isValidEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateDomain(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return { ok: false as const, message: "Неверный формат email" };
  if (BLOCKED_DOMAINS.includes(domain)) return { ok: false as const, message: "Временные email адреса запрещены" };
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return {
      ok: false as const,
      message: "Разрешены только email от популярных сервисов (Gmail, Yandex, Mail.ru, Outlook и др.)",
    };
  }
  return { ok: true as const };
}

function getRemoteIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  const xr = req.headers.get("x-real-ip");
  return xr || undefined;
}

function getPublicOrigin(req: Request): string | undefined {
  const proto = req.headers.get("x-forwarded-proto") || undefined;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || undefined;
  if (host) return `${proto || "https"}://${host}`;
  const origin = req.headers.get("origin") || undefined;
  return origin;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          fullName?: string;
          phone?: string;
          region?: string;
          email?: string;
          password?: string;
          captchaToken?: string;
        }
      | null;

    if (!body) return fail("Bad request", 400, "BAD_REQUEST");

    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const region = String(body.region ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const captchaToken = String(body.captchaToken ?? "");

    // ✅ FIX: всегда строка (иначе TS ругается на string | undefined)
    const remoteIp = getRemoteIp(req) ?? "";

    // 1) captcha
    const captcha = await verifyTurnstileToken({
      token: captchaToken,
      expectedAction: "register",
      remoteIp, // <-- теперь всегда string
    });

    if (!captcha.ok) {
      return fail("Капча не пройдена. Перезагрузите и попробуйте снова.", 400, captcha.code);
    }

    // 2) validate
    if (!fullName || fullName.length < 3) return fail("Введите ФИО", 400, "VALIDATION");
    if (!phone) return fail("Введите телефон", 400, "VALIDATION");
    if (!region) return fail("Выберите область", 400, "VALIDATION");
    if (!email || !isValidEmail(email)) return fail("Неверный формат email", 400, "VALIDATION");

    const d = validateDomain(email);
    if (!d.ok) return fail(d.message, 400, "VALIDATION");

    if (!password || password.length < 6) return fail("Пароль должен быть не менее 6 символов", 400, "VALIDATION");

    // 3) pre-check by profiles.email (service role)
    try {
      const admin = getSupabaseAdminClient();
      const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existing?.id) {
        return fail(
          "Аккаунт с таким email уже существует. Нажмите «Войти» или «Забыли пароль?»",
          400,
          "USER_EXISTS",
        );
      }
    } catch {
      // если admin недоступен — не валим, просто идём дальше
    }

    // 4) signUp via anon
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return fail("Supabase env missing", 500, "ENV_MISSING");

    const supabaseAnon = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const origin = getPublicOrigin(req);
    const redirectTo = origin ? `${origin}/login?message=confirmed` : undefined;

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, contact_phone: phone, region },
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
      },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const code = (error as any).code as string | undefined;

      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user already exists") ||
        code === "user_already_exists"
      ) {
        return fail(
          "Аккаунт с таким email уже существует. Нажмите «Войти» или «Забыли пароль?»",
          400,
          "USER_EXISTS",
        );
      }

      if (msg.includes("rate limit") || code === "rate_limit_exceeded") {
        return fail("Слишком много попыток. Попробуйте позже.", 429, "RATE_LIMIT");
      }

      return fail("Ошибка регистрации: " + error.message, 400, "SIGNUP_FAILED");
    }

    if (!data.user?.id) return fail("Не удалось создать пользователя", 500, "NO_USER");

    // 5) profiles upsert — без email (чтобы не ловить unique конфликт)
    try {
      const admin = getSupabaseAdminClient();
      const { error: pErr } = await admin
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            full_name: fullName,
            contact_phone: phone,
            region,
          } as any,
          { onConflict: "id" },
        );

      if (pErr) console.error("[register] profile upsert error", pErr);
    } catch (e) {
      console.error("[register] profile upsert exception", e);
    }

    return ok({
      message:
        "✅ Регистрация принята!\n\n📧 Мы отправили письмо на вашу почту. Откройте письмо и подтвердите email.\nБез подтверждения вход невозможен.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
