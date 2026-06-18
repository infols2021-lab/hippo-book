import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/portal",
  "/profile",
  "/assignment",
  "/textbook",
  "/materials",
  "/crossword",
  "/gatehouse",
  "/requests",
  "/admin",
];

export async function middleware(request: NextRequest) {
  // ❗️ ИСПРАВЛЕНИЕ 1: Передаем ТОЛЬКО заголовки. 
  // Если передать весь request, Next.js намертво заблокирует тело POST-запросов!
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * ❗️ ИСПРАВЛЕНИЕ 2: Исключили "api", чтобы мидлвар вообще не лез в API-запросы.
     * Матчим всё кроме:
     * - _next/static и _next/image
     * - favicon.ico
     * - api роуты
     * - публичные страницы входа/сброса пароля
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api|info|login|register|reset|update-password|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};