type VerifyArgs = {
  token: string;
  expectedAction?: string;
  remoteIp?: string | null;
};

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
};

export async function verifyTurnstileToken(args: VerifyArgs): Promise<
  | { ok: true; action?: string }
  | { ok: false; code: string; details?: string }
> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, code: "TURNSTILE_SECRET_MISSING" };

  const token = (args.token || "").trim();
  if (!token) return { ok: false, code: "TURNSTILE_TOKEN_MISSING" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (args.remoteIp) form.set("remoteip", args.remoteIp);

  let json: TurnstileResponse | null = null;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    json = (await res.json().catch(() => null)) as TurnstileResponse | null;
  } catch (e: any) {
    return { ok: false, code: "TURNSTILE_VERIFY_NETWORK", details: e?.message || String(e) };
  }

  if (!json?.success) {
    const codes = (json?.["error-codes"] || []).join(",");
    return { ok: false, code: "TURNSTILE_FAILED", details: codes || "unknown" };
  }

  // action check — мягко (если action не пришёл, не валим)
  if (args.expectedAction && json.action && json.action !== args.expectedAction) {
    return { ok: false, code: "TURNSTILE_ACTION_MISMATCH", details: `${json.action} != ${args.expectedAction}` };
  }

  return { ok: true, action: json.action };
}
