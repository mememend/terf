// language: TypeScript, file: frontend/src/hooks/useGame.ts
// Связка игрового ядра с React.
//
// Два режима работы:
//   server — состояние и результаты выпуска считает сервер (боевой режим);
//   local  — прототип на localStorage, когда сервера нет (демо и офлайн).
// Компоненты разницы не видят: наружу отдаётся один и тот же GameState.
//
// Действия считаются синхронно по актуальному состоянию из ref, а не внутри
// setState — иначе StrictMode продублировал бы выпуск и списание.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ECONOMY,
  RARITIES,
  TARIFFS,
  activeLuck,
  changeDigit,
  claimBailout,
  claimDaily,
  createId,
  forecastDigitChange,
  formatMoney,
  formatMoneyWithSign,
  release,
  sellNumber,
  sellMany,
  setPrimaryNumber,
  tariffCost,
  applyUpgrade,
  claimAchievement,
  claimTask,
} from '@ciferki/shared';
import type {
  DigitChangeForecast,
  GameState,
  PhoneNumber,
  RarityId,
  TariffId,
  UpgradeId,
} from '@ciferki/shared';
import { api, describeApiError } from '../api';
import { clearState, loadState, saveState } from '../storage';
import { displayName, hapticImpact, hapticNotify, telegramIdentity } from '../telegram';

export type ToastKind = 'info' | 'error';
export type GameMode = 'checking' | 'server' | 'local';

export interface Toast {
  id: string;
  text: string;
  kind: ToastKind;
}

const ERROR_TEXT: Record<string, string> = {
  insufficient_funds: 'Недостаточно средств на балансе',
  no_tickets: 'Нужен билет для тарифа Элит',
  duplicate: 'Эта операция уже выполнена',
  slots_full: 'Коллекция заполнена',
  not_found: 'Номер не найден',
  locked: 'Основной номер нельзя продать',
  already: 'Награда уже получена',
};

const REVEAL_DELAY_MS = 430;

/** Сила тактильного отклика по категории: обычный почти не чувствуется, мифический бьёт. */
function magnitudeOf(rarity: RarityId): 'light' | 'medium' | 'heavy' {
  switch (rarity) {
    case 'common':
      return 'light';
    case 'uncommon':
    case 'rare':
      return 'medium';
    default:
      return 'heavy';
  }
}

export function useGame() {
  const identity = useMemo(() => telegramIdentity(), []);
  const [mode, setMode] = useState<GameMode>('checking');
  const [isAdmin, setIsAdmin] = useState(false);
  const [state, setState] = useState<GameState>(() =>
    loadState({
      name: displayName(identity.user),
      avatarUrl: identity.user?.photo_url ?? null,
    }),
  );
  const [dropped, setDropped] = useState<PhoneNumber | null>(null);
  const [revealing, setRevealing] = useState(false);
  /** Категория готовящегося выпадения: по ней карточка дрожит сильнее, а рука чувствует толчок. */
  const [revealingRarity, setRevealingRarity] = useState<RarityId | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const stateRef = useRef(state);
  const busy = useRef(false);
  const modeRef = useRef<GameMode>('checking');

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = createId('toast');
    setToasts((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const apply = useCallback((next: GameState, persist = true) => {
    stateRef.current = next;
    setState(next);
    if (persist) saveState(next);
  }, []);

  const translateError = useCallback(
    (code?: string) => ERROR_TEXT[code ?? ''] ?? 'Операция не выполнена',
    [],
  );

  /* ─────────────────────────── ВЫБОР РЕЖИМА ─────────────────────────── */

  const refreshFromServer = useCallback(async () => {
    const response = await api.state();
    apply(response.state, false);
    // Право администратора определяет сервер. Клиент использует флаг только
    // для показа раздела — доступ всё равно проверяется на каждом запросе.
    setIsAdmin(response.isAdmin === true);
    return response.state;
  }, [apply]);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      // Сервер нужен только если есть чем подтвердить вход: подписью Telegram
      // или разрешённым отладочным пользователем.
      const canAuthenticate = Boolean(identity.initData) || Boolean(import.meta.env.VITE_DEV_USER);
      if (!canAuthenticate || !(await api.healthy())) {
        if (!cancelled) setMode('local');
        return;
      }
      try {
        const state_ = await api.state();
        if (cancelled) return;
        apply(state_.state, false);
        setIsAdmin(state_.isAdmin === true);
        modeRef.current = 'server';
        setMode('server');
      } catch {
        // Сервер ответил, но вход не подтверждён — играем локально.
        if (!cancelled) setMode('local');
      }
    };

    void probe();
    return () => {
      cancelled = true;
    };
  }, [apply, identity.initData]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    stateRef.current = state;
    // В серверном режиме источник истины — база, локальное сохранение не трогаем.
    if (mode !== 'server') saveState(state);
  }, [state, mode]);

  // Тик для таймера удачи и полосы удачи.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ─────────────────────────── ВЫПУСК ─────────────────────────── */

  const doRelease = useCallback(
    (overrides: { countryId?: string | null; tariffId?: TariffId } = {}) => {
      if (busy.current) return null;
      busy.current = true;
      setRevealing(true);

      const reveal = (number: PhoneNumber | null) => {
        if (number) {
          setRevealingRarity(number.rarity);
          // Тактильный отклик: сила толчка и тон зависят от категории.
          hapticImpact(magnitudeOf(number.rarity));
          if (number.rarity === 'legendary' || number.rarity === 'mythic') {
            hapticNotify('success');
          }
        }
        window.setTimeout(() => {
          setDropped(number);
          setRevealing(false);
          setRevealingRarity(null);
          busy.current = false;
        }, REVEAL_DELAY_MS);
      };

      if (modeRef.current === 'server') {
        void (async () => {
          try {
            const response = await api.release({
              tariffId: overrides.tariffId,
              countryId: overrides.countryId,
              releaseId: createId('rel'),
            });
            await refreshFromServer();
            reveal(response.number ?? null);
          } catch (error) {
            notify(describeApiError(error), 'error');
            reveal(null);
          }
        })();
        return null;
      }

      const result = release(stateRef.current, overrides);
      if (!result.ok || !result.number) {
        notify(translateError(result.error), 'error');
        setRevealing(false);
        busy.current = false;
        return null;
      }
      apply(result.state);
      reveal(result.number);
      return result.number;
    },
    [apply, notify, refreshFromServer, translateError],
  );

  /* ─────────────────────────── ВЫБОР ПАРАМЕТРОВ ─────────────────────────── */

  /**
   * Применяет выбор к состоянию.
   *
   * В боевом режиме записывает то, что вернул сервер: он мог сбросить оператора
   * (например, он принадлежит другой стране). Без этого надпись сверху
   * показывала бы оператора, которого на сервере уже нет.
   */
  const applySelection = useCallback(
    async (optimistic: Partial<GameState>, request: Parameters<typeof api.select>[0]) => {
      apply({ ...stateRef.current, ...optimistic }, modeRef.current !== 'server');
      if (modeRef.current !== 'server') return;
      try {
        const response = await api.select(request);
        if (response.selection) {
          apply({ ...stateRef.current, ...response.selection }, false);
        }
      } catch (error) {
        notify(describeApiError(error), 'error');
      }
    },
    [apply, notify],
  );

  const chooseTariff = useCallback(
    (tariffId: TariffId) => {
      void applySelection({ selectedTariff: tariffId }, { tariffId });
    },
    [applySelection],
  );

  const chooseCountry = useCallback(
    (countryId: string | null) => {
      // Смена страны сбрасывает оператора и код: они принадлежат прежней стране.
      void applySelection(
        { selectedCountry: countryId, selectedOperator: null, selectedCode: null },
        { countryId, operatorId: null, code: null },
      );
    },
    [applySelection],
  );

  /**
   * Выбор оператора. Код сбрасывается: у нового оператора свои коды,
   * и оставлять прежний значило бы обещать номер, которого не будет.
   */
  const chooseOperator = useCallback(
    (operatorId: string | null) => {
      void applySelection(
        { selectedOperator: operatorId, selectedCode: null },
        { operatorId, code: null },
      );
    },
    [applySelection],
  );

  /** Выбор конкретного кода внутри выбранного оператора. */
  const chooseCode = useCallback(
    (code: string | null) => {
      void applySelection({ selectedCode: code }, { code });
    },
    [applySelection],
  );

  /* ─────────────────────────── РАБОТА С НОМЕРОМ ─────────────────────────── */

  /** Общая обёртка для серверных операций: вызвать, обновить состояние, сказать. */
  const runServerAction = useCallback(
    async (action: () => Promise<unknown>, successText: string | null) => {
      try {
        await action();
        await refreshFromServer();
        if (successText) notify(successText);
      } catch (error) {
        notify(describeApiError(error), 'error');
      }
    },
    [notify, refreshFromServer],
  );

  const sell = useCallback(
    (numberId: string) => {
      const current = stateRef.current;
      const sold = current.numbers.find((item) => item.id === numberId);
      const successText = `Продан ${sold?.display ?? 'номер'} · +${formatMoneyWithSign(sold?.finalPrice ?? 0)}`;

      if (modeRef.current === 'server') {
        void runServerAction(() => api.sell(numberId), successText);
        return;
      }
      const result = sellNumber(current, numberId);
      if (!result.ok) {
        notify(translateError(result.error), 'error');
        return;
      }
      apply(result.state);
      notify(successText);
    },
    [apply, notify, runServerAction, translateError],
  );

  /**
   * Продать пачку номеров разом. Возвращает итог, чтобы коллекция показала,
   * сколько продано и сколько получено, а не просто «готово».
   */
  const sellBatch = useCallback(
    async (ids: string[]): Promise<{ sold: number; total: number; skipped: number }> => {
      if (modeRef.current === 'server') {
        try {
          const response = await api.sellBatch(ids);
          await refreshFromServer();
          return {
            sold: response.sold,
            total: response.total,
            skipped: response.skipped?.length ?? 0,
          };
        } catch (error) {
          notify(describeApiError(error), 'error');
          return { sold: 0, total: 0, skipped: 0 };
        }
      }

      const result = sellMany(stateRef.current, ids);
      if (!result.ok) {
        notify('Нечего продавать', 'error');
        return { sold: 0, total: 0, skipped: result.skipped.length };
      }
      apply(result.state);
      return { sold: result.sold, total: result.total, skipped: result.skipped.length };
    },
    [apply, notify, refreshFromServer],
  );

  const makePrimary = useCallback(
    (numberId: string) => {
      if (modeRef.current === 'server') {
        void runServerAction(() => api.makePrimary(numberId), 'Номер назначен основным');
        return;
      }
      const result = setPrimaryNumber(stateRef.current, numberId);
      if (!result.ok) {
        notify(translateError(result.error), 'error');
        return;
      }
      apply(result.state);
      notify('Номер назначен основным');
    },
    [apply, notify, runServerAction, translateError],
  );

  const replaceDigit = useCallback(
    (numberId: string, index: number) => {
      if (modeRef.current === 'server') {
        void runServerAction(
          () => api.changeDigit(numberId, index),
          `Цифра заменена · −${formatMoneyWithSign(ECONOMY.digitChangePrice)}`,
        );
        return null;
      }
      const result = changeDigit(stateRef.current, numberId, index);
      if (!result.ok) {
        notify(translateError(result.error), 'error');
        return null;
      }
      apply(result.state);
      notify(`Цифра заменена · −${formatMoneyWithSign(ECONOMY.digitChangePrice)}`);
      return result.number;
    },
    [apply, notify, runServerAction, translateError],
  );

  /**
   * Улучшение номера. Возвращает результат, а не просто «сделано»: мастерская
   * показывает игроку, что именно изменилось и сколько это стоило.
   */
  const upgradeNumber = useCallback(
    async (
      numberId: string,
      id: UpgradeId,
      params: { index?: number; a?: number; b?: number; operatorId?: string } = {},
    ): Promise<{ ok: boolean; number?: PhoneNumber; error?: string }> => {
      if (modeRef.current === 'server') {
        try {
          const response = await api.upgrade({ numberId, id, ...params });
          await refreshFromServer();
          return { ok: true, number: response.number };
        } catch (error) {
          notify(describeApiError(error), 'error');
          return { ok: false, error: describeApiError(error) };
        }
      }

      const result = applyUpgrade(stateRef.current, numberId, id, params);
      if (!result.ok || !result.number) {
        notify(translateError(result.error), 'error');
        return { ok: false, error: result.error };
      }
      apply(result.state);
      return { ok: true, number: result.number };
    },
    [apply, notify, refreshFromServer, translateError],
  );

  /** Награда за задание дня или недели. Условие проверяет сервер. */
  const collectTask = useCallback(
    async (key: string): Promise<number> => {
      if (modeRef.current === 'server') {
        try {
          const response = await api.claimTask(key);
          await refreshFromServer();
          notify(`Награда получена · +${formatMoney(response.amount)} ₽`);
          return response.amount;
        } catch (error) {
          notify(describeApiError(error), 'error');
          return 0;
        }
      }
      const result = claimTask(stateRef.current, key);
      if (!result.ok) {
        notify(translateError(result.error), 'error');
        return 0;
      }
      apply(result.state);
      notify(`Награда получена · +${formatMoney(result.amount)} ₽`);
      return result.amount;
    },
    [apply, notify, refreshFromServer, translateError],
  );

  /** Награда за достижение. Условие проверяется на сервере в боевом режиме. */
  const collectAchievement = useCallback(
    (achievementId: string) => {
      if (modeRef.current === 'server') {
        void runServerAction(() => api.claimAchievement(achievementId), null);
        return;
      }
      const result = claimAchievement(stateRef.current, achievementId);
      if (!result.ok) {
        notify(translateError(result.error), 'error');
        return;
      }
      apply(result.state);
      notify(`Награда получена · +${formatMoneyWithSign(result.amount)}`);
    },
    [apply, notify, runServerAction, translateError],
  );

  const takeDaily = useCallback(() => {    if (modeRef.current === 'server') {
      void runServerAction(() => api.daily(), null);
      return;
    }
    const result = claimDaily(stateRef.current);
    if (!result.ok) {
      notify('Награда дня уже получена — возвращайся завтра', 'error');
      return;
    }
    apply(result.state);
    notify(`Награда дня · +${formatMoneyWithSign(result.amount)}`);
  }, [apply, notify, runServerAction]);

  const takeBailout = useCallback(() => {
    if (modeRef.current === 'server') {
      void runServerAction(() => api.bailout(), null);
      return;
    }
    const result = claimBailout(stateRef.current);
    if (!result.ok) {
      notify('Бонус доступен при балансе ниже стоимости Стандарта', 'error');
      return;
    }
    apply(result.state);
    notify(`Бонус начислен · +${formatMoneyWithSign(ECONOMY.bailoutAmount)}`);
  }, [apply, notify, runServerAction]);

  const reset = useCallback(() => {
    if (modeRef.current === 'server') {
      notify('Прогресс хранится на сервере — сброс недоступен', 'error');
      return;
    }
    clearState();
    apply(
      loadState({
        name: displayName(identity.user),
        avatarUrl: identity.user?.photo_url ?? null,
      }),
    );
    setDropped(null);
    notify('Прогресс сброшен');
  }, [apply, identity.user, notify]);

  /* ─────────────────────────── ПРОИЗВОДНЫЕ ─────────────────────────── */

  const luck = activeLuck(state, now);
  const cost = useMemo(() => tariffCost(state.selectedTariff), [state.selectedTariff]);
  const levelXp = ECONOMY.xpForLevel(state.player.level);
  const levelProgress = Math.min(1, state.player.xp / Math.max(1, levelXp));

  const luckRemainingMs = useMemo(() => {
    if (!state.player.luck.expiresAt || luck <= 1) return 0;
    return Math.max(0, new Date(state.player.luck.expiresAt).getTime() - now);
  }, [state.player.luck.expiresAt, luck, now]);

  const countByRarity = useMemo(() => {
    const counters = Object.fromEntries(
      Object.keys(RARITIES).map((key) => [key, 0]),
    ) as Record<RarityId, number>;
    for (const number of state.numbers) counters[number.rarity] += 1;
    return counters;
  }, [state.numbers]);

  const portfolioValue = useMemo(
    () => state.numbers.reduce((sum, number) => sum + number.finalPrice, 0),
    [state.numbers],
  );

  // Прогноз замены цифры — чистая функция от номера, одинаковая на клиенте
  // и на сервере. Фактический результат всё равно определяет сервер.
  const forecast = useCallback(
    (number: PhoneNumber, index: number): DigitChangeForecast =>
      forecastDigitChange(number, index),
    [],
  );

  return {
    state,
    identity,
    mode,
    isAdmin,
    luck,
    luckRemainingMs,
    cost,
    tariff: TARIFFS[state.selectedTariff],
    levelXp,
    levelProgress,
    countByRarity,
    portfolioValue,
    dropped,
    revealing,
    revealingRarity,
    toasts,
    notify,
    doRelease,
    /** Перечитать состояние с сервера: нужно админским операциям. */
    refresh: refreshFromServer,
    chooseTariff,
    chooseCountry,
    chooseOperator,
    chooseCode,
    sell,
    sellBatch,
    makePrimary,
    replaceDigit,
    upgradeNumber,
    takeDaily,
    collectTask,
    collectAchievement,
    takeBailout,
    forecast,
    reset,
    dismissDrop: () => setDropped(null),
  };
}

export type Game = ReturnType<typeof useGame>;
