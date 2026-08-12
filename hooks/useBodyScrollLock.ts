import { useEffect, useRef } from "react";

/** Блокирует скролл страницы под модалкой (в т.ч. iOS, scroll chaining). */
export function useBodyScrollLock(active: boolean) {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const body = document.body;
    const html = document.documentElement;
    scrollYRef.current = window.scrollY;

    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

    const prev = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [active]);
}
