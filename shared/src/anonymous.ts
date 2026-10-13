// language: TypeScript, file: shared/src/anonymous.ts
// Анонимные номера +888.
//
// Это отдельный класс номеров: без страны и без оператора, поэтому и попадают
// они в коллекцию не выпуском, а выдачей — администратор даёт их себе для
// проверки витрины, коллекции и карточки номера.
//
// Категория тянется по лучшему распределению игры (тариф «Элит»): анонимный
// номер по смыслу редкость, а не расходник. Цена при этом случайная — её
// считает генератор по коэффициенту из ANONYMOUS.

import { ANONYMOUS, RARITIES, TARIFFS } from './config';
import { issueNumber } from './generator';
import { createId, makeRng, seedFromString } from './rng';
import type { GameState, PhoneNumber, RarityId } from './types';

export interface AnonymousIssue {
  ok: boolean;
  state: GameState;
  numbers: PhoneNumber[];
  error?: 'slots_full' | 'bad_count';
}

/** Сколько анонимных номеров можно выдать за раз — чтобы не забить коллекцию. */
export const ANONYMOUS_MAX_BATCH = 5;

/**
 * Категория анонимного номера. Берём шансы тарифа «Элит» напрямую, без удачи:
 * анонимный номер по смыслу редкость, а не расходник.
 */
function weightedRarity(rng: () => number): RarityId {
  const entries = Object.entries(TARIFFS.premium.odds) as [RarityId, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

/**
 * Выдать анонимные номера. Бесплатно: это инструмент проверки, а не покупка.
 * Каждая выдача попадает в историю отдельной строкой, чтобы было видно, откуда
 * в коллекции взялись номера, которых игрок не выпускал.
 */
export function issueAnonymous(
  state: GameState,
  count: number,
  seed: string = createId('anon'),
): AnonymousIssue {
  const safeCount = Math.floor(count);
  if (!Number.isFinite(safeCount) || safeCount < 1 || safeCount > ANONYMOUS_MAX_BATCH) {
    return { ok: false, state, numbers: [], error: 'bad_count' };
  }
  const free = state.slots - state.numbers.length;
  if (free < safeCount) {
    return { ok: false, state, numbers: [], error: 'slots_full' };
  }

  const rng = makeRng(seedFromString(seed));
  const numbers: PhoneNumber[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const releaseId = `${seed}_${index}`;
    numbers.push(
      issueNumber({
        countryId: ANONYMOUS.id,
        tariffId: 'premium',
        rarity: weightedRarity(rng),
        releaseId,
        rng,
      }),
    );
  }

  const entries = numbers.map((number, index) => ({
    id: `${seed}_ledger_${index}`,
    kind: 'gift' as const,
    amount: 0,
    label: `Анонимный номер ${number.display} · ${RARITIES[number.rarity].name}`,
    numberId: number.id,
    at: new Date(Date.now() + index).toISOString(),
  }));

  return {
    ok: true,
    numbers,
    state: {
      ...state,
      numbers: [...numbers, ...state.numbers],
      processedReleaseIds: [
        ...new Set([...state.processedReleaseIds, ...numbers.map((number) => number.releaseId)]),
      ].slice(-300),
      ledger: [...entries.reverse(), ...state.ledger].slice(0, 500),
    },
  };
}

/** Сколько анонимных номеров уже в коллекции. */
export function anonymousCount(state: GameState): number {
  return state.numbers.filter((number) => number.countryId === ANONYMOUS.id).length;
}

/** Подпись тарифа для анонимного номера — в карточке он не продаётся. */
export const ANONYMOUS_TARIFF_LABEL = TARIFFS.premium.name;
