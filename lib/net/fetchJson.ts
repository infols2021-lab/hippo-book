import { AppError, normalizeError, isTransientError } from "@/lib/net/error";

export type FetchJsonOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  parseAs?: "json" | "text" | "response";
};

export type FetchJsonErrorPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFormLike(value: unknown) {
  return (
    typeof FormData !== "undefined" && value instanceof FormData
  );
}

function isBodyInit(value: unknown): value is BodyInit {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return true;
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) return true;
  if (isFormLike(value)) return true;

  return false;
}

function buildBodyAndHeaders(body: unknown, headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);

  if (body === undefined || body === null) {
    return {
      body: undefined,
      headers: nextHeaders,
    };
  }

  if (isBodyInit(body)) {
    return {
      body,
      headers: nextHeaders,
    };
  }

  if (!nextHeaders.has("content-type")) {
    nextHeaders.set("content-type", "application/json");
  }

  return {
    body: JSON.stringify(body),
    headers: nextHeaders,
  };
}

async function readErrorPayload(response: Response): Promise<FetchJsonErrorPayload | null> {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return (await response.json()) as FetchJsonErrorPayload;
    }

    const text = await response.text();
    return text
      ? {
          error: text,
        }
      : null;
  } catch {
    return null;
  }
}

async function fetchOnce(input: RequestInfo | URL, options: FetchJsonOptions) {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const timer = setTimeout(() => controller.abort(), timeout);

  const { body, headers } = buildBodyAndHeaders(options.body, options.headers);

  try {
    return await fetch(input, {
      ...options,
      headers,
      body,
      signal: options.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = any>(input: RequestInfo | URL, options: FetchJsonOptions = {}): Promise<T> {
  const retries = Math.max(0, Math.trunc(options.retries ?? 0));
  const retryDelayMs = Math.max(0, Math.trunc(options.retryDelayMs ?? 300));

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchOnce(input, options);

      if (!response.ok) {
        const payload = await readErrorPayload(response);

        throw new AppError(
          payload?.error || payload?.message || `HTTP ${response.status}`,
          {
            code: payload?.code || "HTTP_ERROR",
            status: response.status,
            details: payload?.details ?? payload,
          },
        );
      }

      if (options.parseAs === "response") {
        return response as T;
      }

      if (options.parseAs === "text") {
        return (await response.text()) as T;
      }

      if (response.status === 204) {
        return null as T;
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        return (await response.text()) as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt < retries && isTransientError(error)) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      break;
    }
  }

  const normalized = normalizeError(lastError, {
    message: "Fetch failed",
    code: "NETWORK_ERROR",
    status: 502,
  });

  throw new AppError(normalized.message, {
    code: normalized.code,
    status: normalized.status,
    details: normalized.details,
  });
}

export async function postJson<T = any>(url: string, body?: unknown, options?: FetchJsonOptions) {
  return fetchJson<T>(url, {
    method: "POST",
    body,
    ...options,
  });
}

export async function getJson<T = any>(url: string, options?: FetchJsonOptions) {
  return fetchJson<T>(url, {
    method: "GET",
    ...options,
  });
}