/* lib/supabase/middleware.ts */
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

function mustPublicEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

/**
 * Supabase client для middleware.
 *
 * ВАЖНО:
 * - Не использовать directFetch/undici тут: middleware может работать в Edge runtime.
 * - Response надо передавать снаружи, чтобы Supabase мог обновлять auth cookies.
 */
export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  const url = mustPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // ИСПРАВЛЕНИЕ: При установке новых кук, нужно обновлять как Request (чтобы код ниже видел сессию), 
        // так и Response (чтобы браузер сохранил изменения).
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set({ name, value, ...options });
          res.cookies.set({ name, value, ...options });
        });
      },
    },
  });
}