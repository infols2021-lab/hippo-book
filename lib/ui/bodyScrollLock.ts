let lockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedBodyOverscroll = "";
let savedHtmlOverflow = "";

function getScrollbarWidth() {
  if (typeof window === "undefined") return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

/** Блокирует скролл страницы под модалкой. Поддерживает вложенные модалки через счётчик. */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    const sbw = getScrollbarWidth();
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    savedBodyOverscroll = document.body.style.overscrollBehavior;
    savedHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
    document.documentElement.style.overflow = "hidden";
  }

  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount !== 0) return;

    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
    document.body.style.overscrollBehavior = savedBodyOverscroll;
    document.documentElement.style.overflow = savedHtmlOverflow;
  };
}
