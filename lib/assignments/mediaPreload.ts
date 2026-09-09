import type { InfoBlock } from "@/app/(admin)/admin/assignments/builder/types";
import type { MediaAttachment, QuestionAny } from "@/lib/assignments/types";
import { getImageUrl } from "@/lib/assignments/image";

export type AssignmentMediaPayload = {
  questions?: QuestionAny[];
  blocks?: InfoBlock[];
};

const PRELOADED = new Set<string>();

function pushUrl(urls: Set<string>, raw: unknown) {
  const resolved = getImageUrl(raw);
  if (resolved) urls.add(resolved);
}

function collectFromMedia(urls: Set<string>, media?: MediaAttachment[]) {
  if (!Array.isArray(media)) return;
  for (const item of media) {
    if (item?.url) pushUrl(urls, item.url);
  }
}

/** Прямое поле `image` узла (вопрос, вариант, пара, карточка ответа и т.д.). */
function collectNodeImage(urls: Set<string>, node: unknown) {
  if (node && typeof node === "object") {
    const image = (node as { image?: unknown }).image;
    if (typeof image === "string") pushUrl(urls, image);
  }
}

/** Медиа узла: массив `media` и одиночный `centerImage` (matching). */
function collectNodeMedia(urls: Set<string>, node: unknown) {
  if (!node || typeof node !== "object") return;
  collectFromMedia(urls, (node as { media?: MediaAttachment[] }).media);
  const center = (node as { centerImage?: MediaAttachment }).centerImage;
  if (center && typeof center === "object" && typeof center.url === "string") {
    pushUrl(urls, center.url);
  }
}

/**
 * Вложенные узлы вопроса, которые тоже могут нести image/media:
 * - `options` — варианты ответа (test/reading);
 * - `pairs` и их стороны `left`/`right` — соединение пар (matching);
 * - `answers` — карточки ответов (imagemap);
 * - `points` — точки на карте (imagemap);
 * - `subQuestions` — подвопросы (complex/reading), обходятся рекурсивно.
 */
function questionChildNodes(node: unknown): unknown[] {
  if (!node || typeof node !== "object") return [];
  const source = node as Record<string, unknown>;
  const children: unknown[] = [];

  if (Array.isArray(source.options)) children.push(...source.options);

  if (Array.isArray(source.pairs)) {
    for (const pair of source.pairs) {
      if (!pair || typeof pair !== "object") continue;
      children.push(pair);
      const p = pair as { left?: unknown; right?: unknown };
      if (p.left && typeof p.left === "object") children.push(p.left);
      if (p.right && typeof p.right === "object") children.push(p.right);
    }
  }

  if (Array.isArray(source.answers)) children.push(...source.answers);
  if (Array.isArray(source.points)) children.push(...source.points);
  if (Array.isArray(source.subQuestions)) children.push(...source.subQuestions);

  return children;
}

/**
 * Рекурсивно собирает все медиа-URL (картинки/аудио/PDF) из вопроса любого типа:
 * корень вопроса, варианты `options`, пары `pairs`, карточки `answers`, точки
 * `points`, центральную картинку `centerImage` и подвопросы `subQuestions`.
 */
function collectFromQuestion(urls: Set<string>, question: QuestionAny) {
  const visited = new Set<unknown>();
  const stack: unknown[] = [question];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);

    collectNodeImage(urls, node);
    collectNodeMedia(urls, node);

    for (const child of questionChildNodes(node)) stack.push(child);
  }
}

function collectFromBlock(urls: Set<string>, block: InfoBlock) {
  const data = block.data as Record<string, unknown> | undefined;
  if (!data) return;

  if (typeof data.url === "string") pushUrl(urls, data.url);
  if (typeof data.image === "string") pushUrl(urls, data.image);

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        if (typeof row.url === "string") pushUrl(urls, row.url);
        if (typeof row.image === "string") pushUrl(urls, row.image);
      }
    }
  }

  if (Array.isArray(data.files)) {
    for (const file of data.files) {
      if (file && typeof file === "object" && typeof (file as { url?: string }).url === "string") {
        pushUrl(urls, (file as { url: string }).url);
      }
    }
  }

  if (Array.isArray(data.cards)) {
    for (const card of data.cards) {
      if (card && typeof card === "object" && typeof (card as { image?: string }).image === "string") {
        pushUrl(urls, (card as { image: string }).image);
      }
    }
  }
}

export function collectAssignmentMediaUrls(payload: AssignmentMediaPayload): string[] {
  const urls = new Set<string>();

  for (const question of payload.questions ?? []) {
    collectFromQuestion(urls, question);
  }

  for (const block of payload.blocks ?? []) {
    collectFromBlock(urls, block);
  }

  return Array.from(urls);
}

function isImageUrl(url: string) {
  return (
    url.startsWith("data:image") ||
    /\.(avif|gif|jpe?g|png|svg|webp)(\?|$)/i.test(url) ||
    url.includes("/question-images/") ||
    url.includes("/help-images/") ||
    url.includes("/covers/")
  );
}

function isAudioUrl(url: string) {
  return /\.(aac|m4a|mp3|ogg|wav|webm)(\?|$)/i.test(url) || url.includes("/media/");
}

function preloadImage(url: string, priority: "high" | "low") {
  if (typeof document !== "undefined") {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-preload-media="${url}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.dataset.preloadMedia = url;
      if (priority === "high") {
        link.setAttribute("fetchpriority", "high");
      }
      document.head.appendChild(link);
    }
  }

  const img = new window.Image();
  if (priority === "high" && "fetchPriority" in img) {
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";
  }
  img.decoding = "async";
  img.src = url;
}

function preloadAudio(url: string) {
  if (typeof document !== "undefined") {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-preload-media="${url}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "fetch";
      link.href = url;
      link.crossOrigin = "anonymous";
      link.dataset.preloadMedia = url;
      document.head.appendChild(link);
    }
  }

  void fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" }).catch(() => {});
}

export function warmAssignmentMediaCache(
  payload: AssignmentMediaPayload,
  options?: { priorityUrls?: string[] }
) {
  if (typeof window === "undefined") return;

  const allUrls = collectAssignmentMediaUrls(payload);
  const priority = new Set(options?.priorityUrls?.map((url) => getImageUrl(url)).filter(Boolean));

  for (const url of allUrls) {
    if (PRELOADED.has(url)) continue;
    PRELOADED.add(url);

    const high = priority.has(url);

    if (isImageUrl(url)) {
      preloadImage(url, high ? "high" : "low");
      continue;
    }

    if (isAudioUrl(url)) {
      preloadAudio(url);
    }
  }
}

export function getQuestionMediaUrls(question?: QuestionAny | null): string[] {
  if (!question) return [];
  const urls = new Set<string>();
  collectFromQuestion(urls, question);
  return Array.from(urls);
}

export function ensureMediaPreconnect() {
  if (typeof document === "undefined") return;

  const origins = [
    "https://storage.yandexcloud.net",
    String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, ""),
  ].filter(Boolean);

  for (const origin of origins) {
    if (document.querySelector(`link[data-preconnect-origin="${origin}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    link.dataset.preconnectOrigin = origin;
    document.head.appendChild(link);
  }
}

const IMAGE_FILE_RE = /\.(avif|gif|jpe?g|png|svg|webp)(\?|$)/i;

/** Является ли элемент media-массива картинкой (по типу или расширению URL). */
function isImageMediaItem(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  const type = String(item.type ?? "").toLowerCase();
  if (type === "image") return true;
  if (type === "audio" || type === "pdf") return false;
  return typeof item.url === "string" && IMAGE_FILE_RE.test(item.url);
}

/** Собирает URL картинок из объекта и всех его вложенных подузлов вопроса. */
function collectImageUrls(urls: Set<string>, value: any) {
  const visited = new Set<any>();
  const stack: any[] = [value];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);

    if (typeof node.image === "string") pushUrl(urls, node.image);

    if (Array.isArray(node.media)) {
      for (const item of node.media) {
        if (isImageMediaItem(item) && typeof item.url === "string") pushUrl(urls, item.url);
      }
    }

    const center = node.centerImage;
    if (center && typeof center === "object") {
      if (isImageMediaItem(center) && typeof center.url === "string") pushUrl(urls, center.url);
    }

    for (const child of questionChildNodes(node)) stack.push(child);
  }
}

// ─────────────────────────────────────────────────────────────
// Прогрев изображений с повторами: холодный CDN/прокси может оборвать
// первый запрос, а повторный (тёплый) проходит. Иначе пользователь видит
// «ошибка → повтор» у картинок даже после предзагрузки.
// ─────────────────────────────────────────────────────────────

const IMAGE_PRELOAD_RETRIES = 3; // доп. попытки после первой (всего 4)
const IMAGE_PRELOAD_ATTEMPT_TIMEOUT_MS = 15000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Одна попытка загрузить и декодировать картинку. Возвращает true при успехе. */
function preloadImageOnce(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(ok);
    };

    timer = setTimeout(() => done(false), timeoutMs);

    const img = new Image();
    img.decoding = "async";
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;

    if (typeof img.decode === "function") {
      img.decode().then(() => done(true)).catch(() => done(false));
    }
  });
}

/**
 * «Мгновенные картинки»: собирает все URL изображений из массива вопросов и
 * ждёт их декодирования. Обход дерева вопроса покрывает:
 * - `image` и массивы `media` в корне вопроса;
 * - варианты `options` (карточки выбора);
 * - пары `pairs` (левая и правая сторона соединения) и `centerImage`;
 * - карточки ответов `answers` и точки `points` (интерактивная карта);
 * - подвопросы `subQuestions` (комплексные/чтение), рекурсивно.
 * Для каждого URL создаёт `new Image()` и возвращает промис через `img.decode()`.
 * Через `options.onProgress` отдаёт прогресс (загружено / всего).
 */
export async function preloadAssignmentImages(
  questions: any[],
  options?: { onProgress?: (loaded: number, total: number) => void }
): Promise<void> {
  const onProgress = options?.onProgress;
  const urls = new Set<string>();

  for (const question of Array.isArray(questions) ? questions : []) {
    if (!question || typeof question !== "object") continue;
    collectImageUrls(urls, question);
  }

  if (typeof window === "undefined" || typeof Image === "undefined") return;

  const imageUrls = Array.from(urls);
  const total = imageUrls.length;
  let loaded = 0;

  onProgress?.(0, total);

  await Promise.all(
    imageUrls.map(async (url) => {
      try {
        for (let attempt = 0; attempt <= IMAGE_PRELOAD_RETRIES; attempt++) {
          const ok = await preloadImageOnce(url, IMAGE_PRELOAD_ATTEMPT_TIMEOUT_MS);
          if (ok) break;
          if (attempt < IMAGE_PRELOAD_RETRIES) {
            await sleep(500 * (attempt + 1));
          }
        }
      } finally {
        loaded += 1;
        onProgress?.(loaded, total);
      }
    })
  );
}
