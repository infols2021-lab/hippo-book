/* app/api/profile/update/route.ts */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { revalidateUserData } from "@/lib/data/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROFILE_SELECT = `
  id,
  email,
  full_name,
  contact_phone,
  region,
  is_admin,
  completed_assignments_count,
  ga_completed_assignments_count
`;

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeName(value: unknown) {
  return normalizeString(value).replace(/\s+/g, " ");
}

function normalizePhone(value: unknown) {
  return normalizeString(value).replace(/\s+/g, " ");
}

function normalizeRegion(value: unknown) {
  return normalizeString(value).replace(/\s+/g, " ");
}

function hasOwn(obj: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

async function safeJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth as any;

  const body = await safeJson(req);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const input = body as Record<string, unknown>;
  const updatePayload: Record<string, string | null> = {};

  if (hasOwn(input, "full_name")) {
    const fullName = normalizeName(input.full_name);

    if (!fullName) {
      return fail("Введите имя", 400, "VALIDATION", noStoreInit());
    }

    if (fullName.length > 120) {
      return fail("Имя слишком длинное", 400, "VALIDATION", noStoreInit());
    }

    updatePayload.full_name = fullName;
  }

  if (hasOwn(input, "contact_phone")) {
    const phone = normalizePhone(input.contact_phone);

    if (phone.length > 40) {
      return fail("Телефон слишком длинный", 400, "VALIDATION", noStoreInit());
    }

    updatePayload.contact_phone = phone || null;
  }

  if (hasOwn(input, "region")) {
    const region = normalizeRegion(input.region);

    if (region.length > 120) {
      return fail("Регион слишком длинный", 400, "VALIDATION", noStoreInit());
    }

    updatePayload.region = region || null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return fail("No fields to update", 400, "VALIDATION", noStoreInit());
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      return fail(error.message, 500, "DB_ERROR", noStoreInit());
    }

    revalidateUserData(user.id);

    return ok(
      {
        profile: data,
      },
      noStoreInit(),
    );
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR", noStoreInit());
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}