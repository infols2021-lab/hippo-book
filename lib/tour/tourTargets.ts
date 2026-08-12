/** Первый видимый элемент из списка селекторов (desktop + mobile дубли). */
export function isTourElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  return true;
}

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.left < window.innerWidth && rect.right > 0 && rect.top < window.innerHeight && rect.bottom > 0;
}

export function visibleTourTarget(...selectors: string[]): () => HTMLElement | null {
  return () => {
    for (const selector of selectors) {
      const nodes = document.querySelectorAll<HTMLElement>(selector);
      for (const node of nodes) {
        if (isTourElementVisible(node) && isInViewport(node)) {
          return node;
        }
      }
      for (const node of nodes) {
        if (isTourElementVisible(node)) {
          return node;
        }
      }
    }
    return null;
  };
}

/** Карточка направления на портале (snap-карусель на мобилке). */
export function visiblePortalCard(): HTMLElement | null {
  const cards = document.querySelectorAll<HTMLElement>('[data-tour="direction-card"]');
  for (const card of cards) {
    if (isTourElementVisible(card) && isInViewport(card)) {
      return card;
    }
  }
  for (const card of cards) {
    if (isTourElementVisible(card)) {
      return card;
    }
  }
  return null;
}
