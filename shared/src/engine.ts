// language: TypeScript, file: shared/src/engine.ts
// Игровой движок. Чистые функции: состояние на входе — состояние на выходе.
// Тот же код переезжает на backend без изменений, поэтому здесь нет доступа к DOM.

import {
  COUNTRIES,
  COUNTRY_BY_ID,
  ECONOMY,
  LUCK,
  RARITIES,
  TARIFFS,
  UPGRADES,
  UPGRADE_ORDER,
  formatMoneyWithSign,
  nextRarity,
  rarityForScore,
  upgradePrice,
} from './config';
import { brandedOperators, operatorById, pickOperatorForDigits } from './operators';
import { applyMask, generateDigitsForRarity, issueNumber } from './generator';
import { analyzeNumber, patternMultiplier } from './patterns';
import { ACHIEVEMENTS, dailyAvailable, dailyReward, dailyTicket } from './quests';
import { createId, makeRng, randomInt, type Rng } from './rng';
import type {
  GameState,
  LedgerEntry,
  LuckState,
  PhoneNumber,
  Player,
  RarityId,
  TariffId,
  UpgradeId,
} from './types';

export const SCHEMA_VERSION = 4;

/* ─────────────────────────── УДАЧА И РАСПРЕДЕЛЕНИЕ ─────────────────────────── */

/**
 * Активный множитель удачи. Истёкший бонус не влияет ни на что.
 *
 * Удача бывает двух видов: по времени (ивент) и по круткам (приз рулетки).
 * Достаточно любого из них — что кончится позже, то и действует.
 */
export function activeLuck(state: GameState, now = Date.now()): number {
  const { multiplier, expiresAt, spinsLeft } = state.player.luck;
  if (multiplier <= 1) return 1;
  if (spinsLeft > 0) return multiplier;
  // Крутки кончились и срока нет — бонус исчерпан, а не бессрочный.
  // Иначе удача из рулетки осталась бы навсегда после последней крутки.
  if (expiresAt === null) return 1;
  return new Date(expiresAt).getTime() > now ? multiplier : 1;
}

/** Сколько круток удачи осталось — для подписи на баннере. */
export function luckSpinsLeft(state: GameState): number {
  return Math.max(0, state.player.luck.spinsLeft);
}

/**
 * Итоговое распределение категорий для тарифа с учётом удачи.
 * Удача множит шансы редких и выше, затем ВСЁ распределение нормализуется
 * обратно к 100 % — иначе сумма вероятностей уезжает за 100 и шансы становятся ложными.
 */
export function distributionFor(
  tariffId: TariffId,
  luckMultiplier = 1,
): Record<RarityId, number> {
  const base = TARIFFS[tariffId].odds;
  const boosted = { ...base };
  if (luckMultiplier > 1) {
    for (const rarity of LUCK.boostedRarities) {
      boosted[rarity] = base[rarity] * luckMultiplier;
    }
  }
  const total = Object.values(boosted).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...base };
  const normalized = {} as Record<RarityId, number>;
  for (const key of Object.keys(boosted) as RarityId[]) {
    normalized[key] = (boosted[key] / total) * 100;
  }
  return normalized;
}

/** Процент «редкий и выше» для карточки тарифа. */
export function rarePlusShare(tariffId: TariffId, luckMultiplier = 1): number {
  const distribution = distributionFor(tariffId, luckMultiplier);
  return (
    distribution.rare + distribution.epic + distribution.legendary + distribution.mythic
  );
}

/* ─────────────────────────── ВЫПУСК ─────────────────────────── */

export interface ReleaseResult {
  ok: boolean;
  state: GameState;
  number: PhoneNumber | null;
  /** Код ошибки для клиента: 'insufficient_funds' | 'no_tickets' | 'duplicate' | 'slots_full' */
  error?: 'insufficient_funds' | 'no_tickets' | 'duplicate' | 'slots_full';
  spent: number;
}

function ledger(_state: GameState, entry: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
  return { ...entry, id: createId('led'), at: new Date().toISOString() };
}

export function tariffCost(tariffId: TariffId): { money: number; tickets: number } {
  const tariff = TARIFFS[tariffId];
  return { money: tariff.price ?? 0, tickets: tariff.ticketCost ?? 0 };
}

/** Цена выпуска с учётом надбавки за своего оператора. */
export function releaseCost(
  tariffId: TariffId,
  selectedOperator: string | null,
): { money: number; tickets: number; surcharge: number } {
  const base = tariffCost(tariffId);
  if (!selectedOperator || base.money === 0) {
    return { ...base, surcharge: 0 };
  }
  const money = Math.round(base.money * (1 + ECONOMY.operatorSurcharge));
  return { money, tickets: base.tickets, surcharge: money - base.money };
}

/**
 * Полный цикл выпуска. Порядок из ТЗ: проверка средств → генерация → списание
 * → опыт → запись в историю. Списание только при успехе, releaseId защищает
 * от повторного выполнения одного и того же запроса.
 */
export function release(
  state: GameState,
  options: { countryId?: string | null; tariffId?: TariffId; releaseId?: string } = {},
): ReleaseResult {
  const tariffId = options.tariffId ?? state.selectedTariff;
  const countryId = options.countryId === undefined ? state.selectedCountry : options.countryId;
  const releaseId = options.releaseId ?? createId('rel');

  // Идемпотентность: тот же releaseId второй раз не выполняется.
  if (state.processedReleaseIds.includes(releaseId)) {
    return { ok: false, state, number: null, error: 'duplicate', spent: 0 };
  }

  const cost = releaseCost(tariffId, state.selectedOperator);
  if (cost.tickets > 0 && state.player.tickets < cost.tickets) {
    return { ok: false, state, number: null, error: 'no_tickets', spent: 0 };
  }
  if (state.player.balance < cost.money) {
    return { ok: false, state, number: null, error: 'insufficient_funds', spent: 0 };
  }
  if (state.numbers.length >= state.slots) {
    return { ok: false, state, number: null, error: 'slots_full', spent: 0 };
  }

  // Детерминированный seed от releaseId: результат воспроизводим и его можно доказать.
  const rng: Rng = makeRng(hashSeed(releaseId));
  const luck = activeLuck(state);
  const rarity = rollRarity(tariffId, luck, rng);
  const number = issueNumber({
    countryId,
    tariffId,
    rarity,
    releaseId,
    rng,
    // Свой оператор и код: номер начнётся именно с них.
    operatorId: state.selectedOperator ?? undefined,
    code: state.selectedCode ?? undefined,
  });

  const player: Player = { ...state.player };

  /*
   * Бесплатный выпуск из рулетки: деньги не списываются, счётчик уменьшается.
   * Билеты он не заменяет — «Элит» по-прежнему выпускается по билету.
   */
  const useFree = player.freeReleases > 0 && cost.money > 0;
  if (useFree) {
    player.freeReleases -= 1;
  } else {
    player.balance -= cost.money;
  }
  player.tickets -= cost.tickets;

  // Удача по круткам сгорает по одной за выпуск.
  if (player.luck.spinsLeft > 0 && player.luck.multiplier > 1) {
    player.luck = { ...player.luck, spinsLeft: player.luck.spinsLeft - 1 };
  }

  const xpGain = Math.round(RARITIES[number.rarity].xp * TARIFFS[tariffId].xpMultiplier);
  player.xp += xpGain;
  while (player.xp >= ECONOMY.xpForLevel(player.level)) {
    player.xp -= ECONOMY.xpForLevel(player.level);
    player.level += 1;
  }

  const entries: LedgerEntry[] = [];
  if (cost.money > 0) {
    entries.push(
      ledger(state, {
        kind: 'release',
        amount: -cost.money,
        label:
          cost.surcharge > 0
            ? `Выпуск SIM · ${TARIFFS[tariffId].name} · свой оператор (+${cost.surcharge} ₽)`
            : `Выпуск SIM · ${TARIFFS[tariffId].name} · ${RARITIES[number.rarity].name}`,
        numberId: number.id,
      }),
    );
  }
  if (cost.tickets > 0) {
    entries.push(
      ledger(state, {
        kind: 'release',
        amount: 0,
        label: `Выпуск SIM · ${TARIFFS[tariffId].name} · по билету`,
        numberId: number.id,
      }),
    );
  }

  return {
    ok: true,
    // За бесплатный выпуск из рулетки денег не взято — значит и списано ноль.
    spent: useFree ? 0 : cost.money,
    number,
    state: {
      ...state,
      player,
      numbers: [number, ...state.numbers],
      ledger: [...entries, ...state.ledger].slice(0, 500),
      processedReleaseIds: [releaseId, ...state.processedReleaseIds].slice(0, 500),
    },
  };
}

function rollRarity(tariffId: TariffId, luck: number, rng: Rng): RarityId {
  const distribution = distributionFor(tariffId, luck);
  const roll = rng() * 100;
  let cursor = 0;
  const order: RarityId[] = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  for (const rarity of order) {
    cursor += distribution[rarity];
    if (roll <= cursor) return rarity;
  }
  return 'common';
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/* ─────────────────────────── ПРОДАЖА ─────────────────────────── */

export function sellNumber(
  state: GameState,
  numberId: string,
): { ok: boolean; state: GameState; error?: 'not_found' | 'locked' } {
  const number = state.numbers.find((item) => item.id === numberId);
  if (!number) return { ok: false, state, error: 'not_found' };
  if (state.player.primaryNumberId === numberId) return { ok: false, state, error: 'locked' };

  const payout = Math.round(number.finalPrice * ECONOMY.sellRate);
  return {
    ok: true,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + payout },
      numbers: state.numbers.filter((item) => item.id !== numberId),
      ledger: [
        ledger(state, {
          kind: 'sale',
          amount: payout,
          label: `Продажа · ${number.display}`,
          numberId: number.id,
        }),
        ...state.ledger,
      ].slice(0, 500),
    },
  };
}

/* ─────────────────────────── МАССОВАЯ ПРОДАЖА ─────────────────────────── */

export interface BulkSaleResult {
  ok: boolean;
  state: GameState;
  /** Сколько номеров реально продано */
  sold: number;
  /** Сколько денег получено всего */
  total: number;
  /** Что не продалось и почему — основной номер продать нельзя */
  skipped: { id: string; reason: string }[];
}

/**
 * Продать несколько номеров разом.
 *
 * Каждый номер продаётся по общим правилам, поэтому основной номер в списке
 * просто пропускается с причиной — отдельная ветка логики здесь не нужна.
 * Состояние собирается последовательно: если игрок снял галочку с одного
 * номера, остальные всё равно должны продаться.
 */
export function sellMany(state: GameState, ids: string[]): BulkSaleResult {
  let current = state;
  let sold = 0;
  let total = 0;
  const skipped: { id: string; reason: string }[] = [];

  // Дубликаты в списке не должны продавать номер дважды.
  for (const id of [...new Set(ids)]) {
    const before = current.player.balance;
    const result = sellNumber(current, id);
    if (!result.ok) {
      skipped.push({ id, reason: result.error ?? 'unknown' });
      continue;
    }
    current = result.state;
    sold += 1;
    total += current.player.balance - before;
  }

  return { ok: sold > 0, state: current, sold, total, skipped };
}

/* ─────────────────────────── ЗАМЕНА ЦИФРЫ ─────────────────────────── */

/**
 * Прогноз замены одной цифры: считаем три ветки — подорожает, не изменится,
 * подешевеет. Клиент показывает эти проценты перед оплатой.
 */
export interface DigitChangeForecast {
  index: number;
  currentDigit: string;
  willRise: number;
  same: number;
  willFall: number;
  bestPrice: number;
  worstPrice: number;
  price: number;
}

export function forecastDigitChange(number: PhoneNumber, index: number): DigitChangeForecast {
  const rng = makeRng(hashSeed(`${number.id}:${index}`));
  let rise = 0;
  let same = 0;
  let fall = 0;
  let best = 0;
  let worst = Number.POSITIVE_INFINITY;

  for (let d = 0; d <= 9; d += 1) {
    if (String(d) === number.digits[index]) continue;
    const digits = number.digits.slice(0, index) + d + number.digits.slice(index + 1);
    const analysis = analyzeNumber(digits, { operatorPrefix: digits.slice(0, 2) });
    const price = Math.round(
      RARITIES[rarityForScore(analysis.score)].basePrice *
        patternMultiplier(analysis.score) *
        number.demandMultiplier,
    );
    if (price > number.finalPrice) rise += 1;
    else if (price === number.finalPrice) same += 1;
    else fall += 1;
    if (price > best) best = price;
    if (price < worst) worst = price;
  }

  const total = Math.max(1, rise + same + fall);
  // Небольшой разброс от seed, чтобы прогноз не был идеально кратным 1/9.
  const jitter = 0.94 + rng() * 0.12;
  return {
    index,
    currentDigit: number.digits[index],
    willRise: Math.round((rise / total) * 100 * jitter),
    same: Math.round((same / total) * 100 * jitter),
    willFall: Math.round((fall / total) * 100 * jitter),
    bestPrice: best || number.finalPrice,
    worstPrice: Number.isFinite(worst) ? worst : number.finalPrice,
    price: number.finalPrice,
  };
}

/** Итог замены одной цифры номера. */
export interface DigitChangeResult {
  ok: boolean;
  state: GameState;
  number: PhoneNumber | null;
  error?: 'not_found' | 'insufficient_funds' | 'bad_index';
}

/**
 * Замена цифры за игровую валюту. Новая цифра выбирается случайно,
 * номер может подорожать или подешеветь — как и обещает витрина.
 * Оценка, категория и очки пересчитываются на сервере заново.
 */
export function changeDigit(
  state: GameState,
  numberId: string,
  index: number,
): DigitChangeResult {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: 'not_found' };
  if (index < 0 || index >= existing.digits.length) {
    return { ok: false, state, number: null, error: 'bad_index' };
  }
  if (state.player.balance < ECONOMY.digitChangePrice) {
    return { ok: false, state, number: null, error: 'insufficient_funds' };
  }

  const rng = makeRng(hashSeed(`${numberId}:${index}:${Date.now()}`));
  let next = String(randomInt(rng, 0, 9));
  if (next === existing.digits[index]) next = String((Number(next) + 1) % 10);
  if (index === 0 && next === '0') next = '1';

  const digits =
    existing.digits.slice(0, index) + next + existing.digits.slice(index + 1);
  const analysis = analyzeNumber(digits, { operatorPrefix: digits.slice(0, 2) });
  const rarity = rarityForScore(analysis.score);
  const number: PhoneNumber = {
    ...existing,
    digits,
    display: applyMask(countryOf(existing).mask, digits),
    rarity,
    basePrice: RARITIES[rarity].basePrice,
    patternMultiplier: patternMultiplier(analysis.score),
    finalPrice: Math.round(
      RARITIES[rarity].basePrice *
        patternMultiplier(analysis.score) *
        existing.demandMultiplier,
    ),
    score: analysis.score,
    patterns: analysis.hits,
  };

  return {
    ok: true,
    number,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance - ECONOMY.digitChangePrice },
      numbers: state.numbers.map((item) => (item.id === numberId ? number : item)),
      ledger: [
        ledger(state, {
          kind: 'digit_change',
          amount: -ECONOMY.digitChangePrice,
          label: `Замена цифры · ${number.display}`,
          numberId,
        }),
        ...state.ledger,
      ].slice(0, 500),
    },
  };
}

/* ─────────────────────────── СМЕНА ОСНОВНОГО НОМЕРА ─────────────────────────── */export function setPrimaryNumber(
  state: GameState,
  numberId: string,
): { ok: boolean; state: GameState; error?: 'not_found' | 'insufficient_funds' } {
  if (!state.numbers.some((item) => item.id === numberId)) {
    return { ok: false, state, error: 'not_found' };
  }
  const player = { ...state.player };
  if (player.freePrimarySwaps > 0) {
    player.freePrimarySwaps -= 1;
  } else if (player.balance >= ECONOMY.primarySwapPrice) {
    player.balance -= ECONOMY.primarySwapPrice;
  } else {
    return { ok: false, state, error: 'insufficient_funds' };
  }
  player.primaryNumberId = numberId;
  return { ok: true, state: { ...state, player } };
}

/* ─────────────────────────── ПОДДЕРЖКА БАЛАНСА ─────────────────────────── */

/** Бонус, когда средств меньше цены Стандарта — механика «Бонус» из меню. */
export function claimBailout(state: GameState): { ok: boolean; state: GameState } {
  if (state.player.balance >= ECONOMY.bailoutThreshold) return { ok: false, state };
  return {
    ok: true,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + ECONOMY.bailoutAmount },
      ledger: [
        ledger(state, {
          kind: 'daily',
          amount: ECONOMY.bailoutAmount,
          label: 'Бонус · баланс ниже стоимости Стандарта',
        }),
        ...state.ledger,
      ].slice(0, 500),
    },
  };
}

/* ─────────────────────────── УЛУЧШЕНИЯ НОМЕРА ─────────────────────────── */

export interface UpgradeResult {
  ok: boolean;
  state: GameState;
  number: PhoneNumber | null;
  error?:
    | 'not_found'
    | 'insufficient_funds'
    | 'bad_index'
    | 'max_rarity'
    | 'same_digit'
    | 'leading_zero';
}

/**
 * Пересобирает номер по новым цифрам: категория, очки, множитель и цена
 * считаются заново тем же анализатором. Из старого номера берётся только
 * регион и спрос — иначе оценку можно было бы подделать.
 */
export function rebuildNumber(number: PhoneNumber, digits: string): PhoneNumber {
  const country = countryOf(number);
  const analysis = analyzeNumber(digits, {
    operatorPrefix: digits.slice(0, 2),
    countryDigits: country.code.replace(/\D/g, ''),
  });
  const rarity = rarityForScore(analysis.score);
  const multiplier = patternMultiplier(analysis.score);
  const basePrice = RARITIES[rarity].basePrice;

  return {
    ...number,
    digits,
    display: applyMask(country.mask, digits),
    operatorId: pickOperatorForDigits(country.id, digits),
    rarity,
    basePrice,
    patternMultiplier: multiplier,
    finalPrice: Math.round(basePrice * multiplier * number.demandMultiplier),
    score: analysis.score,
    patterns: analysis.hits,
  };
}

/** Длина абонентской части номера в его регионе. */
function digitsLengthFor(number: PhoneNumber): number {
  const country = countryOf(number);
  return Math.max(7, [...country.mask].filter((char) => /[A-Z]/.test(char)).length);
}

/** Общая обёртка: проверить средства, заменить номер, записать в журнал. */
function commitUpgrade(
  state: GameState,
  numberId: string,
  price: number,
  label: string,
  produce: (number: PhoneNumber) => PhoneNumber | UpgradeResult,
): UpgradeResult {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: 'not_found' };
  if (price <= 0) return { ok: false, state, number: null, error: 'max_rarity' };
  if (state.player.balance < price) {
    return { ok: false, state, number: null, error: 'insufficient_funds' };
  }

  const produced = produce(existing);
  // Конструктор может вернуть готовую ошибку вместо номера.
  if ('ok' in produced) return produced;

  return {
    ok: true,
    number: produced,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance - price },
      numbers: state.numbers.map((item) => (item.id === numberId ? produced : item)),
      ledger: [
        ledger(state, { kind: 'upgrade', amount: -price, label, numberId }),
        ...state.ledger,
      ].slice(0, 500),
    },
  };
}

/** Перестановка двух цифр местами. Результат известен заранее — случайности нет. */
export function swapDigits(
  state: GameState,
  numberId: string,
  a: number,
  b: number,
): UpgradeResult {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: 'not_found' };
  if (
    a === b ||
    a < 0 ||
    b < 0 ||
    a >= existing.digits.length ||
    b >= existing.digits.length
  ) {
    return { ok: false, state, number: null, error: 'bad_index' };
  }
  if (existing.digits[a] === existing.digits[b]) {
    return { ok: false, state, number: null, error: 'same_digit' };
  }

  const chars = [...existing.digits];
  [chars[a], chars[b]] = [chars[b], chars[a]];

  // Абонентская часть не может начинаться с нуля: такой номер нереалистичен
  // и ломает формат отображения. Перестановку, которая это делает, отклоняем.
  if (chars[0] === '0') {
    return { ok: false, state, number: null, error: 'leading_zero' };
  }

  const price = upgradePrice('swap', existing);

  return commitUpgrade(state, numberId, price, `Перестановка · ${existing.display}`, (number) =>
    rebuildNumber(number, chars.join('')),
  );
}

/** Допустима ли перестановка: нужна и витрине, чтобы не предлагать невозможное. */
export function isSwapAllowed(number: PhoneNumber, a: number, b: number): boolean {
  const length = number.digits.length;
  if (a === b || a < 0 || b < 0 || a >= length || b >= length) return false;
  if (number.digits[a] === number.digits[b]) return false;
  const chars = [...number.digits];
  [chars[a], chars[b]] = [chars[b], chars[a]];
  return chars[0] !== '0';
}

/** Полный перебор цифр с сохранением категории. */
export function rerollNumber(state: GameState, numberId: string): UpgradeResult {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: 'not_found' };

  const country = countryOf(existing);
  const price = upgradePrice('reroll', existing);

  return commitUpgrade(state, numberId, price, `Перебор · ${existing.display}`, (number) => {
    const rng = makeRng(hashSeed(`${numberId}:reroll:${Date.now()}`));
    const generated = generateDigitsForRarity(
      number.rarity,
      digitsLengthFor(number),
      rng,
      country.code.replace(/\D/g, ''),
    );
    return rebuildNumber(number, generated.digits);
  });
}

/** Апелляция: гарантированный подъём на одну категорию. Без случайности. */
export function appealNumber(state: GameState, numberId: string): UpgradeResult {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: 'not_found' };

  const target = nextRarity(existing.rarity);
  if (!target) return { ok: false, state, number: null, error: 'max_rarity' };

  const country = countryOf(existing);
  const price = upgradePrice('appeal', existing);

  return commitUpgrade(state, numberId, price, `Апелляция · ${RARITIES[target].name}`, (number) => {
    const rng = makeRng(hashSeed(`${numberId}:appeal:${target}:${Date.now()}`));
    const generated = generateDigitsForRarity(
      target,
      digitsLengthFor(number),
      rng,
      country.code.replace(/\D/g, ''),
    );
    return rebuildNumber(number, generated.digits);
  });
}

/**
 * Смена оператора: префикс номера переезжает к другому оператору того же региона.
 * Остальные цифры остаются на месте, но префикс участвует в узорах — поэтому
 * очки, категория и цена пересчитываются и могут как вырасти, так и упасть.
 */
export function changeOperator(
  state: GameState,
  numberId: string,
  operatorId: string,
): UpgradeResult {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: 'not_found' };
  if (!operatorId || existing.operatorId === operatorId) {
    return { ok: false, state, number: null, error: 'same_digit' };
  }

  const country = countryOf(existing);
  // Оператор обязан принадлежать региону номера: иначе номер потеряет прописку.
  const target = brandedOperators(country.id).find((item) => item.id === operatorId);
  if (!target || target.codes.length === 0) {
    return { ok: false, state, number: null, error: 'bad_index' };
  }

  // Берём ПЕРВЫЙ код оператора, а не случайный: витрина показывает будущий
  // номер заранее и обязана совпасть с тем, что реально запишется.
  const prefix = target.codes[0];
  const length = Math.min(prefix.length, existing.digits.length);
  const digits = prefix.slice(0, length) + existing.digits.slice(length);
  if (digits[0] === '0') {
    return { ok: false, state, number: null, error: 'leading_zero' };
  }

  const price = upgradePrice('operator', existing);

  return commitUpgrade(
    state,
    numberId,
    price,
    `Смена оператора · ${operatorById(operatorId).name}`,
    (number) => ({ ...rebuildNumber(number, digits), operatorId }),
  );
}

/** Каких операторов можно выбрать для этого номера. */
export interface OperatorChoice {
  id: string;
  name: string;
  /** Первый код оператора — как будет начинаться номер после перехода */
  samplePrefix: string;
  /** Все коды оператора: игроку показываем их количество */
  codes: string[];
  color: string;
  badge: string;
  /** Уже текущий оператор — выбирать нечего */
  current: boolean;
}

/**
 * Каких операторов можно выбрать для этого номера.
 * Перевозчик из списка исключён: у него нет префиксов, перейти к нему нельзя —
 * предлагать его в интерфейсе значило бы давать кнопку, которая всегда падает.
 */
export function operatorChoices(number: PhoneNumber): OperatorChoice[] {
  const country = countryOf(number);
  // Перевозчик сюда не попадает: у него нет кодов, перейти к нему нельзя.
  return brandedOperators(country.id).map((operator) => ({
    id: operator.id,
    name: operator.name,
    samplePrefix: operator.codes[0] ?? '',
    codes: operator.codes,
    color: operator.color,
    badge: operator.badge,
    current: operator.id === number.operatorId,
  }));
}

export function applyUpgrade(
  state: GameState,
  numberId: string,
  id: UpgradeId,
  params: { index?: number; a?: number; b?: number; operatorId?: string } = {},
): UpgradeResult {
  switch (id) {
    case 'digit': {
      const result = changeDigit(state, numberId, params.index ?? 0);
      return { ...result, number: result.number ?? null };
    }
    case 'swap':
      return swapDigits(state, numberId, params.a ?? 0, params.b ?? 1);
    case 'reroll':
      return rerollNumber(state, numberId);
    case 'appeal':
      return appealNumber(state, numberId);
    case 'operator':
      return changeOperator(state, numberId, params.operatorId ?? '');
    default:
      return { ok: false, state, number: null, error: 'not_found' };
  }
}

/** Витрина улучшений: что можно сделать с этим номером и сколько это стоит. */
export interface UpgradeOffer {
  id: UpgradeId;
  name: string;
  effect: string;
  description: string;
  price: number;
  /** Хватает ли средств прямо сейчас */
  affordable: boolean;
  /** Есть ли смысл: у мифического апелляция недоступна */
  available: boolean;
  /** Какая категория получится: null — останется прежней */
  targetRarity: RarityId | null;
  /** Для смены оператора — доступные варианты */
  operators?: OperatorChoice[];
}

export function upgradeOffers(state: GameState, numberId: string): UpgradeOffer[] {
  const number = state.numbers.find((item) => item.id === numberId);
  if (!number) return [];
  const balance = state.player.balance;

  return UPGRADE_ORDER.map((id) => {
    const meta = UPGRADES[id];
    const price = upgradePrice(id, number);
    const targetRarity = id === 'appeal' ? nextRarity(number.rarity) : null;
    // У смены оператора смысл есть, только если в регионе есть куда переходить.
    const choices = id === 'operator' ? operatorChoices(number) : undefined;
    const hasAlternative = choices ? choices.some((choice) => !choice.current) : true;

    return {
      id,
      name: meta.name,
      effect: meta.effect,
      description: meta.description,
      price,
      affordable: balance >= price && price > 0,
      available:
        (id === 'appeal' ? targetRarity !== null : true) && hasAlternative,
      targetRarity,
      ...(choices ? { operators: choices } : {}),
    };
  });
}

/* ─────────────────────────── ЕЖЕДНЕВНАЯ НАГРАДА ─────────────────────────── */

/** Награда дня: раз в 24 часа, растёт вместе с серией входов. */
export function claimDaily(state: GameState): {
  ok: boolean;
  state: GameState;
  amount: number;
  tickets: number;
} {
  const now = Date.now();
  if (!dailyAvailable(state, now)) return { ok: false, state, amount: 0, tickets: 0 };

  const amount = dailyReward(state);
  const streakAfter = state.player.dailyStreak + 1;
  // Каждый седьмой день — билет: он ценнее денег, потому что открывает «Элит».
  const tickets = dailyTicket(streakAfter);
  const player: Player = {
    ...state.player,
    balance: state.player.balance + amount,
    tickets: state.player.tickets + tickets,
    dailyStreak: streakAfter,
  };

  const entries: LedgerEntry[] = [
    ledger(state, {
      kind: 'daily',
      amount,
      label: `Награда дня · серия ${streakAfter}`,
    }),
  ];
  if (tickets > 0) {
    entries.unshift(
      ledger(state, {
        kind: 'ticket',
        amount: tickets,
        label: `Билет за серию ${streakAfter} дней`,
      }),
    );
  }

  return {
    ok: true,
    amount,
    tickets,
    state: {
      ...state,
      player,
      ledger: [...entries, ...state.ledger].slice(0, 500),
    },
  };
}

/* ─────────────────────────── ДОСТИЖЕНИЯ ─────────────────────────── */

export interface ClaimResult {
  ok: boolean;
  state: GameState;
  amount: number;
  error?: 'not_found' | 'locked' | 'already';
}

/**
 * Получить награду за достижение.
 *
 * Условие проверяется по фактическому состоянию, а не по тому, что прислал
 * клиент: закрытое достижение нельзя получить дважды, а незакрытое — вообще.
 */
export function claimAchievement(state: GameState, achievementId: string): ClaimResult {
  const achievement = ACHIEVEMENTS.find((item) => item.id === achievementId);
  if (!achievement) return { ok: false, state, amount: 0, error: 'not_found' };
  if (state.claimedAchievements.includes(achievementId)) {
    return { ok: false, state, amount: 0, error: 'already' };
  }
  if (achievement.progress(state) < achievement.target) {
    return { ok: false, state, amount: 0, error: 'locked' };
  }

  return {
    ok: true,
    amount: achievement.reward,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + achievement.reward },
      claimedAchievements: [...state.claimedAchievements, achievementId],
      ledger: [
        ledger(state, {
          kind: 'quest',
          amount: achievement.reward,
          label: `Достижение · ${achievement.title}`,
        }),
        ...state.ledger,
      ].slice(0, 500),
    },
  };
}

/** Что можно забрать прямо сейчас — для бейджа на пункте меню. */
export function claimableAchievements(state: GameState): string[] {
  return ACHIEVEMENTS.filter(
    (achievement) =>
      achievement.progress(state) >= achievement.target &&
      !state.claimedAchievements.includes(achievement.id),
  ).map((achievement) => achievement.id);
}

/* ─────────────────────────── СОЗДАНИЕ ИГРОКА ─────────────────────────── */

export function createInitialState(overrides: Partial<Player> = {}): GameState {
  return {
    schema: SCHEMA_VERSION,
    player: {
      id: overrides.id ?? createId('plr'),
      name: overrides.name ?? 'Игрок',
      avatarUrl: overrides.avatarUrl ?? null,
      balance: overrides.balance ?? ECONOMY.startingBalance,
      tickets: overrides.tickets ?? ECONOMY.startingTickets,
      level: overrides.level ?? 1,
      xp: overrides.xp ?? 0,
      primaryNumberId: null,
      freeReleases: 0,
      freePrimarySwaps: ECONOMY.freePrimarySwaps,
      dailyStreak: 1,
      luck: defaultLuck(),
    },
    numbers: [],
    ledger: [],
    selectedTariff: 'standard',
    selectedCountry: null,
    selectedOperator: null,
    selectedCode: null,
    processedReleaseIds: [],
    claimedAchievements: [],
    usedPromoCodes: [],
    slots: ECONOMY.slots,
  };
}

export function defaultLuck(): LuckState {
  const expires = new Date();
  expires.setHours(24, 0, 0, 0);
  return {
    ...LUCK.defaultState,
    expiresAt: expires.toISOString(),
  };
}

/* ─────────────────────────── ЦЕНЫ ДЛЯ ВИТРИНЫ ─────────────────────────── */

export function numberValueLabel(number: PhoneNumber): string {
  return formatMoneyWithSign(number.finalPrice);
}

export function randomCountryId(rng: Rng = makeRng(Date.now())): string {
  return COUNTRIES[randomInt(rng, 0, COUNTRIES.length - 1)].id;
}

export function countryOf(number: PhoneNumber) {
  return COUNTRY_BY_ID[number.countryId];
}
