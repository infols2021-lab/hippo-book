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

function collectFromQuestion(urls: Set<string>, question: QuestionAny) {
  collectFromMedia(urls, question.media);
  if ((question as { image?: string }).image) {
    pushUrl(urls, (question as { image?: string }).image);
  }

  const options = (question as { options?: unknown[] }).options;
  if (Array.isArray(options)) {
    for (const opt of options) {
      if (opt && typeof opt === "object" && "media" in opt) {
        collectFromMedia(urls, (opt as { media?: MediaAttachment[] }).media);
      }
    }
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

/**
 * «Мгновенные картинки»: собирает все URL изображений из массива вопросов и
 * ждёт их декодирования. Поля поиска:
 * - `image` и массивы `media` в корне вопроса;
 * - внутри каждого `options` (вариант ответа);
 * - внутри каждой пары `pairs` (левая и правая сторона).
 * Для каждого URL создаёт `new Image()` и возвращает промис через `img.decode()`.
 */
export async function preloadAssignmentImages(questions: any[]): Promise<void> {
  const urls = new Set<string>();

  for (const question of Array.isArray(questions) ? questions : []) {
    if (!question || typeof question !== "object") continue;

    // Корень вопроса
    if (typeof question.image === "string") pushUrl(urls, question.image);
    collectFromMedia(urls, question.media);

    // options — image и media у каждого варианта
    if (Array.isArray(question.options)) {
      for (const opt of question.options) {
        if (!opt || typeof opt !== "object") continue;
        if (typeof opt.image === "string") pushUrl(urls, opt.image);
        collectFromMedia(urls, opt.media);
      }
    }

    // pairs — image и media слева и справа
    if (Array.isArray(question.pairs)) {
      for (const pair of question.pairs) {
        if (!pair || typeof pair !== "object") continue;
        if (typeof pair.image === "string") pushUrl(urls, pair.image);
        collectFromMedia(urls, pair.media);

        const left = pair.left;
        if (left && typeof left === "object") {
          if (typeof left.image === "string") pushUrl(urls, left.image);
          collectFromMedia(urls, left.media);
        }

        const right = pair.right;
        if (right && typeof right === "object") {
          if (typeof right.image === "string") pushUrl(urls, right.image);
          collectFromMedia(urls, right.media);
        }
      }
    }
  }

  if (typeof window === "undefined" || typeof Image === "undefined") return;

  const imageUrls = Array.from(urls).filter(isImageUrl);

  await Promise.all(
    imageUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
          if (typeof img.decode === "function") {
            img.decode().then(() => resolve()).catch(() => resolve());
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );
}
