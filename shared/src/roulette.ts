// language: TypeScript, file: shared/src/roulette.ts
// Рулетка.
//
// Колёс несколько, у каждого свой набор призов, цена и оформление. Шансы заданы
// здесь и здесь же применяются — экран «Призы и шансы» показывает ровно те
// числа, по которым крутится выбранное колесо.
//
// Экономика всех колёс намеренно невыгодная: средний приз дешевле попытки
// примерно на четверть. Это сток для денег — иначе баланс копится мёртвым
// грузом, когда все тарифы уже открыты. Насколько именно невыгодно —
// проверяется тестом по каждому колесу.

import { createId, makeRng } from './rng';
import type { GameState, LedgerEntry, Player } from './types';

export type RouletteWheelId = 'standard' | 'generous' | 'elite';

export type PrizeKind =
  /** Деньги на баланс */
  | 'money'
  /** Бесплатные выпуски */
  | 'tickets'
  /** Удача на несколько круток */
  | 'luck'
  /** Возврат части или всей ставки */
  | 'refund';

export interface RoulettePrize {
  id: string;
  kind: PrizeKind;
  /** Короткая подпись для сектора колеса */
  label: string;
  /** Полное название для таблицы шансов */
  title: string;
  /** Шанс в процентах; сумма по всем призам колеса — ровно 100 */
  chance: number;
  color: string;
  amount?: number;
  releases?: number;
  multiplier?: number;
  spins?: number;
}

export interface RouletteWheel {
  id: RouletteWheelId;
  name: string;
  tagline: string;
  /** Цена попытки */
  cost: number;
  /** Внешний обод: от светлого к тёмному */
  ring: [string, string];
  prizes: RoulettePrize[];
}

/**
 * Обычное колесо. Подписи короткие намеренно: сектор шириной 3 % — это узкая
 * полоска, и длинное слово в неё не влезает ни при каком шрифте.
 */
const STANDARD: RoulettePrize[] = [
  { id: 'cash1000', kind: 'money', label: '1К', title: '1 000 ₽', chance: 18, color: '#22C55E', amount: 1000 },
  { id: 'cash2500', kind: 'money', label: '2,5К', title: '2 500 ₽', chance: 16, color: '#3B82F6', amount: 2500 },
  { id: 'cash5000', kind: 'money', label: '5К', title: '5 000 ₽', chance: 14, color: '#8B5CF6', amount: 5000 },
  { id: 'cash10000', kind: 'money', label: '10К', title: '10 000 ₽', chance: 9, color: '#F59E0B', amount: 10000 },
  { id: 'cash25000', kind: 'money', label: '25К', title: '25 000 ₽', chance: 3, color: '#EAB308', amount: 25000 },
  { id: 'ticket1', kind: 'tickets', label: 'Билет', title: 'Билет «Стандарт»', chance: 13, color: '#14B8A6', releases: 1 },
  { id: 'ticket2', kind: 'tickets', label: '2 бил.', title: 'Два билета «Стандарт»', chance: 5, color: '#0EA5E9', releases: 2 },
  { id: 'ticketPlus', kind: 'tickets', label: 'Плюс', title: 'Билет «Плюс»', chance: 4, color: '#2563EB', releases: 4 },
  { id: 'luck2', kind: 'luck', label: '×2', title: 'Удача ×2 на 3 крутки', chance: 7, color: '#A855F7', multiplier: 2, spins: 3 },
  { id: 'luck3', kind: 'luck', label: '×3', title: 'Удача ×3 на крутку', chance: 3, color: '#EC4899', multiplier: 3, spins: 1 },
  { id: 'discount', kind: 'refund', label: '−25 %', title: 'Скидка 25 % на крутку', chance: 5, color: '#F97316', amount: 1250 },
  { id: 'respin', kind: 'refund', label: 'Ещё', title: 'Ещё одна попытка', chance: 3, color: '#EF4444', amount: 5000 },
];

/** Щедрое колесо: ставка впятеро выше, призы крупнее и удача сильнее. */
const GENEROUS: RoulettePrize[] = [
  { id: 'g5000', kind: 'money', label: '5К', title: '5 000 ₽', chance: 20, color: '#22C55E', amount: 5000 },
  { id: 'g10000', kind: 'money', label: '10К', title: '10 000 ₽', chance: 16, color: '#3B82F6', amount: 10000 },
  { id: 'g25000', kind: 'money', label: '25К', title: '25 000 ₽', chance: 12, color: '#8B5CF6', amount: 25000 },
  { id: 'g50000', kind: 'money', label: '50К', title: '50 000 ₽', chance: 8, color: '#F59E0B', amount: 50000 },
  { id: 'g150000', kind: 'money', label: '150К', title: '150 000 ₽', chance: 3, color: '#EAB308', amount: 150000 },
  { id: 'gPlus', kind: 'tickets', label: 'Плюс', title: 'Билет «Плюс»', chance: 11, color: '#14B8A6', releases: 4 },
  { id: 'gPlus2', kind: 'tickets', label: '2 Плюс', title: 'Два билета «Плюс»', chance: 5, color: '#0EA5E9', releases: 8 },
  { id: 'gElite', kind: 'tickets', label: 'Элит', title: 'Билет «Элит»', chance: 3, color: '#2563EB', releases: 20 },
  { id: 'gLuck3', kind: 'luck', label: '×3', title: 'Удача ×3 на 5 круток', chance: 8, color: '#A855F7', multiplier: 3, spins: 5 },
  { id: 'gLuck5', kind: 'luck', label: '×5', title: 'Удача ×5 на 2 крутки', chance: 4, color: '#EC4899', multiplier: 5, spins: 2 },
  { id: 'gDiscount', kind: 'refund', label: '−50 %', title: 'Скидка 50 % на крутку', chance: 6, color: '#F97316', amount: 12500 },
  { id: 'gRespin', kind: 'refund', label: 'Ещё', title: 'Ещё одна попытка', chance: 4, color: '#EF4444', amount: 25000 },
];

/** Элитное колесо: самые крупные суммы и билеты на «Элит». */
const ELITE: RoulettePrize[] = [
  { id: 'e25000', kind: 'money', label: '25К', title: '25 000 ₽', chance: 18, color: '#22C55E', amount: 25000 },
  { id: 'e50000', kind: 'money', label: '50К', title: '50 000 ₽', chance: 15, color: '#3B82F6', amount: 50000 },
  { id: 'e100000', kind: 'money', label: '100К', title: '100 000 ₽', chance: 12, color: '#8B5CF6', amount: 100000 },
  { id: 'e250000', kind: 'money', label: '250К', title: '250 000 ₽', chance: 7, color: '#F59E0B', amount: 250000 },
  { id: 'eMillion', kind: 'money', label: '1 млн', title: '1 000 000 ₽', chance: 2, color: '#EAB308', amount: 1000000 },
  { id: 'eElite', kind: 'tickets', label: 'Элит', title: 'Билет «Элит»', chance: 12, color: '#14B8A6', releases: 20 },
  { id: 'eElite3', kind: 'tickets', label: '3 Элит', title: 'Три билета «Элит»', chance: 4, color: '#0EA5E9', releases: 60 },
  { id: 'eFree5', kind: 'tickets', label: '5 бил.', title: 'Пять бесплатных выпусков', chance: 8, color: '#2563EB', releases: 5 },
  { id: 'eLuck5', kind: 'luck', label: '×5', title: 'Удача ×5 на 5 круток', chance: 8, color: '#A855F7', multiplier: 5, spins: 5 },
  { id: 'eLuck10', kind: 'luck', label: '×10', title: 'Удача ×10 на 3 крутки', chance: 4, color: '#EC4899', multiplier: 10, spins: 3 },
  { id: 'eDiscount', kind: 'refund', label: '−50 %', title: 'Скидка 50 % на крутку', chance: 6, color: '#F97316', amount: 50000 },
  { id: 'eRespin', kind: 'refund', label: 'Ещё', title: 'Ещё одна попытка', chance: 4, color: '#EF4444', amount: 100000 },
];

export const ROULETTE_WHEELS: RouletteWheel[] = [
  {
    id: 'standard',
    name: 'Обычное',
    tagline: 'Спокойное колесо: небольшие суммы и билеты на «Стандарт»',
    cost: 5000,
    ring: ['#F0B90B', '#7C4A03'],
    prizes: STANDARD,
  },
  {
    id: 'generous',
    name: 'Щедрое',
    tagline: 'Ставка больше, но и призы впятеро крупнее',
    cost: 25000,
    ring: ['#22D3EE', '#0E5C6B'],
    prizes: GENEROUS,
  },
  {
    id: 'elite',
    name: 'Элитное',
    tagline: 'Миллион в одном секторе и билеты на «Элит»',
    cost: 100000,
    ring: ['#A855F7', '#3B0764'],
    prizes: ELITE,
  },
];

export const DEFAULT_WHEEL_ID: RouletteWheelId = 'standard';

export function wheelById(id: string | null | undefined): RouletteWheel {
  return ROULETTE_WHEELS.find((wheel) => wheel.id === id) ?? ROULETTE_WHEELS[0];
}

/** Средний приз колеса: сколько в среднем возвращает одна попытка. */
export function wheelExpectedValue(wheel: RouletteWheel): number {
  return wheel.prizes.reduce((sum, prize) => {
    if (prize.kind === 'money' || prize.kind === 'refund') {
      return sum + ((prize.amount ?? 0) * prize.chance) / 100;
    }
    if (prize.kind === 'tickets') {
      // Билет считаем по цене выпуска, который он открывает.
      return sum + ((prize.releases ?? 0) * 1700 * prize.chance) / 100;
    }
    // Удачу в деньгах не считаем: она меняет шансы, а не баланс.
    return sum;
  }, 0);
}

export interface SpinResult {
  ok: boolean;
  state: GameState;
  wheelId: RouletteWheelId;
  prize: RoulettePrize | null;
  /** Номер сектора — по нему колесо доворачивается до нужного места */
  index: number;
  spent: number;
  /** Сколько вернулось деньгами: выигрыш или возврат части ставки */
  gained: number;
  error?: 'insufficient_funds' | 'duplicate' | 'bad_wheel';
}

/** Взвешенный выбор приза. Порядок обхода фиксирован — результат воспроизводим. */
function pickPrize(wheel: RouletteWheel, roll: number): { prize: RoulettePrize; index: number } {
  let cursor = 0;
  for (let index = 0; index < wheel.prizes.length; index += 1) {
    cursor += wheel.prizes[index].chance;
    if (roll <= cursor) return { prize: wheel.prizes[index], index };
  }
  const last = wheel.prizes.length - 1;
  return { prize: wheel.prizes[last], index: last };
}

/**
 * Крутить колесо.
 *
 * Ставка списывается всегда; приз применяется тут же. Идентификатор прокрута
 * защищает от повторов: повторная отправка того же запроса не спишет деньги
 * дважды и не выдаст второй приз. Колёса различаются только ставкой и набором
 * призов — механика одна, поэтому и код один.
 */
export function spinRoulette(
  state: GameState,
  options: { wheelId?: string | null; releaseId?: string } = {},
): SpinResult {
  const wheel = wheelById(options.wheelId);
  const releaseId = options.releaseId ?? createId('spin');

  if (state.processedReleaseIds.includes(releaseId)) {
    return {
      ok: false,
      state,
      wheelId: wheel.id,
      prize: null,
      index: -1,
      spent: 0,
      gained: 0,
      error: 'duplicate',
    };
  }
  if (state.player.balance < wheel.cost) {
    return {
      ok: false,
      state,
      wheelId: wheel.id,
      prize: null,
      index: -1,
      spent: 0,
      gained: 0,
      error: 'insufficient_funds',
    };
  }

  const rng = makeRng(seedFor(releaseId));
  const { prize, index } = pickPrize(wheel, rng() * 100);

  const player: Player = { ...state.player, balance: state.player.balance - wheel.cost };
  const entries: LedgerEntry[] = [
    ledgerEntry(state, {
      kind: 'roulette',
      amount: -wheel.cost,
      label: `Рулетка «${wheel.name}» · попытка`,
    }),
  ];

  let gained = 0;

  if (prize.kind === 'money' || prize.kind === 'refund') {
    gained = prize.amount ?? 0;
    player.balance += gained;
    entries.unshift(
      ledgerEntry(state, {
        kind: 'roulette',
        amount: gained,
        label: `Рулетка · ${prize.title}`,
      }),
    );
  } else if (prize.kind === 'tickets') {
    player.freeReleases += prize.releases ?? 0;
    entries.unshift(
      ledgerEntry(state, { kind: 'roulette', amount: 0, label: `Рулетка · ${prize.title}` }),
    );
  } else {
    // Удача: сильный приз заменяет бонус, слабый — только добавляет крутки.
    const current = activeLuckOf(state);
    const better =
      (prize.multiplier ?? 1) > current ||
      ((prize.multiplier ?? 1) === current && (prize.spins ?? 0) > state.player.luck.spinsLeft);

    player.luck = better
      ? {
          multiplier: prize.multiplier ?? 1,
          expiresAt: state.player.luck.expiresAt,
          spinsLeft: prize.spins ?? 0,
          title: `Рулетка · Удача ×${prize.multiplier}`,
          subtitle: `Действует ещё ${prize.spins} круток`,
        }
      : {
          ...state.player.luck,
          spinsLeft: state.player.luck.spinsLeft + (prize.spins ?? 0),
        };

    entries.unshift(
      ledgerEntry(state, { kind: 'roulette', amount: 0, label: `Рулетка · ${prize.title}` }),
    );
  }

  return {
    ok: true,
    wheelId: wheel.id,
    prize,
    index,
    spent: wheel.cost,
    gained,
    state: {
      ...state,
      player,
      processedReleaseIds: [...state.processedReleaseIds, releaseId].slice(-300),
      ledger: [...entries, ...state.ledger].slice(0, 500),
    },
  };
}

/* ─────────────────────────── МЕЛОЧИ ─────────────────────────── */

function seedFor(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function activeLuckOf(state: GameState): number {
  const { multiplier, expiresAt, spinsLeft } = state.player.luck;
  if (multiplier <= 1) return 1;
  if (spinsLeft > 0) return multiplier;
  if (!expiresAt) return 1;
  return new Date(expiresAt).getTime() > Date.now() ? multiplier : 1;
}

function ledgerEntry(
  state: GameState,
  entry: { kind: LedgerEntry['kind']; amount: number; label: string },
): LedgerEntry {
  return {
    id: `ledger_${state.ledger.length}_${entry.label}`,
    at: new Date().toISOString(),
    ...entry,
  };
}
