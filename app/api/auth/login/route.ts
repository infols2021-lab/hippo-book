import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = {
  email?: string;
  password?: string;
  isAdmin?: boolean;
  admin?: boolean;
  mode?: "student" | "admin";
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toSafeUser(user: any): SafeUser {
  return {
    id: String(user?.id ?? ""),
    email: user?.email ?? null,
    email_confirmed_at: user?.email_confirmed_at ?? null,
  };
}

function mapLoginError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (msg.includes("invalid login credentials") || code === "invalid_credentials") {
    return {
      message: "❌ Неверный email или пароль. Если вы забыли пароль, воспользуйтесь восстановлением.",
      status: 401,
      code: "INVALID_CREDENTIALS",
    };
  }

  if (msg.includes("email not confirmed") || code === "email_not_confirmed") {
    return {
      message: "❌ Email не подтвержден. Проверьте вашу почту и подтвердите регистрацию.",
      status: 403,
      code: "EMAIL_NOT_CONFIRMED",
    };
  }

  if (msg.includes("rate limit") || code === "rate_limit_exceeded") {
    return {
      message: "⚠️ Слишком много попыток. Попробуйте через несколько минут.",
      status: 429,
      code: "RATE_LIMIT",
    };
  }

  if (msg.includes("user not found")) {
    return {
      message: "❌ Пользователь с таким email не найден. Проверьте email или зарегистрируйтесь.",
      status: 404,
      code: "USER_NOT_FOUND",
    };
  }

  return {
    message: "❌ Ошибка входа: " + (error?.message || "Неизвестная ошибка"),
    status: 400,
    code: "LOGIN_FAILED",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as LoginBody | null;

    if (!body) return fail("Bad request", 400, "BAD_REQUEST", noStoreInit());

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const wantsAdmin = Boolean(body.isAdmin || body.admin || body.mode === "admin");

    if (!email || !password) {
      return fail("Введите email и пароль", 400, "VALIDATION", noStoreInit());
    }

    if (!isValidEmail(email)) {
      return fail("Неверный формат email", 400, "VALIDATION", noStoreInit());
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const mapped = mapLoginError(error);
      return fail(mapped.message, mapped.status, mapped.code, noStoreInit());
    }

    const user = data.user;

    if (!user?.id) {
      return fail("Не удалось получить пользователя после входа", 500, "NO_USER", noStoreInit());
    }

    if (!user.email_confirmed_at) {
      await supabase.auth.signOut().catch(() => null);

      return fail(
        "❌ Email не подтвержден. Проверьте вашу почту для завершения регистрации.",
        403,
        "EMAIL_NOT_CONFIRMED",
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
      await supabase.auth.signOut().catch(() => null);

      return fail(
        "❌ Ошибка загрузки профиля. Обновите страницу и попробуйте снова.",
        500,
        "PROFILE_FETCH_FAILED",
        noStoreInit(),
      );
    }

    if (wantsAdmin && !profile?.is_admin) {
      await supabase.auth.signOut().catch(() => null);

      return fail("❌ У вас нет прав администратора", 403, "ADMIN_REQUIRED", noStoreInit());
    }

    return ok(
      {
        user: toSafeUser(user),
        profile: profile ?? null,
        redirectTo: wantsAdmin ? "/admin" : "/portal",
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