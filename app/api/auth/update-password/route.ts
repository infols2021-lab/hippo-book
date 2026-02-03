import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getRemoteIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const xr = req.headers.get("x-real-ip");
  return xr || null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { password?: string; captchaToken?: string }
      | null;

    if (!body) return fail("Bad request", 400, "BAD_REQUEST");

    const password = String(body.password ?? "");
    const captchaToken = String(body.captchaToken ?? "");

    // captcha
    const captcha = await verifyTurnstileToken({
      token: captchaToken,
      expectedAction: "update_password",
      remoteIp: getRemoteIp(req),
    });
    if (!captcha.ok) return fail("Captcha failed", 400, captcha.code);

    if (!password || password.length < 6) {
      return fail("Пароль должен быть не менее 6 символов", 400, "VALIDATION");
    }

    const supabase = await createSupabaseServerClient();

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) {
      return fail("Сессия восстановления не найдена или устарела. Запросите восстановление заново.", 401, "NO_SESSION");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail("Не удалось обновить пароль: " + error.message, 400, "UPDATE_FAILED");

    return ok({ message: "✅ Пароль успешно изменён! Теперь войдите в систему." });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
