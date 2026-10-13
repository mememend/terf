// language: TypeScript, file: shared/src/generator.ts
// Генератор синтетических игровых номеров.
// Принцип: конструктор строит цифры под целевую категорию, а анализатор —
// тот же, что рисует «Почему Необычный» — ОБЯЗАТЕЛЬНО перепроверяет результат.
// Категория предмета всегда берётся из фактических очков, а не из запроса.

import { randomInt, type Rng } from './rng';
import { analyzeNumber, patternMultiplier } from './patterns';
import {
  ANONYMOUS,
  COUNTRIES,
  COUNTRY_BY_ID,
  RARITIES,
  isAnonymous,
  rarityForScore,
} from './config';
import { brandedOperators, pickOperatorForDigits, type CountryOperator } from './operators';import type { Country, PatternHit, PhoneNumber, RarityId, TariffId } from './types';


/**
 * Число подстановочных знаков в маске вида «+7 AAA BBB-CC-DD».
 *
 * Важно: каждая буква — отдельный разряд, а не повтор одного знака. В маске
 * России знаков десять (AAA BBB CC DD), хотя буква «A» встречается трижды.
 * Считать только «A» — ошибка, из-за которой ввод обрезался до трёх цифр.
 */
export const maskSlots = (mask: string): number =>
  [...mask].filter((char) => /[A-Z]/.test(char)).length;

/* ─────────────────────────── ПРИМИТИВЫ ─────────────────────────── */

const randomDigit = (rng: Rng, allowZero = true): string =>
  String(randomInt(rng, allowZero ? 0 : 1, 9));

/** Две разные цифры: первая — не ноль. */
function distinctPair(rng: Rng): [string, string] {
  const a = randomDigit(rng, false);
  let b = randomDigit(rng);
  if (b === a) b = String((Number(a) + 1) % 10);
  return [a, b];
}

type Builder = (length: number, rng: Rng) => string;

/* ─────────────────────────── ПРОСТЫЕ КОНСТРУКТОРЫ ─────────────────────────── */

/** Обычный номер без выраженного рисунка. */
const plain: Builder = (length, rng) => {
  let out = randomDigit(rng, false);
  while (out.length < length) out += randomDigit(rng);
  return out;
};

/** Все цифры одинаковые — 7777777. Единственный конструктор мифической категории. */
const allSame: Builder = (length, rng) => randomDigit(rng, false).repeat(length);

/** Одна выбивающаяся цифра — 111121111. */
const almostSame: Builder = (length, rng) => {
  const base = randomDigit(rng, false);
  const odd = randomInt(rng, 0, length - 1);
  let other = randomDigit(rng);
  if (other === base) other = String((Number(base) + 1) % 10);
  if (odd === 0 && other === '0') other = '1';
  return Array.from({ length }, (_, i) => (i === odd ? other : base)).join('');
};

/** Почти все единицы — внутри сам собой находится «11.11», то есть дата. */
const almostOnesWithDate: Builder = (length, rng) => {
  const odd = randomInt(rng, 0, length - 1);
  const other = odd === 0 ? '2' : '0';
  return Array.from({ length }, (_, i) => (i === odd ? other : '1')).join('');
};

/** Вставить последовательность в случайное место, остальное — фон без пар. */
function placeRun(length: number, rng: Rng, run: string): string {
  const offset = randomInt(rng, 0, Math.max(0, length - run.length));
  const chars: string[] = [];
  for (let i = 0; i < length; i += 1) {
    // Фон подбираем так, чтобы не создавать лишних пар и не портить рисунок.
    let d = randomDigit(rng);
    if (i > 0 && d === chars[i - 1]) d = String((Number(d) + 1) % 10);
    chars.push(d);
  }
  for (let i = 0; i < run.length; i += 1) chars[offset + i] = run[i];
  // Затираем возможные случайные пары на стыках рисунка.
  if (offset > 0 && chars[offset - 1] === chars[offset]) {
    chars[offset - 1] = String((Number(chars[offset]) + 1) % 10);
  }
  const after = offset + run.length;
  if (after < length && chars[after] === chars[after - 1]) {
    chars[after] = String((Number(chars[after - 1]) + 1) % 10);
  }
  if (chars[0] === '0') chars[0] = randomDigit(rng, false);
  return chars.join('');
}

/** Серия одинаковых цифр длиной size — 777. */
const series =
  (size: number): Builder =>
  (length, rng) =>
    placeRun(length, rng, randomDigit(rng, false).repeat(size));

/** Лесенка вверх — 12345. */
const ladderUp =
  (size: number): Builder =>
  (length, rng) => {
    const start = randomInt(rng, 0, Math.max(0, 9 - size));
    let run = '';
    for (let i = 0; i < size; i += 1) run += String(start + i);
    return placeRun(length, rng, run);
  };

/** Лесенка вниз — 98765. Опорный случай референса: «65432» = 35 очков. */
const ladderDown =
  (size: number): Builder =>
  (length, rng) => {
    const start = randomInt(rng, Math.min(size - 1, 9), 9);
    let run = '';
    for (let i = 0; i < size; i += 1) run += String(start - i);
    return placeRun(length, rng, run);
  };

/** Палиндром целиком. */
const palindrome: Builder = (length, rng) => {
  const half = Math.ceil(length / 2);
  let head = randomDigit(rng, false);
  while (head.length < half) head += randomDigit(rng);
  const tail = [...head].reverse().join('');
  return (head + tail).slice(0, length);
};

/** Зеркало: хвост повторяет начало в обратном порядке. */
const mirror =
  (size: number): Builder =>
  (length, rng) => {
    let head = randomDigit(rng, false);
    while (head.length < size) head += randomDigit(rng);
    const tail = [...head].reverse().join('');
    if (size * 2 >= length) return (head + tail).slice(0, length);
    let middle = '';
    const [a, b] = distinctPair(rng);
    while (middle.length < length - size * 2) {
      const next = middle.length % 2 === 0 ? a : b;
      middle += next;
    }
    return head + middle + tail;
  };

/** Чередование периода 2 — 121212. */
const alternating: Builder = (length, rng) => {
  const [a, b] = distinctPair(rng);
  let out = '';
  for (let i = 0; i < length; i += 1) out += i % 2 === 0 ? a : b;
  return out;
};

/** Повтор блока — 454545. */
const blockRepeat =
  (size: number): Builder =>
  (length, rng) => {
    let block = randomDigit(rng, false);
    while (block.length < size) block += randomDigit(rng);
    let out = '';
    while (out.length < length) out += block;
    return out.slice(0, length);
  };

/** Круглый — хвост из нулей. */
const withRoundTail =
  (zeros: number): Builder =>
  (length, rng) => {
    const headLength = Math.max(1, length - zeros);
    let out = randomDigit(rng, false);
    while (out.length < headLength) out += randomDigit(rng);
    return out + '0'.repeat(zeros);
  };

/** Код страны в начале абонентской части. */
const withCountryCode =
  (code: string): Builder =>
  (length, rng) => {
    let out = code;
    while (out.length < length) out += randomDigit(rng);
    return out.slice(0, length);
  };

/* ─────────────────────────── СОСТАВНЫЕ КОНСТРУКТОРЫ ─────────────────────────── */
// Строятся от длины: хвостовые литералы ставятся от конца, середина — фон.

/** Чередование + круглый хвост: 121212|000 → 65 + 25 очков. */
const alternatingWithRound: Builder = (length, rng) => {
  const tail = 3;
  const head = Math.max(6, length - tail);
  const [a, b] = distinctPair(rng);
  let out = '';
  for (let i = 0; i < head; i += 1) out += i % 2 === 0 ? a : b;
  return (out + '0'.repeat(tail)).slice(0, length).padEnd(length, '0');
};

/** Дата + круглый хвост: 1207 AABB 00 → 90 + 25 очков. */
const dateWithRound: Builder = (length, rng) => {
  // День от 10, чтобы первая цифра номера не была нулём и дата не сломалась.
  const day = String(randomInt(rng, 10, 28));
  const month = String(randomInt(rng, 1, 12)).padStart(2, '0');
  let out = day + month;
  const middle = Math.max(0, length - out.length - 2);
  for (let i = 0; i < middle; i += 1) out += randomDigit(rng);
  return (out + '00').slice(0, length);
};

/** Дата + чередование: 1207|ABABAB → 90 + 65 очков. */
const dateWithAlternating: Builder = (length, rng) => {
  const day = String(randomInt(rng, 10, 28));
  const month = String(randomInt(rng, 1, 12)).padStart(2, '0');
  const [a, b] = distinctPair(rng);
  let out = day + month;
  let i = out.length;
  while (out.length < length) {
    out += i % 2 === 0 ? a : b;
    i += 1;
  }
  return out.slice(0, length);
};

/** Дата + зеркало: ABC|DDMM|CBA → 90 + 55 очков. */
const dateWithMirror: Builder = (length, rng) => {
  const size = 3;
  let head = randomDigit(rng, false);
  while (head.length < size) head += randomDigit(rng);
  const tail = [...head].reverse().join('');
  const day = String(randomInt(rng, 10, 28));
  const month = String(randomInt(rng, 1, 12)).padStart(2, '0');
  let out = head + day + month + tail;
  if (out.length < length) {
    // Меняем местами середину и добиваем фоном, сохраняя зеркало по краям.
    const filler = '0'.repeat(length - out.length);
    out = head + day + month + filler + tail;
  }
  return out.slice(0, length);
};

/** Палиндром с длинной серией внутри: A|BBBBBBBB|A → 70 + пары. */
const palindromeWithSeries: Builder = (length, rng) => {
  const [a, b] = distinctPair(rng);
  return a + b.repeat(Math.max(3, length - 2)) + a;
};

/** Почти одна цифра + круглый хвост невозможны одновременно — поэтому не смешиваем. */

/* ─────────────────────────── РЕЦЕПТЫ ─────────────────────────── */

interface Recipe {
  label: string;
  build: Builder;
}

const RECIPES: Record<RarityId, Recipe[]> = {
  common: [{ label: 'обычный', build: plain }],
  uncommon: [
    { label: 'серия 3', build: series(3) },
    { label: 'лесенка вниз 5', build: ladderDown(5) },
    { label: 'лесенка вверх 4', build: ladderUp(4) },
    { label: 'круглый', build: withRoundTail(2) },
    { label: 'код страны', build: withCountryCode('7') },
  ],
  rare: [
    { label: 'лесенка вниз 6', build: ladderDown(6) },
    { label: 'лесенка вниз 7', build: ladderDown(7) },
    { label: 'лесенка вверх 5', build: ladderUp(5) },
    { label: 'зеркало', build: mirror(3) },
    { label: 'повтор блока', build: blockRepeat(3) },
    { label: 'чередование', build: alternating },
    { label: 'палиндром', build: palindrome },
  ],
  epic: [
    { label: 'почти одна цифра', build: almostSame },
    { label: 'чередование + круглый', build: alternatingWithRound },
    { label: 'дата + круглый', build: dateWithRound },
    { label: 'палиндром + серия', build: palindromeWithSeries },
  ],
  legendary: [
    { label: 'почти все единицы + дата', build: almostOnesWithDate },
    { label: 'дата + чередование', build: dateWithAlternating },
    { label: 'дата + зеркало', build: dateWithMirror },
  ],
  mythic: [{ label: 'все цифры одинаковые', build: allSame }],
};

/* ─────────────────────────── ГЕНЕРАЦИЯ ─────────────────────────── */

export interface GeneratedNumber {
  digits: string;
  hits: PatternHit[];
  score: number;
  /** Категория по фактическим очкам. */
  rarity: RarityId;
  /** true — попали точно в запрошенную категорию. */
  matchedTarget: boolean;
  recipe: string;
}

const MIN_DIGITS = 7;
const MAX_ATTEMPTS = 400;

const padTo = (value: string, length: number, rng: Rng): string => {
  let out = value.replace(/\D/g, '');
  while (out.length < length) out += randomDigit(rng);
  if (out.length > length) out = out.slice(0, length);
  return out[0] === '0' ? randomDigit(rng, false) + out.slice(1) : out;
};

export function generateDigitsForRarity(
  rarity: RarityId,
  length: number,
  rng: Rng,
  countryDigits = '',
): GeneratedNumber {
  const pool = RECIPES[rarity].map((recipe) =>
    // Код страны подставляем фактический, иначе рецепт не сработает вне России.
    recipe.label === 'код страны' && countryDigits
      ? { ...recipe, build: withCountryCode(countryDigits) }
      : recipe,
  );
  let best: GeneratedNumber | null = null;
  let bestGap = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const recipe = pool[attempt % pool.length];
    const digits = padTo(recipe.build(length, rng), length, rng);
    const analysis = analyzeNumber(digits, {
      operatorPrefix: digits.slice(0, 2),
      countryDigits,
    });
    const actual = rarityForScore(analysis.score);
    const candidate: GeneratedNumber = {
      digits,
      hits: analysis.hits,
      score: analysis.score,
      rarity: actual,
      matchedTarget: actual === rarity,
      recipe: recipe.label,
    };
    if (candidate.matchedTarget) return candidate;

    // Ближайший по очкам — резерв, если точное попадание не нашлось.
    const band = bandCenter(rarity);
    const gap = Math.abs(analysis.score - band);
    if (gap < bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }

  return (
    best ?? {
      digits: padTo(plain(length, rng), length, rng),
      hits: [],
      score: 0,
      rarity: 'common',
      matchedTarget: rarity === 'common',
      recipe: 'обычный',
    }
  );
}

function bandCenter(rarity: RarityId): number {
  const table: Record<RarityId, number> = {
    common: 4,
    uncommon: 25,
    rare: 60,
    epic: 110,
    legendary: 180,
    mythic: 300,
  };
  return table[rarity];
}

/* ─────────────────────────── СБОРКА ПРЕДМЕТА ─────────────────────────── */

/**
 * Подставить цифры в маску, обрезав хвост: для полей ввода.
 *
 * Отличие от applyMask: недостающие разряды НЕ заменяются нулями. Иначе
 * недонабранный номер выглядел бы полным — игрок ввёл три цифры, а на экране
 * уже красуется целый номер с нулями, и непонятно, сколько ещё вводить.
 */
export function applyMaskPartial(mask: string, digits: string): string {
  let cursor = 0;
  let out = '';
  for (const char of mask) {
    if (/[A-Z]/.test(char)) {
      if (cursor >= digits.length) break;
      out += digits[cursor];
      cursor += 1;
    } else {
      out += char;
    }
  }
  // Убираем висящий разделитель: «+7 792-» читается хуже, чем «+7 792».
  return out.replace(/[\s\-()]+$/, '');
}

/**
 * Цифры, которые игрок набрал в поле номера.
 *
 * В поле лежит уже готовый номер с кодом страны («+7 920 …»), поэтому код
 * при разборе отбрасываем — это литерал маски, а не ввод. Без этого код
 * занимал первый разряд, маска подставляла его снова, и любая введённая
 * цифра превращалась в «7».
 *
 * Тонкость: у США и Канады код «+1», и первая же введённая единица неотличима
 * от кода. Поэтому отбрасываем код только тогда, когда поле уже отформатировано
 * (есть «+», скобки или пробелы) либо цифр заведомо больше, чем длина кода.
 * Цифра, набранная в пустое поле, — всегда ввод игрока.
 */
export function digitsFromMaskedInput(mask: string, code: string, value: string): string {
  const codeDigits = code.replace(/\D/g, '');
  const raw = value.replace(/\D/g, '');
  const formatted = /[^\d]/.test(value);

  const looksLikeCode =
    codeDigits.length > 0 &&
    raw.startsWith(codeDigits) &&
    (formatted || raw.length > codeDigits.length);

  const typed = looksLikeCode ? raw.slice(codeDigits.length) : raw;
  return typed.slice(0, maskSlots(mask));
}

/** Подставить цифры в маску вида «+7 AAA BBB-CC-DD». */
export function applyMask(mask: string, digits: string): string {
  let cursor = 0;
  let out = '';
  for (const char of mask) {
    if (/[A-Z]/.test(char)) {
      out += digits[cursor] ?? '0';
      cursor += 1;
    } else {
      out += char;
    }
  }
  return out;
}

export interface IssueInput {
  /** null — «Любая страна», регион выбирается случайно */
  countryId: string | null;
  tariffId: TariffId;
  /** Запрошенная категория из ролла тарифа; факт определит анализатор */
  rarity: RarityId;
  releaseId: string;
  rng: Rng;
  /** Выбранный игроком оператор: номер начнётся с одного из его кодов */
  operatorId?: string;
  /** Выбранный код внутри оператора; пусто — любой код этого оператора */
  code?: string;
}

export function issueNumber(input: IssueInput): PhoneNumber {
  const country: Country =
    (input.countryId ? COUNTRY_BY_ID[input.countryId] : undefined) ??
    COUNTRIES[randomInt(input.rng, 0, COUNTRIES.length - 1)];

  const length = Math.max(MIN_DIGITS, maskSlots(country.mask));
  const countryDigits = country.code.replace(/\D/g, '');
  const generated = generateDigitsForRarity(input.rarity, length, input.rng, countryDigits);

  // Категорию определяет анализатор, а не запрос.
  const rarity = generated.rarity;
  let digits = generated.digits;

  // Если игрок выбрал конкретного оператора — номер обязан начинаться с его кода.
  let operatorId: string;
  if (input.operatorId) {
    const applied = applyOperatorCode(
      brandedOperators(country.id),
      input.operatorId,
      input.code ?? null,
      digits,
      input.rng,
    );
    operatorId = applied.operatorId;
    digits = applied.digits;
  } else {
    operatorId = pickOperatorForDigits(country.id, digits);
  }

  // Код ничей — пробуем подставить код настоящего оператора региона.
  // Подстановка принимается, только если категория сохранилась: иначе номер
  // подешевел бы ради красивой картинки, а это обман.
  if (operatorId === 'carrier' && !input.operatorId) {
    for (const candidate of brandedOperators(country.id)) {
      const prefix = candidate.codes[randomInt(input.rng, 0, candidate.codes.length - 1)];
      const prefixLength = Math.min(prefix.length, digits.length);
      const candidateDigits = prefix.slice(0, prefixLength) + digits.slice(prefixLength);
      if (candidateDigits[0] === '0') continue;

      const check = analyzeNumber(candidateDigits, {
        operatorPrefix: candidateDigits.slice(0, 2),
        countryDigits,
      });
      if (rarityForScore(check.score) !== rarity) continue;

      digits = candidateDigits;
      operatorId = candidate.id;
      break;
    }
  }

  // Финальный анализ по фактическим цифрам: после подстановки кода рисунок мог
  // измениться, и категория обязана соответствовать тому, что записано в номере.
  const analysis = analyzeNumber(digits, {
    operatorPrefix: digits.slice(0, 2),
    countryDigits,
  });
  const finalRarity = rarityForScore(analysis.score);
  const multiplier = patternMultiplier(analysis.score);
  const basePrice = RARITIES[finalRarity].basePrice;

  /**
   * Анонимный номер оценивается иначе: у него нет страны и спроса, зато есть
   * редкость. Вместо множителя спроса тянем случайный коэффициент — два
   * анонимных номера одной категории могут стоить совершенно по-разному.
   */
  const demandMultiplier = isAnonymous(country.id)
    ? Math.round(
        (ANONYMOUS.minCoefficient +
          input.rng() * (ANONYMOUS.maxCoefficient - ANONYMOUS.minCoefficient)) *
          100,
      ) / 100
    : country.demand;

  const finalPrice = Math.round(basePrice * multiplier * demandMultiplier);

  return {
    id: `num_${input.releaseId}`,
    display: applyMask(country.mask, digits),
    digits,
    countryId: country.id,
    regionCode: country.code,
    operatorId,
    tariffId: input.tariffId,
    rarity: finalRarity,
    basePrice,
    patternMultiplier: multiplier,
    demandMultiplier,
    finalPrice,
    score: analysis.score,
    patterns: analysis.hits,
    issuedAt: new Date().toISOString(),
    releaseId: input.releaseId,
    limitedEdition: null,
  };
}

/**
 * Поставить в начало номера код выбранного оператора.
 * Хвост сохраняется — меняется только код. Если оператора нет среди брендов
 * региона, возвращаем перевозчика, и номер уйдёт по общему пути.
 */
function applyOperatorCode(
  operators: CountryOperator[],
  operatorId: string,
  code: string | null,
  digits: string,
  rng: Rng,
): { operatorId: string; digits: string } {
  const operator = operators.find((item) => item.id === operatorId);
  if (!operator || operator.codes.length === 0) {
    return { operatorId: 'carrier', digits };
  }

  // Если игрок выбрал конкретный код — берём его; иначе любой из кодов оператора.
  const chosen =
    code && operator.codes.includes(code)
      ? code
      : operator.codes[randomInt(rng, 0, operator.codes.length - 1)];
  const length = Math.min(chosen.length, digits.length);
  return { operatorId: operator.id, digits: chosen.slice(0, length) + digits.slice(length) };
}


