// language: TypeScript, file: backend/src/services/game-service.ts
// Серверная игровая логика. Здесь и только здесь считаются результаты выпуска,
// цены, опыт и продажи. Клиент присылает намерение, а не результат.
//
// Используется то же ядро @ciferki/shared, что и на клиенте, поэтому витрина
// «Шансы» и фактические выпадения не могут разойтись.

import {
  ACHIEVEMENTS,
  COUNTRIES,
  RARITIES,
  TARIFFS,
  applyUpgrade,
  brandedOperators,
  changeDigit,
  claimAchievement,
  claimBailout,
  claimDaily,
  claimTask,
  createId,
  dailyAvailable,
  dailyReward,
  distributionFor,
  PROMO_CODES,
  findPromo,
  normalizePromo,
  promoRewardText,
  validatePromoCode,
  redeemPromo,
  forecastDigitChange,
  progressLabel,
  rarePlusShare,
  release,
  sellNumber,
  sellMany,
  setPrimaryNumber,
  spinRoulette,
  tariffCost,
  upgradeOffers,
} from '@ciferki/shared';
import type {
  GameState,
  PhoneNumber,
  PromoCode,
  RarityId,
  TariffId,
  UpgradeId,
} from '@ciferki/shared';
import type { Repository } from '../repository/types.ts';

export type ReleaseError = 'insufficient_funds' | 'no_tickets' | 'duplicate' | 'slots_full';
export type NumberError = 'not_found' | 'locked' | 'insufficient_funds' | 'bad_index';

export interface SelectResult {
  ok: boolean;
  error?: 'bad_tariff' | 'bad_country';
}

export interface ReleaseResponse {
  ok: boolean;
  number?: PhoneNumber;
  error?: ReleaseError;
  balance: number;
  /** Текущее распределение категорий с учётом удачи — для честного показа шансов. */
  odds: Record<RarityId, number>;
}

export class GameService {
  constructor(private readonly repo: Repository) {}

  async getState(playerId: number): Promise<GameState> {
    return this.repo.loadState(playerId);
  }

  /** Состояние для расчётов внутри сервиса. */
  async load(playerId: number): Promise<GameState> {
    return this.repo.loadState(playerId);
  }

  /**
   * Награда за задание дня или недели. Прогресс считается по датам выпусков
   * и записям истории, поэтому отдельные счётчики не нужны.
   */
  async claimTask(playerId: number, key: string) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimTask(state, key);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          amount: result.amount,
          balance: result.state.player.balance,
        },
      };
    });
    return outcome.value;
  }

  /** Распределение категорий для витрины. Считается тем же кодом, что и выпадение. */
  chances(tariffId: TariffId, luck: number) {
    const odds = distributionFor(tariffId, luck);
    return {
      tariffId,
      luck,
      odds,
      rareAndAbove: rarePlusShare(tariffId, luck),
      categories: (Object.keys(RARITIES) as RarityId[]).map((rarity) => ({
        id: rarity,
        name: RARITIES[rarity].name,
        color: RARITIES[rarity].color,
        basePrice: RARITIES[rarity].basePrice,
        percent: odds[rarity],
      })),
    };
  }

  /**
   * Выпуск SIM. Двойная защита от повторного списания:
   * 1) предварительная проверка release_id в таблице выпусков;
   * 2) проверка processedReleaseIds внутри самого движка, уже под блокировкой строки.
   */
  async release(
    playerId: number,
    input: { tariffId?: TariffId; countryId?: string | null; releaseId?: string },
  ): Promise<ReleaseResponse> {
    const releaseId = input.releaseId && input.releaseId.length <= 64
      ? input.releaseId
      : createId('rel');

    if (await this.repo.releaseExists(releaseId)) {
      const state = await this.repo.loadState(playerId);
      return {
        ok: false,
        error: 'duplicate',
        balance: state.player.balance,
        odds: distributionFor(state.selectedTariff, 1),
      };
    }

    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = release(state, {
        tariffId: input.tariffId,
        countryId: input.countryId,
        releaseId,
      });
      return {
        state: result.state,
        value: {
          ok: result.ok,
          number: result.number ?? undefined,
          error: result.error as ReleaseError | undefined,
        },
      };
    });

    return {
      ...outcome.value,
      balance: outcome.state.player.balance,
      odds: distributionFor(outcome.state.selectedTariff, 1),
    };
  }

  async sell(playerId: number, numberId: string) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = sellNumber(state, numberId);
      return {
        state: result.state,
        value: { ok: result.ok, error: result.error as NumberError | undefined },
      };
    });
    return outcome.value;
  }

  /**
   * Погасить промокод.
   *
   * Общий тираж берём из хранилища: он считается по всем игрокам, а не по
   * одному. Засчитываем погашение только после успешной выдачи награды.
   */
  async redeemPromo(playerId: number, code: string) {
    // Свои коды из админки ищутся наравне с зашитыми в игру.
    const custom = await this.repo.promoList();
    const all = [...PROMO_CODES, ...custom];

    const promo = findPromo(code, all);
    if (!promo) {
      return { ok: false, error: 'not_found' as const, gained: '' };
    }

    const usedTotal = await this.repo.promoUses(normalizePromo(promo.code));

    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = redeemPromo(state, code, usedTotal, new Date(), all);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          gained: result.gained,
          title: result.promo?.title ?? null,
          note: result.promo?.note ?? null,
          balance: result.state.player.balance,
        },
      };
    });

    if (outcome.value.ok) {
      await this.repo.addPromoUse(normalizePromo(promo.code));
    }
    return outcome.value;
  }

  /* ─────────────────────────── ПРОМОКОДЫ: АДМИНКА ─────────────────────────── */

  /** Список кодов: зашитые в игру и созданные в админке. */
  async listPromos() {
    const custom = await this.repo.promoList();
    const usedMap = new Map<string, number>();
    for (const promo of [...PROMO_CODES, ...custom]) {
      const key = normalizePromo(promo.code);
      usedMap.set(key, await this.repo.promoUses(key));
    }

    const describe = (promo: (typeof PROMO_CODES)[number]) => ({
      code: promo.code,
      title: promo.title,
      note: promo.note,
      kind: promo.reward.kind,
      reward: promoRewardText(promo),
      limit: promo.limit,
      until: promo.until,
      custom: promo.custom === true,
      used: usedMap.get(normalizePromo(promo.code)) ?? 0,
    });

    return {
      builtin: PROMO_CODES.map(describe),
      custom: custom.map(describe),
    };
  }

  /** Создать промокод. Код латиницей, регистр не важен. */
  async createPromo(input: {
    code: string;
    title: string;
    note: string;
    kind: string;
    amount: number;
    limit: number | null;
    until: string | null;
  }) {
    const problem = validatePromoCode(input.code);
    if (problem) return { ok: false, error: problem };

    const code = normalizePromo(input.code);
    const all = [...PROMO_CODES, ...(await this.repo.promoList())];
    if (all.some((promo) => normalizePromo(promo.code) === code)) {
      return { ok: false, error: 'Такой код уже есть' };
    }

    const amount = Math.max(1, Math.floor(input.amount || 1));
    const reward: PromoCode['reward'] =
      input.kind === 'money'
        ? { kind: 'money', amount }
        : input.kind === 'tickets'
          ? { kind: 'tickets', count: amount }
          : input.kind === 'releases'
            ? { kind: 'releases', count: amount }
            : { kind: 'luck', multiplier: amount, spins: 3 };

    const promo: PromoCode = {
      code,
      title: input.title.trim() || code,
      note: input.note.trim(),
      reward,
      limit: input.limit === null || input.limit <= 0 ? null : Math.floor(input.limit),
      until: input.until,
      custom: true,
    };

    await this.repo.createPromo(promo);
    await this.repo.recordAudit(null, 'promo.create', promo);
    return { ok: true, promo: { ...promo, reward: promoRewardText(promo) } };
  }

  /** Удалить свой промокод. Зашитые в игру удалить нельзя. */
  async deletePromo(code: string) {
    const removed = await this.repo.deletePromo(code);
    if (removed) await this.repo.recordAudit(null, 'promo.delete', { code });
    return {
      ok: removed,
      error: removed ? undefined : 'Код не найден или он зашит в игру',
    };
  }

  /** Прокрут рулетки: приз выбирается по весам из общего ядра. */
  async spinRoulette(playerId: number, wheelId: string | null, releaseId?: string) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = spinRoulette(state, { wheelId, releaseId });
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          wheelId: result.wheelId,
          index: result.index,
          spent: result.spent,
          gained: result.gained,
          prize: result.prize
            ? {
                id: result.prize.id,
                kind: result.prize.kind,
                label: result.prize.label,
                title: result.prize.title,
                chance: result.prize.chance,
                color: result.prize.color,
                // Поля эффекта тоже отдаём: без них клиенту нечего показать,
                // и в подписи печаталось «удача ×undefined».
                amount: result.prize.amount ?? null,
                releases: result.prize.releases ?? null,
                multiplier: result.prize.multiplier ?? null,
                spins: result.prize.spins ?? null,
              }
            : null,
          balance: result.state.player.balance,
          freeReleases: result.state.player.freeReleases,
          luck: result.state.player.luck,
        },
      };
    });
    return outcome.value;
  }

  /** Продажа пачки: коллекция чистится за один заход. */
  async sellBatch(playerId: number, ids: string[]) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = sellMany(state, ids);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          sold: result.sold,
          total: result.total,
          skipped: result.skipped,
        },
      };
    });
    return outcome.value;
  }

  async makePrimary(playerId: number, numberId: string) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = setPrimaryNumber(state, numberId);
      return {
        state: result.state,
        value: { ok: result.ok, error: result.error as NumberError | undefined },
      };
    });
    return outcome.value;
  }

  async changeDigit(playerId: number, numberId: string, index: number) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = changeDigit(state, numberId, index);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error as NumberError | undefined,
          number: result.number ?? undefined,
        },
      };
    });
    return outcome.value;
  }

  /**
   * Награда за достижение. Условие проверяется по состоянию игрока: закрытое
   * достижение нельзя получить дважды, незакрытое — вообще.
   */
  async claimAchievement(playerId: number, achievementId: string) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimAchievement(state, achievementId);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          amount: result.amount,
          balance: result.state.player.balance,
        },
      };
    });
    return outcome.value;
  }

  /** Сводка по заданиям: что закрыто, что можно забрать, что уже забрано. */
  async quests(playerId: number) {
    const state = await this.repo.loadState(playerId);
    return {
      ok: true as const,
      balance: state.player.balance,
      dailyAvailable: dailyAvailable(state),
      dailyReward: dailyReward(state),
      streak: state.player.dailyStreak,
      achievements: ACHIEVEMENTS.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        hint: achievement.hint,
        target: achievement.target,
        reward: achievement.reward,
        progress: Math.min(achievement.progress(state), achievement.target),
        unlocked: achievement.progress(state) >= achievement.target,
        claimed: state.claimedAchievements.includes(achievement.id),
        label: progressLabel(achievement, state),
      })),
    };
  }

  async claimDaily(playerId: number) {    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimDaily(state);
      return {
        state: result.state,
        value: { ok: result.ok, amount: result.amount, streak: result.state.player.dailyStreak },
      };
    });
    return outcome.value;
  }

  async claimBailout(playerId: number) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimBailout(state);
      return {
        state: result.state,
        value: { ok: result.ok, balance: result.state.player.balance },
      };
    });
    return outcome.value;
  }

  /** Выбор тарифа и региона. Валюту не списывает — только сохраняет намерение. */
  async select(
    playerId: number,
    input: {
      tariffId?: TariffId;
      countryId?: string | null;
      operatorId?: string | null;
      code?: string | null;
    },
  ): Promise<SelectResult> {
    // Явный параметр типа: без него вывод из объединения даёт unknown.
    const outcome = await this.repo.mutate<SelectResult>(playerId, (state) => {
      const tariffId = input.tariffId ?? state.selectedTariff;
      if (!TARIFFS[tariffId]) {
        return { state, value: { ok: false, error: 'bad_tariff' as const } };
      }

      const countryId =
        input.countryId === undefined ? state.selectedCountry : input.countryId;
      if (countryId !== null && !COUNTRIES.some((country) => country.id === countryId)) {
        return { state, value: { ok: false, error: 'bad_country' as const } };
      }

      // Оператор выбирается только внутри конкретной страны: у каждой свои бренды.
      let operatorId =
        input.operatorId === undefined ? state.selectedOperator : input.operatorId;
      if (operatorId !== null) {
        if (countryId === null) {
          return { state, value: { ok: false, error: 'bad_country' as const } };
        }
        const pool = brandedOperators(countryId);
        if (!pool.some((operator) => operator.id === operatorId)) {
          // Сменили страну — прежний оператор к ней не относится, сбрасываем.
          operatorId = null;
        }
      }

      // Код обязан принадлежать выбранному оператору.
      let code = input.code === undefined ? state.selectedCode : input.code;
      if (code !== null) {
        const operator = operatorId
          ? brandedOperators(countryId ?? '').find((item) => item.id === operatorId)
          : undefined;
        if (!operator || !operator.codes.includes(code)) code = null;
      }
      if (operatorId === null) code = null;

      return {
        state: {
          ...state,
          selectedTariff: tariffId,
          selectedCountry: countryId,
          selectedOperator: operatorId,
          selectedCode: code,
        },
        value: {
          ok: true as const,
          // Возвращаем то, что реально записали: клиент применит это у себя,
          // и надпись сверху не разойдётся с состоянием на сервере.
          selection: {
            tariffId,
            countryId,
            operatorId,
            code,
          },
        },
      };
    });
    return outcome.value;
  }

  /** Прогноз замены цифры: считает сервер, клиент только показывает. */
  async forecast(playerId: number, numberId: string, index: number) {
    const state = await this.repo.loadState(playerId);
    const number = state.numbers.find((item) => item.id === numberId);
    if (!number) return { ok: false as const, error: 'not_found' as const };
    if (index < 0 || index >= number.digits.length) {
      return { ok: false as const, error: 'bad_index' as const };
    }
    return { ok: true as const, forecast: forecastDigitChange(number, index) };
  }

  /**
   * Витрина улучшений для конкретного номера: что можно сделать, сколько стоит
   * и хватает ли средств. Цены считает сервер — клиент их только показывает.
   */
  async upgrades(playerId: number, numberId: string) {
    const state = await this.repo.loadState(playerId);
    const number = state.numbers.find((item) => item.id === numberId);
    if (!number) return { ok: false as const, error: 'not_found' as const };
    return {
      ok: true as const,
      balance: state.player.balance,
      number,
      offers: upgradeOffers(state, numberId),
    };
  }

  /** Применение улучшения. Списание и пересчёт — на сервере, под блокировкой игрока. */
  async upgrade(
    playerId: number,
    input: {
      numberId: string;
      id: UpgradeId;
      index?: number;
      a?: number;
      b?: number;
      operatorId?: string;
    },
  ) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = applyUpgrade(state, input.numberId, input.id, {
        index: input.index,
        a: input.a,
        b: input.b,
        operatorId: input.operatorId,
      });
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          number: result.number ?? undefined,
          balance: result.state.player.balance,
        },
      };
    });
    return outcome.value;
  }

  /** Сводка по коллекции: используется профилем и админ-статистикой. */
  describe(state: GameState) {
    const byRarity: Record<string, number> = {};
    let value = 0;
    for (const number of state.numbers) {
      byRarity[number.rarity] = (byRarity[number.rarity] ?? 0) + 1;
      value += number.finalPrice;
    }
    return {
      count: state.numbers.length,
      slots: state.slots,
      portfolioValue: value,
      byRarity,
      cost: tariffCost(state.selectedTariff),
    };
  }
}
