const STORAGE_PROXY_PREFIX = "/api/storage/public";

type PrimitiveQueryValue = string | number | boolean | null | undefined;

export type StoragePublicUrlOptions = {
  searchParams?: Record<string, PrimitiveQueryValue>;
  cacheBust?: boolean | string | number;
};

export type StoragePublicUrlInput = {
  bucket: string;
  path: string | string[];
} & StoragePublicUrlOptions;

function cleanPart(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function normalizeStoragePath(path: string | string[]) {
  if (Array.isArray(path)) {
    return path.map((part) => cleanPart(String(part))).filter(Boolean).join("/");
  }

  return String(path || "")
    .split("/")
    .map((part) => cleanPart(part))
    .filter(Boolean)
    .join("/");
}

function appendSearchParams(url: string, options?: StoragePublicUrlOptions) {
  const params = new URLSearchParams();

  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value === null || value === undefined || value === "") continue;
      params.set(key, String(value));
    }
  }

  if (options?.cacheBust) {
    params.set("v", options.cacheBust === true ? String(Date.now()) : String(options.cacheBust));
  }

  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

export function getStoragePublicUrl(bucket: string, path: string | string[], options?: StoragePublicUrlOptions) {
  const cleanBucket = cleanPart(bucket);
  const cleanPath = normalizeStoragePath(path);

  if (!cleanBucket || !cleanPath) return "";

  const url = `${STORAGE_PROXY_PREFIX}/${encodeURIComponent(cleanBucket)}/${cleanPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;

  return appendSearchParams(url, options);
}

export function storagePublicUrl(input: StoragePublicUrlInput) {
  return getStoragePublicUrl(input.bucket, input.path, {
    searchParams: input.searchParams,
    cacheBust: input.cacheBust,
  });
}

export function isSupabasePublicStorageUrl(value: string) {
  return /\/storage\/v1\/object\/public\//.test(value);
}

export function rewriteSupabasePublicStorageUrl(value: string | null | undefined, options?: StoragePublicUrlOptions) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith(STORAGE_PROXY_PREFIX)) {
    return appendSearchParams(raw, options);
  }

  if (!isSupabasePublicStorageUrl(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw);
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);

    if (index < 0) return raw;

    const rest = url.pathname.slice(index + marker.length);
    const [bucket, ...pathParts] = rest.split("/").filter(Boolean);

    if (!bucket || !pathParts.length) return raw;

    const mergedSearchParams: Record<string, PrimitiveQueryValue> = {};

    url.searchParams.forEach((paramValue, paramKey) => {
      mergedSearchParams[paramKey] = paramValue;
    });

    if (options?.searchParams) {
      Object.assign(mergedSearchParams, options.searchParams);
    }

    return getStoragePublicUrl(decodeURIComponent(bucket), pathParts.map(decodeURIComponent), {
      searchParams: mergedSearchParams,
      cacheBust: options?.cacheBust,
    });
  } catch {
    return raw;
  }
}

export function toStoragePublicUrl(value: string | null | undefined, options?: StoragePublicUrlOptions) {
  return rewriteSupabasePublicStorageUrl(value, options);
}