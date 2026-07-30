/**
 * lib/security/domains.ts
 *
 * Единый модуль проверки email-адресов и одноразовых (временных) доменов.
 * Безопасно импортируется как в Server API Routes, так и в Client Components.
 */

/**
 * Список заблокированных сервисов одноразовой/временной почты.
 */
export const BLOCKED_DOMAINS: readonly string[] = [
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
] as const;

/**
 * Проверяет синтаксическую корректность email-адреса.
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Извлекает доменную часть из email-адреса.
 */
export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length < 2) return null;
  const domain = parts[parts.length - 1]?.trim();
  return domain || null;
}

/**
 * Проверяет, является ли домен временным/заблокированным.
 */
export function isDisposableDomain(domain: string): boolean {
  if (!domain) return false;
  return BLOCKED_DOMAINS.includes(domain.trim().toLowerCase());
}

/**
 * Полный комплексный валидатор email и его домена.
 */
export function validateEmailDomain(email: string): { ok: boolean; message: string } {
  if (!isValidEmailFormat(email)) {
    return { ok: false, message: "Неверный формат email" };
  }

  const domain = extractEmailDomain(email);
  if (!domain) {
    return { ok: false, message: "Не удалось определить домен почты" };
  }

  if (isDisposableDomain(domain)) {
    return { ok: false, message: "Временные email адреса запрещены" };
  }

  return { ok: true, message: "" };
}