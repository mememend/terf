// language: TypeScript, file: backend/src/repository/types.ts
// Контракт хранилища. Две реализации — PostgreSQL и память — ведут себя одинаково,
// поэтому игровая логика не знает, куда именно пишет.

import type { PromoCode } from '@ciferki/shared';
import type { GameState, LedgerEntry, PhoneNumber } from '@ciferki/shared';
import type { TelegramUser } from '../telegram-auth.ts';

export interface PlayerRow {
  id: number;
  telegramId: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isBanned: boolean;
  isAdmin: boolean;
}

/** Итог операции над состоянием: новое состояние и полезный результат наружу. */
export interface MutationOutcome<T> {
  state: GameState;
  value: T;
}

/**
 * Если вернуть то же самое состояние по ссылке, запись не выполняется.
 * Это позволяет «сухим» операциям (проверка средств, ошибка) ничего не менять.
 */
export type Mutation<T> = (state: GameState) => MutationOutcome<T>;

export interface AuditEntry {
  id: number;
  actorId: number | null;
  action: string;
  payload: unknown;
  createdAt: string;
}

export interface GameStats {
  players: number;
  numbers: number;
  releases: number;
  /** Сколько выпусков пришлось на каждую категорию. */
  byRarity: Record<string, number>;
  /** Средняя стоимость выпущенного номера. */
  averagePrice: number;
  /** Сумма всех ценностей в коллекциях. */
  portfolioValue: number;
  /** Последние ошибки и действия администраторов. */
  recentAudit: AuditEntry[];
}

export interface Repository {
  readonly driver: 'postgres' | 'memory';
  init(): Promise<void>;
  close(): Promise<void>;

  /** Найти игрока по telegram_id или создать. Имя и аватар берутся из подписи. */
  getOrCreatePlayer(user: TelegramUser, admin: boolean): Promise<PlayerRow>;
  getPlayerById(playerId: number): Promise<PlayerRow | null>;
  /**
   * Поиск по telegram_id без создания. Нужен серверным вызовам бота:
   * бот не должен заводить игрока только потому, что тот написал в чат.
   */
  findPlayerByTelegramId(telegramId: number): Promise<PlayerRow | null>;

  loadState(playerId: number): Promise<GameState>;

  /**
   * Выполнить операцию над состоянием игрока.
   * PostgreSQL: строка игрока блокируется на время операции (SELECT ... FOR UPDATE),
   * поэтому одновременные запросы не могут списать валюту дважды.
   */
  mutate<T>(playerId: number, work: Mutation<T>): Promise<MutationOutcome<T>>;

  /** Жёсткая проверка идемпотентности выпуска. */
  releaseExists(releaseId: string): Promise<boolean>;
  /**
   * Чей это номер. Нужно проверке номера: игрок вводит цифры и узнаёт,
   * свободен номер или он лежит у кого-то в коллекции.
   */
  findNumberOwner(candidates: string[]): Promise<{ playerName: string; display: string } | null>;

  /** Сколько раз промокод погасили во всей игре — для общего тиража. */
  promoUses(code: string): Promise<number>;
  /** Засчитать погашение промокода. */
  addPromoUse(code: string): Promise<void>;
  /** Промокоды, созданные в админке. */
  promoList(): Promise<PromoCode[]>;
  createPromo(promo: PromoCode): Promise<void>;
  deletePromo(code: string): Promise<boolean>;

  recordAudit(actorId: number | null, action: string, payload: unknown): Promise<void>;
  stats(): Promise<GameStats>;

  getConfigOverrides(): Promise<Record<string, unknown>>;
  setConfigOverride(key: string, value: unknown, actorId: number): Promise<void>;
  /** Снять переопределение: параметр вернётся к базовому значению. */
  clearConfigOverride(key: string, actorId: number): Promise<void>;
}

export type { GameState, LedgerEntry, PhoneNumber };
