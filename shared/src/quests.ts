// language: TypeScript, file: shared/src/quests.ts
// Достижения и ежедневные задания. Все условия считаются из фактического
// состояния игрока — ни одно не выдаётся «на слово» клиенту.

import { RARITY_ORDER, formatMoney } from './config';
import type { GameState, RarityId } from './types';

export interface Achievement {
  id: string;
  title: string;
  hint: string;
  /** Сколько нужно набрать */
  target: number;
  /** Текущий прогресс игрока */
  progress: (state: GameState) => number;
  /** Награда за закрытие, в игровой валюте */
  reward: number;
}

const countRarity = (state: GameState, rarity: RarityId): number =>
  state.numbers.filter((number) => number.rarity === rarity).length;

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_sim',
    title: 'Первая симка',
    hint: 'Выпустить первую SIM',
    target: 1,
    progress: (state) => Math.min(1, state.numbers.length),
    reward: 300,
  },
  {
    id: 'ten_sim',
    title: 'Разогрев',
    hint: 'Собрать 10 номеров',
    target: 10,
    progress: (state) => state.numbers.length,
    reward: 1500,
  },
  {
    id: 'fifty_sim',
    title: 'Оператор',
    hint: 'Собрать 50 номеров',
    target: 50,
    progress: (state) => state.numbers.length,
    reward: 9000,
  },
  {
    id: 'first_rare',
    title: 'Редкая находка',
    hint: 'Получить редкий номер',
    target: 1,
    progress: (state) => countRarity(state, 'rare'),
    reward: 2500,
  },
  {
    id: 'first_epic',
    title: 'Эпический улов',
    hint: 'Получить эпический номер',
    target: 1,
    progress: (state) => countRarity(state, 'epic'),
    reward: 12000,
  },
  {
    id: 'first_legendary',
    title: 'Легенда',
    hint: 'Получить легендарный номер',
    target: 1,
    progress: (state) => countRarity(state, 'legendary'),
    reward: 80000,
  },
  {
    id: 'first_mythic',
    title: 'Миф',
    hint: 'Получить мифический номер',
    target: 1,
    progress: (state) => countRarity(state, 'mythic'),
    reward: 500000,
  },
  {
    id: 'beauty_100',
    title: 'Красивый узор',
    hint: 'Найти номер с 100 очками узора',
    target: 100,
    progress: (state) =>
      state.numbers.reduce((best, number) => Math.max(best, number.score), 0),
    reward: 8000,
  },
  {
    id: 'level_5',
    title: 'Пятый уровень',
    hint: 'Достичь 5 уровня',
    target: 5,
    progress: (state) => state.player.level,
    reward: 4000,
  },
  {
    id: 'portfolio',
    title: 'Миллион в цифрах',
    hint: 'Собрать коллекцию дороже 1 000 000 ₽',
    target: 1_000_000,
    progress: (state) =>
      state.numbers.reduce((sum, number) => sum + number.finalPrice, 0),
    reward: 50000,
  },
];

export function achievementProgress(achievement: Achievement, state: GameState): number {
  return Math.min(1, achievement.progress(state) / achievement.target);
}

export function isUnlocked(achievement: Achievement, state: GameState): boolean {
  return achievement.progress(state) >= achievement.target;
}

/** Заголовок прогресса: «3 из 10» или сумма с разделителями для крупных целей. */
export function progressLabel(achievement: Achievement, state: GameState): string {
  const current = achievement.progress(state);
  if (achievement.target >= 1000) {
    return `${formatMoney(current)} / ${formatMoney(achievement.target)} ₽`;
  }
  return `${current} из ${achievement.target}`;
}

/* ─────────────────────────── ЕЖЕДНЕВНАЯ НАГРАДА ─────────────────────────── */

export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Когда игрок последний раз забирал награду дня. */
export function lastDailyAt(state: GameState): number {
  const entry = state.ledger.find((item) => item.kind === 'daily');
  return entry ? new Date(entry.at).getTime() : 0;
}

export function dailyAvailable(state: GameState, now = Date.now()): boolean {
  return now - lastDailyAt(state) >= DAILY_COOLDOWN_MS;
}

/**
 * Награда дня.
 *
 * Растёт с серией, но с потолком: без него седьмой день приносил больше, чем
 * стоит сам выпуск, и серия обесценивала игру. На каждом седьмом дне вместо
 * прибавки выдаётся билет — он полезнее денег, потому что открывает «Элит».
 */
export const DAILY_BASE = 600;
export const DAILY_STEP = 120;
export const DAILY_CAP = 1200;

export function dailyReward(state: GameState): number {
  const streak = Math.max(0, state.player.dailyStreak);
  return Math.min(DAILY_BASE + streak * DAILY_STEP, DAILY_CAP);
}

/** Каждый седьмой день серии даёт билет. */
export function dailyTicket(streakAfter: number): number {
  return streakAfter > 0 && streakAfter % 7 === 0 ? 1 : 0;
}

/** Сколько номеров каждой категории собрано — для экрана достижений. */
export function rarityBreakdown(state: GameState): Record<RarityId, number> {
  const counters = Object.fromEntries(
    RARITY_ORDER.map((rarity) => [rarity, 0]),
  ) as Record<RarityId, number>;
  for (const number of state.numbers) counters[number.rarity] += 1;
  return counters;
}
