"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  open: boolean;
  previous: number;
  current: number;
  longest: number;
  alreadyCounted?: boolean;
  onClose: () => void;
};

function pluralDays(n: number): string {
  const m = Math.abs(n) % 100;
  const d = m % 10;
  if (m >= 11 && m <= 14) return "дней";
  if (d === 1) return "день";
  if (d >= 2 && d <= 4) return "дня";
  return "дней";
}

function useCountUp(from: number, to: number, durationMs = 900): number {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const diff = to - from;
    if (diff === 0) return; // значение уже равно from === to
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(from + eased * diff));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, durationMs]);

  return value;
}

export default function StreakCelebrationModal({
  open,
  previous,
  current,
  longest,
  onClose,
}: Props) {
  const displayValue = useCountUp(previous, current);

  const isNewStart = current <= 1 && previous > 1;
  const headline = isNewStart
    ? previous > 0
      ? "Серия началась заново!"
      : "Начинаем серию!"
    : "Серия обновлена!";
  const subtitle =
    current <= 1
      ? "Первый день подряд. Так держать!"
      : `Вы занимаетесь ${current} ${pluralDays(current)} подряд`;

  // createPortal безопасен: на SSR open === false, значит портал не создаётся.
  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="streak-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      >
        <motion.div
          className="streak-modal-card"
          initial={{ scale: 0.82, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="streak-flame"
            aria-hidden="true"
            animate={{ scale: [1, 1.12, 1], rotate: [0, -3, 3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="streak-flame-emoji">🔥</span>
          </motion.div>

          <h2 className="streak-celebration-title">{headline}</h2>

          <div className="streak-counter">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={displayValue}
                className="streak-counter-digit"
                initial={{ opacity: 0, y: -26 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 26 }}
                transition={{ duration: 0.18 }}
              >
                {displayValue}
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="streak-celebration-subtitle">{subtitle}</p>

            {longest > current && (
              <p className="streak-record-note">Ваш рекорд: {longest} {pluralDays(longest)}</p>
            )}

            <button
              type="button"
              className="streak-go-review-btn"
              onClick={onClose}
              autoFocus
            >
              К ревью задания
            </button>
          </motion.div>
        </motion.div>
    </AnimatePresence>,
    document.body
  );
}
