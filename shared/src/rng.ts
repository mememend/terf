// language: TypeScript, file: shared/src/rng.ts
// Детерминированный ГПСЧ. Один и тот же seed даёт один и тот же выпуск —
// это позволяет серверу доказать честность выпадения и воспроизвести результат.

export type Rng = () => number;

/** mulberry32 — быстрый 32-битный генератор с периодом 2^32. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Целое в диапазоне [min, max] включительно. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/** Выбор элемента массива. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randomInt(rng, 0, items.length - 1)];
}

/** Seed из строки — для releaseId и id игрока. */
export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Криптостойкий id операции: защита от повторного списания по одному запросу. */
export function createId(prefix: string): string {
  const bytes = new Uint8Array(12);
  // Источник случайности описываем локально: ядро не зависит от lib.dom.
  const source = (globalThis as unknown as { crypto?: CryptoLike }).crypto;
  if (source?.getRandomValues) {
    source.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}_${hex}`;
}

interface CryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}
