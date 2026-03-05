// app/api/profile-streak-leaderboard/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUser } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";

type RawRow = {
  place?: unknown;
  current?: unknown;
  longest?: unknown;
  isMe?: unknown;
};

type Row = {
  place: number;
  current: number;
  longest: number;
  isMe: boolean;
};

function asInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}
function asBool(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
  }
  return false;
}

function normalizeRows(input: unknown): Row[] {
  if (!Array.isArray(input)) return [];
  const out: Row[] = [];
  const seen = new Set<number>();

  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const r = it as RawRow;

    const place = asInt(r.place, 0);
    if (place <= 0) continue;
    if (seen.has(place)) continue;

    out.push({
      place,
      current: asInt(r.current, 0),
      longest: asInt(r.longest, 0),
      isMe: asBool(r.isMe),
    });
    seen.add(place);
  }

  out.sort((a, b) => a.place - b.place);
  return out;
}

function normalizeNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const { data, error } = await supabase.rpc("get_streak_leaderboard", {
      _top: 20,
      _above: 20,
    });

    if (error) return fail(error.message, 500, "LEADERBOARD_RPC_FAILED");

    const payload = (data && typeof data === "object") ? (data as Record<string, any>) : null;
    if (!payload) return fail("Bad leaderboard payload", 500, "LEADERBOARD_BAD_PAYLOAD");

    const top = normalizeRows(payload.top);
    const around = normalizeRows(payload.around);

    const res = ok({
      top,
      around,
      myPlace: normalizeNumberOrNull(payload.myPlace),
      myCurrent: normalizeNumberOrNull(payload.myCurrent),
      myLongest: normalizeNumberOrNull(payload.myLongest),
      serverTs: new Date().toISOString(),
    });

    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}