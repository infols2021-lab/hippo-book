export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "DB_ERROR"
  | "UNKNOWN_ERROR"
  | string;

export type NormalizedError = {
  message: string;
  code: AppErrorCode;
  status: number;
  details?: unknown;
};

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  details?: unknown;

  constructor(message: string, options?: { code?: AppErrorCode; status?: number; details?: unknown }) {
    super(message);

    this.name = "AppError";
    this.code = options?.code ?? "UNKNOWN_ERROR";
    this.status = options?.status ?? 500;
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isAbortError(error: unknown) {
  const anyError = error as any;
  return anyError?.name === "AbortError" || String(anyError?.message || "").toLowerCase().includes("abort");
}

export function isTimeoutError(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return msg.includes("timeout") || msg.includes("timed out") || isAbortError(error);
}

export function isNetworkError(error: unknown) {
  const msg = String((error as any)?.message || error || "").toLowerCase();

  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("socket") ||
    msg.includes("terminated")
  );
}

export function isTransientError(error: unknown) {
  return isTimeoutError(error) || isNetworkError(error);
}

export function normalizeError(error: unknown, fallback?: Partial<NormalizedError>): NormalizedError {
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    };
  }

  const anyError = error as any;

  if (isTimeoutError(error)) {
    return {
      message: anyError?.message || fallback?.message || "Request timeout",
      code: fallback?.code || "TIMEOUT",
      status: fallback?.status || 408,
      details: fallback?.details,
    };
  }

  if (isNetworkError(error)) {
    return {
      message: anyError?.message || fallback?.message || "Network error",
      code: fallback?.code || "NETWORK_ERROR",
      status: fallback?.status || 502,
      details: fallback?.details,
    };
  }

  return {
    message: anyError?.message || String(error || fallback?.message || "Unknown error"),
    code: fallback?.code || anyError?.code || "UNKNOWN_ERROR",
    status: fallback?.status || anyError?.status || 500,
    details: fallback?.details ?? anyError?.details,
  };
}

export function throwAppError(message: string, options?: { code?: AppErrorCode; status?: number; details?: unknown }): never {
  throw new AppError(message, options);
}

export function toErrorPayload(error: unknown, fallback?: Partial<NormalizedError>) {
  const normalized = normalizeError(error, fallback);

  return {
    ok: false,
    error: normalized.message,
    code: normalized.code,
    details: normalized.details,
  };
}