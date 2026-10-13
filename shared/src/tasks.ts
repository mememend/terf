// language: TypeScript, file: shared/src/tasks.ts
// Задания дня и недели.
//
// Прогресс считается по фактам, которые уже есть в состоянии: у номеров есть
// дата выпуска и тариф, у записей истории — дата и вид операции. Поэтому
// отдельные счётчики не нужны, а перезапуск сервера прогресс не сбрасывает.
//
// Идентификатор задания включает период («d:2026-10-10»), поэтому награду
// нельзя забрать дважды в одном периоде, а в новом она доступна снова.

import type { GameState, PhoneNumber, RarityId, TariffId } from './types';

export type TaskScope = 'daily' | 'weekly';

export interface TaskDefinition {
  /** Идентификатор без периода — с ним складывается полный ключ */
  id: string;
  title: string;
  target: number;
  /** Награда в игровых рублях */
  reward: number;
  scope: TaskScope;
  progress: (state: GameState, since: number) => number;
}

export interface Task {
  /** Полный идентификатор с периодом — именно его запоминает состояние */
  key: string;
  title: string;
  scope: TaskScope;
  target: number;
  reward: number;
  progress: number;
  ready: boolean;
  claimed: boolean;
}

/** Редкие и выше: то, что считается «хорошим» номером в заданиях. */
const GOOD: RarityId[] = ['rare', 'epic', 'legendary', 'mythic'];
const PAID_TARIFFS: TariffId[] = ['plus', 'premium', 'elite'];

/**
 * Номера, выпущенные с указанного момента.
 *
 * Анонимные +888 сюда не попадают: они не выпускаются, а выдаются, поэтому
 * закрывать задания на выпуск не должны — иначе награду можно получить ни за что.
 */
function issuedSince(state: GameState, since: number): PhoneNumber[] {
  return state.numbers.filter(
    (number) => number.countryId !== 'anon' && Date.parse(number.issuedAt) >= since,
  );
}

function salesSince(state: GameState, since: number): number {
  return state.ledger.filter(
    (entry) => entry.kind === 'sale' && Date.parse(entry.at) >= since,
  ).length;
}

export const DAILY_TASKS: TaskDefinition[] = [
  {
    id: 'release5',
    scope: 'daily',
    title: 'Выпусти 5 SIM',
    target: 5,
    reward: 900,
    progress: (state, since) => issuedSince(state, since).length,
  },
  {
    id: 'release_plus3',
    scope: 'daily',
    title: 'Выпусти 3 SIM на «Плюсе» или дороже',
    target: 3,
    reward: 1400,
    progress: (state, since) =>
      issuedSince(state, since).filter((number) => PAID_TARIFFS.includes(number.tariffId)).length,
  },
  {
    id: 'sell5',
    scope: 'daily',
    title: 'Продай 5 номеров',
    target: 5,
    reward: 700,
    progress: (state, since) => salesSince(state, since),
  },
];

export const WEEKLY_TASKS: TaskDefinition[] = [
  {
    id: 'release30',
    scope: 'weekly',
    title: 'Выпусти 30 SIM за неделю',
    target: 30,
    reward: 6000,
    progress: (state, since) => issuedSince(state, since).length,
  },
  {
    id: 'good5',
    scope: 'weekly',
    title: 'Получи 5 редких номеров или лучше',
    target: 5,
    reward: 8000,
    progress: (state, since) =>
      issuedSince(state, since).filter((number) => GOOD.includes(number.rarity)).length,
  },
  {
    id: 'sell15',
    scope: 'weekly',
    title: 'Продай 15 номеров',
    target: 15,
    reward: 5000,
    progress: (state, since) => salesSince(state, since),
  },
];

export const TASK_DEFINITIONS = [...DAILY_TASKS, ...WEEKLY_TASKS];

/** Полночь по местному времени — с неё начинается «сегодня». */
export function startOfDay(now: Date): number {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** Понедельник текущей недели, 00:00 — с него начинается «эта неделя». */
export function startOfWeek(now: Date): number {
  const copy = new Date(now);
  const day = (copy.getDay() + 6) % 7; // 0 — понедельник
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy.getTime();
}

/** Ключ периода: для дня — дата, для недели — номер недели по ISO. */
export function periodKey(scope: TaskScope, now: Date): string {
  if (scope === 'daily') {
    const date = new Date(startOfDay(now));
    return `d:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }
  const monday = new Date(startOfWeek(now));
  // ISO-неделя: четверг той же недели определяет год.
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - jan1.getTime()) / 86_400_000 / 7) + 1;
  return `w:${thursday.getFullYear()}-${String(week).padStart(2, '0')}`;
}

/** Сколько осталось до конца периода — для подписи «обновится через…». */
export function periodEndsAt(scope: TaskScope, now: Date): number {
  const start = scope === 'daily' ? startOfDay(now) : startOfWeek(now);
  const length = scope === 'daily' ? 86_400_000 : 7 * 86_400_000;
  return start + length;
}

/**
 * Задания вместе с прогрессом. Период берётся от переданного времени:
 * так одну и ту же функцию можно проверить на любой дате.
 */
export function tasksFor(state: GameState, now: Date = new Date()): Task[] {
  const periods: Record<TaskScope, { key: string; since: number }> = {
    daily: { key: periodKey('daily', now), since: startOfDay(now) },
    weekly: { key: periodKey('weekly', now), since: startOfWeek(now) },
  };

  return TASK_DEFINITIONS.map((definition) => {
    const period = periods[definition.scope];
    const key = `${period.key}:${definition.id}`;
    const raw = definition.progress(state, period.since);
    const progress = Math.min(raw, definition.target);
    return {
      key,
      title: definition.title,
      scope: definition.scope,
      target: definition.target,
      reward: definition.reward,
      progress,
      ready: progress >= definition.target,
      claimed: state.claimedAchievements.includes(key),
    };
  });
}

export interface TaskClaim {
  ok: boolean;
  state: GameState;
  amount: number;
  task: Task | null;
  error?: 'not_found' | 'locked' | 'already';
}

/**
 * Забрать награду за задание.
 *
 * Условие перепроверяется по состоянию: закрытое задание нельзя получить
 * дважды в одном периоде, а незакрытое — вообще.
 */
export function claimTask(
  state: GameState,
  key: string,
  now: Date = new Date(),
): TaskClaim {
  const task = tasksFor(state, now).find((item) => item.key === key);
  if (!task) return { ok: false, state, amount: 0, task: null, error: 'not_found' };
  if (task.claimed) return { ok: false, state, amount: 0, task, error: 'already' };
  if (!task.ready) return { ok: false, state, amount: 0, task, error: 'locked' };

  const entry = {
    id: `ledger_${key}_${state.ledger.length}`,
    kind: 'quest' as const,
    amount: task.reward,
    label: `Задание · ${task.title}`,
    at: new Date(now).toISOString(),
  };

  return {
    ok: true,
    amount: task.reward,
    task: { ...task, claimed: true },
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + task.reward },
      // Ключ с периодом: в новом периоде задание снова доступно.
      claimedAchievements: [...state.claimedAchievements, key].slice(-200),
      ledger: [entry, ...state.ledger].slice(0, 500),
    },
  };
}

/** Сколько заданий готово к получению — для счётчика на пункте меню. */
export function readyTasks(state: GameState, now: Date = new Date()): Task[] {
  return tasksFor(state, now).filter((task) => task.ready && !task.claimed);
}
