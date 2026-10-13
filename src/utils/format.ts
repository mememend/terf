// language: TypeScript, file: frontend/src/utils/format.ts
// Форматирование чисел, времени и денег для интерфейса.

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function formatShortDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total >= 3600) {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours} ч ${minutes} мин`;
  }
  if (total >= 60) return `${Math.floor(total / 60)} мин`;
  return `${total} с`;
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = [date.getHours(), date.getMinutes()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return `${formatDay(iso)}, ${time}`;
}

/** Индексы цифровых символов в строке отображения: позиция символа → индекс цифры. */
export function digitPositions(display: string): Map<number, number> {
  const map = new Map<number, number>();
  let digitIndex = 0;
  for (let i = 0; i < display.length; i += 1) {
    if (/\d/.test(display[i])) {
      map.set(i, digitIndex);
      digitIndex += 1;
    }
  }
  return map;
}
