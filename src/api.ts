// language: TypeScript, file: frontend/src/api.ts
// Клиент серверного API. Один и тот же интерфейс используют и серверный,
// и локальный режим — экраны не знают, откуда пришли данные.
//
// Подпись Telegram уходит в заголовке X-Telegram-Init-Data. Сервер проверяет её
// сам и определяет игрока: клиент не может назваться кем-то другим.

import type {
  GameState,
  PhoneNumber,
  RarityId,
  TariffId,
  UpgradeId,
} from '@ciferki/shared';
import { authHeaders } from './telegram';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
/** Адрес проверки живости: тот же хост, но без префикса /api. */
const HEALTH_URL = `${BASE.replace(/\/api\/?$/, '')}/health`;
const TIMEOUT_MS = 8000;

export interface ChancesResponse {
  tariffId: TariffId;
  luck: number;
  odds: Record<RarityId, number>;
  rareAndAbove: number;
  categories: {
    id: RarityId;
    name: string;
    color: string;
    basePrice: number;
    percent: number;
  }[];
}

export interface ReleaseResponse {
  ok: boolean;
  number?: PhoneNumber;
  error?: string;
  balance: number;
}

export interface ActionResponse {
  ok: boolean;
  error?: string;
  number?: PhoneNumber;
  amount?: number;
  streak?: number;
  balance?: number;
}

export interface UpgradeOffer {
  id: UpgradeId;
  name: string;
  effect: string;
  description: string;
  price: number;
  affordable: boolean;
  available: boolean;
  targetRarity: RarityId | null;
  /** Для смены оператора — доступные варианты в регионе номера. */
  operators?: { id: string; name: string; samplePrefix: string; current: boolean }[];
}

export interface UpgradesResponse {
  ok: boolean;
  error?: string;
  balance: number;
  number: PhoneNumber;
  offers: UpgradeOffer[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Пояснение от сервера: почему значение отклонено. */
    readonly reason?: string,
  ) {
    super(code);
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...authHeaders(),
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const payloadError =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : 'request_failed';
      const reason =
        payload && typeof payload === 'object' && 'reason' in payload
          ? String((payload as { reason: unknown }).reason)
          : undefined;
      throw new ApiError(response.status, payloadError, reason);
    }
    return payload as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface AdminPromoRow {
  code: string;
  title: string;
  note: string;
  kind: string;
  reward: string;
  limit: number | null;
  until: string | null;
  custom: boolean;
  used: number;
}

export const api = {
  /** Проверка доступности сервера. Молча возвращает false, если его нет. */
  async healthy(): Promise<boolean> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(HEALTH_URL, { signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  },

  async state(): Promise<{ state: GameState; summary: unknown; isAdmin: boolean }> {
    return request<{ state: GameState; summary: unknown; isAdmin: boolean }>('/state');
  },

  async chances(tariffId?: TariffId): Promise<ChancesResponse> {
    const query = tariffId ? `?tariffId=${encodeURIComponent(tariffId)}` : '';
    return request<ChancesResponse>(`/chances${query}`);
  },

  async release(input: {
    tariffId?: TariffId;
    countryId?: string | null;
    releaseId: string;
  }): Promise<ReleaseResponse> {
    return request<ReleaseResponse>('/release', { method: 'POST', body: input });
  },

  async select(input: {
    tariffId?: TariffId;
    countryId?: string | null;
    operatorId?: string | null;
    code?: string | null;
  }): Promise<{
    ok: boolean;
    /** Что сервер записал на самом деле — клиент применяет это у себя */
    selection?: {
      tariffId: TariffId;
      countryId: string | null;
      operatorId: string | null;
      code: string | null;
    };
  }> {
    return request('/select', { method: 'POST', body: input });
  },

  /** Продать пачку номеров разом. Основной номер сервер пропустит сам. */
  async sellBatch(ids: string[]): Promise<{
    ok: boolean;
    sold: number;
    total: number;
    skipped: { id: string; reason: string }[];
  }> {
    return request('/sell-batch', { method: 'POST', body: { ids } });
  },

  async sell(numberId: string): Promise<ActionResponse> {
    return request<ActionResponse>('/sell', { method: 'POST', body: { numberId } });
  },

  async makePrimary(numberId: string): Promise<ActionResponse> {
    return request<ActionResponse>('/primary', { method: 'POST', body: { numberId } });
  },

  async forecast(numberId: string, index: number): Promise<unknown> {
    return request<unknown>(
      `/digit/forecast?numberId=${encodeURIComponent(numberId)}&index=${index}`,
    );
  },

  async changeDigit(numberId: string, index: number): Promise<ActionResponse> {
    return request<ActionResponse>('/digit', { method: 'POST', body: { numberId, index } });
  },

  /** Витрина улучшений: что можно сделать с номером и сколько это стоит. */
  async upgrades(numberId: string): Promise<UpgradesResponse> {
    return request<UpgradesResponse>(`/upgrades?numberId=${encodeURIComponent(numberId)}`);
  },

  /** Применение улучшения. Цену и результат определяет сервер. */
  async upgrade(input: {
    numberId: string;
    id: UpgradeId;
    index?: number;
    a?: number;
    b?: number;
    operatorId?: string;
  }): Promise<ActionResponse> {
    return request<ActionResponse>('/upgrade', { method: 'POST', body: input });
  },

  async daily(): Promise<ActionResponse> {
    return request<ActionResponse>('/daily', { method: 'POST' });
  },

  /* ── Промокоды в админке ── */

  /** Список кодов: зашитые в игру и созданные в админке. */
  async adminPromos(): Promise<{
    builtin: AdminPromoRow[];
    custom: AdminPromoRow[];
  }> {
    return request('/admin/promos');
  },

  /** Создать промокод. Код латиницей, регистр не важен. */
  async adminCreatePromo(input: {
    code: string;
    title: string;
    kind: string;
    amount: number;
    limit: number | null;
    until: string | null;
  }): Promise<{ ok: boolean; error?: string; promo?: { code: string; reward: string } }> {
    return request('/admin/promos', { method: 'POST', body: input });
  },

  async adminDeletePromo(code: string): Promise<{ ok: boolean }> {
    return request(`/admin/promos/${encodeURIComponent(code)}`, { method: 'DELETE' });
  },
  /** Погасить промокод. Срок, повтор и тираж проверяет сервер. */
  async promo(code: string): Promise<{
    ok: boolean;
    gained: string;
    title: string | null;
    note: string | null;
    balance: number;
  }> {
    return request('/promo', { method: 'POST', body: { code } });
  },

  /** Крутить колесо. Приз выбирает сервер по весам из общего ядра. */
  async roulette(wheelId?: string): Promise<{
    ok: boolean;
    index: number;
    spent: number;
    gained: number;
    prize: {
      id: string;
      kind: 'money' | 'tickets' | 'luck' | 'refund';
      label: string;
      title: string;
      chance: number;
      color: string;
    } | null;
    balance: number;
    freeReleases: number;
  }> {
    return request('/roulette', {
      method: 'POST',
      // Идентификатор прокрута: повторная отправка не спишет деньги дважды.
      body: { wheelId, releaseId: `spin_${wheelId ?? 'standard'}_${Date.now()}` },
    });
  },

  /** Проверка номера: свободен он или занят чьей-то коллекцией. */
  async checkNumber(number: string): Promise<{
    ok: boolean;
    digits: string;
    free: boolean;
    checked?: number;
    display: string | null;
  }> {
    return request(`/check?number=${encodeURIComponent(number)}`);
  },

  /** Забрать награду за задание дня или недели. */
  async claimTask(key: string): Promise<{ ok: boolean; amount: number; balance: number }> {
    return request('/task', { method: 'POST', body: { key } });
  },

  /** Забрать награду за достижение. Условие проверяет сервер. */
  async claimAchievement(id: string): Promise<ActionResponse> {
    return request<ActionResponse>('/achievement', { method: 'POST', body: { id } });
  },

  async bailout(): Promise<ActionResponse> {
    return request<ActionResponse>('/bailout', { method: 'POST' });
  },

  /* ─────────────────────────── АДМИН-ПАНЕЛЬ ─────────────────────────── */
  // Сервер проверяет права по подписи Telegram: клиент лишь показывает раздел.

  admin: {
    async config(): Promise<AdminConfig> {
      return request<AdminConfig>('/admin/config');
    },

    /** Изменить параметр. Сервер проверяет значение до записи. */
    async set(key: string, value: unknown): Promise<{ ok: boolean; applied: string[] }> {
      return request<{ ok: boolean; applied: string[] }>('/admin/config', {
        method: 'PUT',
        body: { key, value },
      });
    },

    /** Снять переопределение — параметр вернётся к базовому значению. */
    async clear(key: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/admin/config/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
    },

    async stats(): Promise<AdminStats> {
      return request<AdminStats>('/admin/stats');
    },

    /**
     * Выдать себе анонимные номера +888. Бесплатно: это инструмент проверки,
     * а не покупка — анонимный номер нельзя выпустить обычным путём.
     */
    async anonymous(count: number): Promise<AnonymousResponse> {
      return request<AnonymousResponse>('/admin/anonymous', {
        method: 'POST',
        body: { count },
      });
    },

    async audit(): Promise<{ entries: AdminAuditEntry[] }> {
      return request<{ entries: AdminAuditEntry[] }>('/admin/audit');
    },
  },
};

export interface AnonymousNumber {
  id: string;
  display: string;
  rarity: string;
  score: number;
  finalPrice: number;
}

export interface AnonymousResponse {
  ok: boolean;
  error?: string;
  max?: number;
  numbers?: AnonymousNumber[];
}

export interface AdminConfig {
  overrides: Record<string, unknown>;
  base: {
    tariffPrice: Record<string, number | null>;
    tariffOdds: Record<string, Record<string, number>>;
    patternPoints: Record<string, number>;
    regionDemand: Record<string, number>;
    rarityBasePrice: Record<string, number>;
  };
  current: AdminConfig['base'];
  tariffs: {
    id: string;
    name: string;
    price: number | null;
    ticketCost: number | null;
    odds: Record<string, number>;
  }[];
  patterns: { id: string; points: number }[];
  regions: {
    id: string;
    name: string;
    /** Флаг вместо идентификатора: «ru» игроку ничего не говорит */
    flag?: string;
    code?: string;
    demand: number;
    operators?: number;
  }[];
  rarities: { id: string; name: string; basePrice: number }[];
}

export interface AdminAuditEntry {
  id: number;
  actorId: number | null;
  action: string;
  payload: unknown;
  createdAt: string;
}

export interface AdminStats {
  players: number;
  numbers: number;
  releases: number;
  byRarity: Record<string, number>;
  averagePrice: number;
  portfolioValue: number;
  recentAudit: AdminAuditEntry[];
}

/** Читаемый текст ошибки сервера для всплывающей подсказки. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    // Пояснение сервера важнее общего текста: оно говорит, что именно не так.
    if (error.reason) return error.reason;
    switch (error.code) {
      case 'insufficient_funds':
        return 'Недостаточно средств на балансе';
      case 'no_tickets':
        return 'Нужен билет для тарифа Элит';
      case 'duplicate':
        return 'Эта операция уже выполнена';
      case 'slots_full':
        return 'Коллекция заполнена';
      case 'rate_limited':
        return 'Слишком часто — подожди секунду';
      case 'unauthorized':
      case 'invalid_init_data':
        return 'Не удалось подтвердить вход через Telegram';
      case 'banned':
        return 'Доступ к игре ограничен';
      case 'forbidden':
        return 'Недостаточно прав';
      case 'unknown_upgrade':
        return 'Такого улучшения нет';
      case 'leading_zero':
        return 'Номер не может начинаться с нуля';
      case 'same_digit':
        return 'Это одна и та же цифра';
      case 'max_rarity':
        return 'Выше мифического некуда';
      case 'bad_index':
        return 'Некорректная позиция цифры';
      case 'unknown_key':
        return 'Такой параметр нельзя менять';
      case 'invalid_value':
        return 'Значение не прошло проверку';
      default:
        return 'Сервер отклонил операцию';
    }
  }
  return 'Сервер недоступен';
}
