export async function verifyYandexCaptcha(
  token: string,
  remoteIp?: string
): Promise<{ ok: boolean; code?: string }> {
  const secretKey = process.env.YANDEX_CAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    console.warn("YANDEX_CAPTCHA_SECRET_KEY not set – skipping verification");
    return { ok: true };
  }

  if (!token) {
    return { ok: false, code: "MISSING_TOKEN" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("token", token);
    if (remoteIp) formData.append("ip", remoteIp);

    const response = await fetch("https://smartcaptcha.yandexcloud.net/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const data = await response.json();
    
    if (data.status === "ok") {
      return { ok: true };
    } else {
      return { ok: false, code: data.message || "CAPTCHA_FAILED" };
    }
  } catch (error) {
    console.error("Yandex Captcha verification error:", error);
    return { ok: false, code: "VERIFICATION_ERROR" };
  }
}