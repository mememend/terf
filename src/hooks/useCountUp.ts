// language: TypeScript, file: frontend/src/hooks/useCountUp.ts
// Плавный пересчёт числа: баланс не прыгает, а доезжает до нового значения.
// Для крупных сумм шаг крупнее — иначе пересчёт миллиона занял бы вечность.

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 880;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function useCountUp(value: number, duration = DURATION_MS): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    // Уважаем системную настройку: без анимации значение меняется мгновенно.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      fromRef.current = value;
      setShown(value);
      return;
    }

    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const next = Math.round(from + (value - from) * easeOutCubic(progress));
      setShown(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return shown;
}
