// language: TypeScript, file: shared/src/patterns.ts
// Анализатор узоров. Считает очки ТОЛЬКО по цифрам абонентской части и возвращает
// диапазоны цифр для подчёркивания на карточке.
// Правило: один рисунок — один бонус. Пересекающиеся узоры гасятся картой EXCLUDES.

import { PATTERN_POINTS, PATTERN_ORDER } from './config';
import type { PatternHit, PatternId } from './types';

export interface AnalyzeContext {
  /** Префикс оператора без кода страны, например «920» */
  operatorPrefix?: string;
  /** Цифры кода страны, например «7» */
  countryDigits?: string;
}

/**
 * Приоритет гашения: если найден ключ, перечисленные узоры не начисляются —
 * они описывают тот же рисунок другими словами.
 */
const EXCLUDES: Partial<Record<PatternId, PatternId[]>> = {
  all_same: [
    'almost_same', 'series', 'pairs', 'alternating', 'palindrome',
    'mirror', 'block_repeat', 'prefix_echo', 'prefix_repeat',
    'ladder_up', 'ladder_down', 'round', 'date',
    'twin_ends', 'aabb', 'keypad_line', 'zero_run',
  ],
  almost_same: [
    'series', 'pairs', 'prefix_echo', 'alternating', 'aabb', 'zero_run',
    'round', 'keypad_line', 'twin_ends',
  ],
  palindrome: ['mirror', 'block_repeat', 'prefix_echo', 'alternating', 'twin_ends', 'keypad_line'],
  alternating: ['block_repeat', 'prefix_repeat', 'mirror', 'aabb'],
  block_repeat: [
    'prefix_repeat', 'prefix_echo', 'mirror', 'aabb', 'zero_run', 'round',
    'keypad_line', 'twin_ends',
  ],
  mirror: ['prefix_echo', 'twin_ends', 'keypad_line'],
  // Лесенка и линия по клавиатуре — один и тот же рисунок «идём подряд»:
  // 6789 это и лесенка, и три цифры линии «789». Считаем один раз, дорогим.
  ladder_up: ['series', 'keypad_line'],
  ladder_down: ['series', 'keypad_line'],
  // Линия по клавиатуре — не серия и не пары, хотя цифры в ней соседние.
  keypad_line: ['series', 'pairs', 'aabb'],
  // Серия одинаковых цифр описывает ту же картинку точнее, чем пары.
  // ВАЖНО: серия обязана проверяться РАНЬШЕ пар, иначе она недостижима —
  // три одинаковые цифры всегда дают две пары, и пары гасили бы серию.
  series: ['pairs', 'aabb'],
  aabb: ['pairs'],
  // Круглый номер описывает хвост из нулей точнее, чем «нули подряд» и «пары»:
  // два нуля в конце — это не отдельная пара, а то же самое окончание.
  round: ['zero_run', 'pairs'],
  prefix_echo: ['twin_ends'],
};

/**
 * Порядок проверки: от дорогих узоров к дешёвым.
 *
 * Здесь важен не только размер: гашение работает только вперёд, поэтому
 * точный узор обязан идти раньше общего. Иначе общий заберёт очки себе,
 * а точный уже не начислится.
 */
const PRIORITY: PatternId[] = [
  'all_same', 'almost_same', 'date', 'palindrome', 'alternating',
  'block_repeat', 'mirror', 'prefix_echo', 'prefix_repeat',
  'ladder_up', 'ladder_down', 'keypad_line', 'twin_ends',
  'series', 'aabb', 'round', 'zero_run', 'pairs', 'country_code',
];

type Span = { start: number; end: number };

/* ─────────────────────────── ПОИСК ПО ЦИФРАМ ─────────────────────────── */

/** Самая длинная лесенка с шагом step (+1 или −1). */
function longestLadder(digits: string, step: 1 | -1): Span & { length: number } {
  let best = { start: 0, end: 0, length: 0 };
  let runStart = 0;
  let runLength = 1;

  for (let i = 1; i <= digits.length; i += 1) {
    const continues =
      i < digits.length && digits.charCodeAt(i) - digits.charCodeAt(i - 1) === step;
    if (continues) {
      runLength += 1;
    } else {
      if (runLength > best.length) best = { start: runStart, end: runStart + runLength, length: runLength };
      runStart = i;
      runLength = 1;
    }
  }
  return best;
}

/** Самая длинная серия одинаковых цифр подряд. */
function longestRun(digits: string): Span & { length: number; digit: string } {
  let best = { start: 0, end: 0, length: 0, digit: '' };
  let runStart = 0;

  for (let i = 1; i <= digits.length; i += 1) {
    const continues = i < digits.length && digits[i] === digits[runStart];
    if (!continues) {
      const length = i - runStart;
      if (length > best.length) {
        best = { start: runStart, end: i, length, digit: digits[runStart] };
      }
      runStart = i;
    }
  }
  return best;
}

/** Самый длинный участок с чередованием периода 2 — 121212. */
function alternatingSpan(digits: string): Span & { length: number } {
  let best = { start: 0, end: 0, length: 0 };
  for (let start = 0; start + 2 <= digits.length; start += 1) {
    let end = start + 2;
    while (end < digits.length && digits[end] === digits[end - 2]) end += 1;
    if (end - start > best.length) best = { start, end, length: end - start };
  }
  return best;
}

/** Сколько раз встречается каждая цифра — для «почти одна цифра» в любой позиции. */
function dominantDigit(digits: string): { digit: string; count: number } {
  const counts = new Map<string, number>();
  for (const char of digits) counts.set(char, (counts.get(char) ?? 0) + 1);
  let best = { digit: digits[0] ?? '0', count: 0 };
  for (const [digit, count] of counts) {
    if (count > best.count) best = { digit, count };
  }
  return best;
}

/** Повторяющийся блок: «123123», «1717». */
function repeatedBlock(digits: string): (Span & { block: string; count: number }) | null {
  for (let size = 2; size <= Math.floor(digits.length / 2); size += 1) {
    for (let start = 0; start + size * 2 <= digits.length; start += 1) {
      const block = digits.slice(start, start + size);
      let count = 1;
      let cursor = start + size;
      while (digits.slice(cursor, cursor + size) === block) {
        count += 1;
        cursor += size;
      }
      if (count >= 2) return { start, end: cursor, block, count };
    }
  }
  return null;
}

/** Правдоподобная дата внутри номера: ДДММ. */
function dateSpan(digits: string): (Span & { text: string }) | null {
  for (let i = 0; i + 4 <= digits.length; i += 1) {
    const day = Number(digits.slice(i, i + 2));
    const month = Number(digits.slice(i + 2, i + 4));
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { start: i, end: i + 4, text: digits.slice(i, i + 4) };
    }
  }
  return null;
}

/** Хвост, зеркальный началу: «123…321». */
function mirrorSpan(digits: string): (Span & { text: string }) | null {
  for (let size = Math.floor(digits.length / 2); size >= 3; size -= 1) {
    const head = digits.slice(0, size);
    const tail = digits.slice(digits.length - size);
    if (head === [...tail].reverse().join('')) {
      return { start: 0, end: digits.length, text: head };
    }
  }
  return null;
}

/**
 * Две повторяющиеся пары подряд — «1122», «3344».
 *
 * Отличается от «пар» тем, что пары разные: 1122 — это не серия одинаковых
 * цифр и не повтор блока, а свой узнаваемый рисунок.
 */
function doublePairSpan(digits: string): Span | null {
  for (let i = 0; i + 4 <= digits.length; i += 1) {
    if (
      digits[i] === digits[i + 1] &&
      digits[i + 2] === digits[i + 3] &&
      digits[i] !== digits[i + 2]
    ) {
      return { start: i, end: i + 4 };
    }
  }
  return null;
}

/** Три и более нуля подряд в любом месте номера. */
function zeroRunSpan(digits: string): (Span & { length: number }) | null {
  let best: (Span & { length: number }) | null = null;
  let start = -1;

  for (let i = 0; i <= digits.length; i += 1) {
    if (i < digits.length && digits[i] === '0') {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0) {
      const length = i - start;
      if (length >= 3 && (!best || length > best.length)) best = { start, end: i, length };
      start = -1;
    }
  }
  return best;
}

/**
 * Прямая по клавиатуре телефона.
 *
 * Палец идёт по одной линии: строки 123/456/789, столбцы 147/258/369 и
 * диагонали 159/357. В обе стороны — 951 читается так же.
 */
const KEYPAD_LINES = ['123', '456', '789', '147', '258', '369', '159', '357'];

function keypadSpan(digits: string): (Span & { text: string }) | null {
  let best: (Span & { text: string }) | null = null;

  for (const line of KEYPAD_LINES) {
    for (const variant of [line, [...line].reverse().join('')]) {
      for (let start = 0; start + 3 <= digits.length; start += 1) {
        // Берём самую длинную часть линии, начинающуюся в этой позиции.
        for (let take = variant.length; take >= 3; take -= 1) {
          if (!digits.startsWith(variant.slice(0, take), start)) continue;
          if (!best || take > best.end - best.start) {
            best = { start, end: start + take, text: digits.slice(start, start + take) };
          }
          break;
        }
      }
    }
  }
  return best;
}

/* ─────────────────────────── ОСНОВНОЙ АНАЛИЗ ─────────────────────────── */

export interface AnalyzeResult {
  hits: PatternHit[];
  score: number;
}

export function analyzeNumber(digits: string, ctx: AnalyzeContext = {}): AnalyzeResult {
  const found = new Map<PatternId, PatternHit>();
  const push = (
    id: PatternId,
    label: string,
    detail: string,
    points: number,
    span: Span | null,
  ) => {
    if (points <= 0) return;
    found.set(id, { id, label, detail, points, span });
  };
  const length = digits.length;

  // Все цифры одинаковые — 7777777.
  const run = longestRun(digits);
  if (length >= 4 && run.length === length) {
    push('all_same', 'Все цифры одинаковые', `Полное повторение «${digits}»`, PATTERN_POINTS.all_same, { start: 0, end: length });
  }

  // Почти все одинаковые — ровно одна цифра выбивается, в любой позиции.
  const dominant = dominantDigit(digits);
  if (length >= 5 && dominant.count === length - 1) {
    push(
      'almost_same',
      'Почти одна цифра',
      `Все цифры — «${dominant.digit}», кроме одной`,
      PATTERN_POINTS.almost_same,
      { start: 0, end: length },
    );
  }

  // Дата внутри номера.
  const date = dateSpan(digits);
  if (date) {
    push('date', 'Дата', `Правдоподобная дата «${date.text}»`, PATTERN_POINTS.date, date);
  }

  // Палиндром целиком.
  if (length >= 5 && digits === [...digits].reverse().join('')) {
    push('palindrome', 'Палиндром', `Читается одинаково в обе стороны «${digits}»`, PATTERN_POINTS.palindrome, { start: 0, end: length });
  }

  // Чередование периода 2 — 121212. Серии одинаковых цифр сюда не попадают.
  const alt = alternatingSpan(digits);
  if (alt.length >= 6) {
    push(
      'alternating',
      'Чередование',
      `Повторяющийся рисунок длиной ${alt.length}`,
      PATTERN_POINTS.alternating,
      alt,
    );
  }

  // Повтор блока.
  const block = repeatedBlock(digits);
  if (block) {
    push(
      'block_repeat',
      'Повтор блока',
      `Блок «${block.block}» повторяется ${block.count} раза`,
      PATTERN_POINTS.block_repeat,
      block,
    );
  }

  // Зеркало.
  const mirror = mirrorSpan(digits);
  if (mirror) {
    push('mirror', 'Зеркало', `Зеркальная комбинация вокруг «${mirror.text}»`, PATTERN_POINTS.mirror, mirror);
  }

  // Эхо префикса — номер начинается и заканчивается одинаково.
  if (length >= 6 && digits.slice(0, 2) === digits.slice(-2)) {
    push('prefix_echo', 'Эхо префикса', `Начало «${digits.slice(0, 2)}» повторяется в конце`, PATTERN_POINTS.prefix_echo, { start: 0, end: length });
  }

  // Повтор в префиксе — две ведущие цифры встречаются ещё раз внутри.
  const head = digits.slice(0, 2);
  if (head.length === 2) {
    const again = digits.indexOf(head, 2);
    if (again > 0) {
      push(
        'prefix_repeat',
        'Повтор в префиксе',
        `Префикс «${head}» повторяется внутри номера`,
        PATTERN_POINTS.prefix_repeat,
        { start: again, end: again + 2 },
      );
    }
  }

  // Лесенка вверх. С шестой цифры каждая следующая стоит дороже: шесть
  // подряд идущих цифр встречаются куда реже пяти.
  const up = longestLadder(digits, 1);
  if (up.length >= 4) {
    const bonus = up.length >= 6 ? (up.length - 5) * PATTERN_POINTS.ladderLong : 0;
    push(
      'ladder_up',
      'Лесенка вверх',
      `Возрастающая последовательность «${digits.slice(up.start, up.end)}»`,
      up.length * PATTERN_POINTS.ladder_up + bonus,
      up,
    );
  }

  // Лесенка вниз — опорный случай референса: «65432» = 5 × 7 = 35 очков.
  const down = longestLadder(digits, -1);
  if (down.length >= 4) {
    const bonus = down.length >= 6 ? (down.length - 5) * PATTERN_POINTS.ladderLong : 0;
    push(
      'ladder_down',
      'Лесенка вниз',
      `Убывающая последовательность «${digits.slice(down.start, down.end)}»`,
      down.length * PATTERN_POINTS.ladder_down + bonus,
      down,
    );
  }

  // Прямая по клавиатуре: 147, 258, 159 и в обратную сторону.
  const keypad = keypadSpan(digits);
  if (keypad) {
    push(
      'keypad_line',
      'Линия по клавиатуре',
      `Цифры идут по одной линии «${keypad.text}»`,
      PATTERN_POINTS.keypad_line,
      keypad,
    );
  }

  // Первая и последняя цифры совпадают — «7…7».
  if (length >= 6 && digits[0] === digits[length - 1]) {
    push(
      'twin_ends',
      'Одинаковые края',
      `Начинается и заканчивается на «${digits[0]}»`,
      PATTERN_POINTS.twin_ends,
      { start: 0, end: length },
    );
  }

  // Две повторяющиеся пары подряд — «1122».
  const doublePair = doublePairSpan(digits);
  if (doublePair) {
    push(
      'aabb',
      'Двойные пары',
      `Пары «${digits.slice(doublePair.start, doublePair.end)}»`,
      PATTERN_POINTS.aabb,
      doublePair,
    );
  }

  // Пары — соседние одинаковые цифры. 112-23-44.
  let pairCount = 0;
  for (let i = 1; i < length; i += 1) {
    if (digits[i] === digits[i - 1]) pairCount += 1;
  }
  if (pairCount >= 1) {
    push('pairs', 'Пары', `Выраженных пар: ${pairCount}`, pairCount * PATTERN_POINTS.pairs, { start: 0, end: length });
  }

  // Серия — три и более одинаковых цифр подряд.
  if (run.length >= 3) {
    push(
      'series',
      'Серия',
      `Серия из ${run.length} цифр «${run.digit}»`,
      run.length * PATTERN_POINTS.series,
      run,
    );
  }

  // Круглый — заканчивается на нули. Цена растёт с числом нулей: 500000
  // встречается куда реже, чем 5000, и стоить должно дороже.
  const trailingZeros = length - digits.replace(/0+$/, '').length;
  if (trailingZeros >= 2) {
    push(
      'round',
      'Круглый',
      `Заканчивается на ${trailingZeros} нул${trailingZeros === 2 ? 'я' : 'ей'}`,
      trailingZeros * PATTERN_POINTS.round,
      { start: length - trailingZeros, end: length },
    );
  }

  // Нули подряд внутри номера — не только в хвосте.
  const zeros = zeroRunSpan(digits);
  if (zeros) {
    push(
      'zero_run',
      'Нули подряд',
      `${zeros.length} нуля подряд`,
      PATTERN_POINTS.zero_run + (zeros.length - 3) * 5,
      zeros,
    );
  }

  // Код страны внутри номера.
  const countryDigits = ctx.countryDigits ?? '';
  if (countryDigits && digits.startsWith(countryDigits) && countryDigits.length < length) {
    push(
      'country_code',
      'Код страны',
      `Номер начинается с кода «${countryDigits}»`,
      PATTERN_POINTS.country_code,
      { start: 0, end: countryDigits.length },
    );
  }

  // Гашение пересечений: идём по приоритету, вычеркиваем подчинённые узоры.
  const hits: PatternHit[] = [];
  const dropped = new Set<PatternId>();
  for (const id of PRIORITY) {
    if (dropped.has(id)) continue;
    const hit = found.get(id);
    if (!hit) continue;
    hits.push(hit);
    for (const subordinate of EXCLUDES[id] ?? []) dropped.add(subordinate);
  }

  // Страховка на случай расширения конфига новыми узорами.
  for (const id of PATTERN_ORDER) {
    if (hits.some((hit) => hit.id === id) || dropped.has(id)) continue;
    const hit = found.get(id);
    if (hit) hits.push(hit);
  }

  hits.sort((a, b) => b.points - a.points);
  const score = hits.reduce((sum, hit) => sum + hit.points, 0);
  return { hits, score };
}

/** Множитель цены от красоты комбинации: 1 + очки / 60. */
export function patternMultiplier(score: number): number {
  return Math.round((1 + score / 60) * 100) / 100;
}

/** Множество индексов цифр, входящих в найденные узоры — для подчёркивания. */
export function highlightedIndices(hits: PatternHit[]): Set<number> {
  const set = new Set<number>();
  for (const hit of hits) {
    if (!hit.span) continue;
    for (let i = hit.span.start; i < hit.span.end; i += 1) set.add(i);
  }
  return set;
}
