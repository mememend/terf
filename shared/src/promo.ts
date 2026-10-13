// language: TypeScript, file: shared/src/promo.ts
// Промокоды.
//
// Код можно погасить один раз на игрока. Срок и общий тираж проверяются здесь
// же: клиент не решает, действует код или нет — он только показывает ответ.

import type { GameState, LedgerEntry, Player } from './types';

export type PromoReward =
  | { kind: 'money'; amount: number }
  | { kind: 'tickets'; count: number }
  | { kind: 'releases'; count: number }
  | { kind: 'luck'; multiplier: number; spins: number };

export interface PromoCode {
  /** Код без учёта регистра и пробелов */
  code: string;
  title: string;
  note: string;
  reward: PromoReward;
  /** Сколько раз код можно погасить всего; null — без ограничения */
  limit: number | null;
  /** Последний день действия включительно, в формате ГГГГ-ММ-ДД; null — бессрочно */
  until: string | null;
  /** Создан через админку, а не зашит в игру */
  custom?: boolean;
}

/**
 * Действующие коды.
 *
 * Коды короткие и говорящие: их диктуют в чате и набирают руками, поэтому
 * никаких случайных наборов букв.
 */
export const PROMO_CODES: PromoCode[] = [
  {
    code: 'ЦИФЕРКИ',
    title: 'Приветственный',
    note: 'Стартовый подарок: деньги и билет',
    reward: { kind: 'tickets', count: 1 },
    limit: null,
    until: null,
  },
  {
    code: 'ПЕРВЫЙ',
    title: 'Первый выпуск',
    note: 'Один бесплатный выпуск',
    reward: { kind: 'releases', count: 1 },
    limit: 5000,
    until: null,
  },
  {
    code: 'УДАЧА',
    title: 'Полоса везения',
    note: 'Удача ×3 на пять круток',
    reward: { kind: 'luck', multiplier: 3, spins: 5 },
    limit: 2000,
    until: null,
  },
  {
    code: 'ЩЕДРОСТЬ',
    title: 'Щедрый вечер',
    note: '25 000 ₽ на баланс',
    reward: { kind: 'money', amount: 25000 },
    limit: 500,
    until: null,
  },
];

/** Приводим ввод к виду кода: без пробелов, в верхнем регистре. */
export function normalizePromo(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function findPromo(input: string, codes: PromoCode[] = PROMO_CODES): PromoCode | null {
  const code = normalizePromo(input);
  return codes.find((item) => normalizePromo(item.code) === code) ?? null;
}

/**
 * Проверка кода при создании в админке.
 *
 * Коды латиницей и без обязательных заглавных: их набирают с телефона, и
 * заставлять человека переключать регистр незачем — сравнение всё равно
 * идёт без учёта регистра.
 */
export function validatePromoCode(code: string): string | null {
  const clean = normalizePromo(code);
  if (clean.length < 3) return 'Код короче трёх символов';
  if (clean.length > 24) return 'Код длиннее 24 символов';
  if (!/^[A-Z0-9_-]+$/.test(clean)) return 'Только латинские буквы, цифры, дефис и подчёркивание';
  return null;
}

export type PromoError =
  | 'empty'
  | 'not_found'
  | 'already'
  | 'expired'
  | 'exhausted';

export interface PromoResult {
  ok: boolean;
  state: GameState;
  promo: PromoCode | null;
  /** Что начислено — для строки «получено» */
  gained: string;
  error?: PromoError;
}

/** Описание награды словами: показывается игроку после погашения. */
export function promoRewardText(promo: PromoCode): string {
  const reward = promo.reward;
  switch (reward.kind) {
    case 'money':
      return `${reward.amount.toLocaleString('ru-RU')} ₽ на баланс`;
    case 'tickets':
      return `${reward.count} билет${reward.count === 1 ? '' : 'а'} «Элит»`;
    case 'releases':
      return `${reward.count} бесплатн${reward.count === 1 ? 'ый выпуск' : 'ых выпуска'}`;
    default:
      return `удача ×${reward.multiplier} на ${reward.spins} круток`;
  }
}

/**
 * Погасить промокод.
 *
 * `usedTotal` — сколько раз код уже погасили во всей игре. Считает сервер,
 * потому что общий тираж от одного игрока не зависит.
 */
export function redeemPromo(
  state: GameState,
  input: string,
  usedTotal = 0,
  today = new Date(),
  codes: PromoCode[] = PROMO_CODES,
): PromoResult {
  const raw = normalizePromo(input);
  if (raw.length === 0) {
    return { ok: false, state, promo: null, gained: '', error: 'empty' };
  }

  const promo = findPromo(raw, codes);
  if (!promo) {
    return { ok: false, state, promo: null, gained: '', error: 'not_found' };
  }

  if (state.usedPromoCodes.includes(raw)) {
    return { ok: false, state, promo, gained: '', error: 'already' };
  }

  if (promo.until) {
    // Сравниваем по календарным дням: код действует весь последний день.
    const limit = new Date(`${promo.until}T23:59:59`);
    if (today.getTime() > limit.getTime()) {
      return { ok: false, state, promo, gained: '', error: 'expired' };
    }
  }

  if (promo.limit !== null && usedTotal >= promo.limit) {
    return { ok: false, state, promo, gained: '', error: 'exhausted' };
  }

  const player: Player = { ...state.player };
  const reward = promo.reward;

  if (reward.kind === 'money') {
    player.balance += reward.amount;
  } else if (reward.kind === 'tickets') {
    player.tickets += reward.count;
  } else if (reward.kind === 'releases') {
    player.freeReleases += reward.count;
  } else {
    // Сильный бонус заменяет прежний, слабый — только добавляет крутки.
    const current = player.luck.multiplier;
    player.luck =
      reward.multiplier > current || player.luck.spinsLeft === 0
        ? {
            multiplier: reward.multiplier,
            expiresAt: player.luck.expiresAt,
            spinsLeft: reward.spins,
            title: `Промокод · Удача ×${reward.multiplier}`,
            subtitle: `Действует ещё ${reward.spins} круток`,
          }
        : { ...player.luck, spinsLeft: player.luck.spinsLeft + reward.spins };
  }

  const entry: LedgerEntry = {
    id: `ledger_promo_${state.ledger.length}_${raw}`,
    kind: 'promo',
    amount: reward.kind === 'money' ? reward.amount : 0,
    label: `Промокод ${promo.code} · ${promoRewardText(promo)}`,
    at: new Date().toISOString(),
  };

  return {
    ok: true,
    promo,
    gained: promoRewardText(promo),
    state: {
      ...state,
      player,
      usedPromoCodes: [...state.usedPromoCodes, raw].slice(-200),
      ledger: [entry, ...state.ledger].slice(0, 500),
    },
  };
}
