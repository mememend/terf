// language: TypeScript, file: backend/src/repository/memory.ts
// Хранилище в памяти. Нужно для локальной проверки и запуска без PostgreSQL.
// Документировано как НЕпостоянное: прогресс исчезает вместе с процессом.

import { createInitialState, normalizePromo } from '@ciferki/shared';
import type { GameState, PromoCode } from '@ciferki/shared';
import type { TelegramUser } from '../telegram-auth.ts';
import type {
  AuditEntry,
  GameStats,
  Mutation,
  MutationOutcome,
  PlayerRow,
  Repository,
} from './types.ts';

interface Entry {
  row: PlayerRow;
  state: GameState;
}

export class MemoryRepository implements Repository {
  readonly driver = 'memory' as const;

  private readonly players = new Map<number, Entry>();
  private readonly byTelegram = new Map<number, number>();
  private readonly releases = new Set<string>();
  private readonly audit: AuditEntry[] = [];
  private readonly overrides: Record<string, unknown> = {};
  /** Общий тираж промокодов: сколько раз какой код погасили. */
  private readonly promoUses_ = new Map<string, number>();
  /** Промокоды, созданные в админке. */
  private readonly promos_ = new Map<string, PromoCode>();
  private nextId = 1;
  private nextAuditId = 1;

  async init(): Promise<void> {
    console.warn(
      '[repo] DATABASE_URL не задан — работает хранилище в памяти. Прогресс не сохраняется между запусками.',
    );
  }

  async close(): Promise<void> {
    this.players.clear();
  }

  async getOrCreatePlayer(user: TelegramUser, admin: boolean): Promise<PlayerRow> {
    const existingId = this.byTelegram.get(user.id);
    if (existingId !== undefined) {
      const entry = this.players.get(existingId);
      if (entry) {
        entry.row.isAdmin = admin;
        return entry.row;
      }
    }

    const id = this.nextId;
    this.nextId += 1;
    const row: PlayerRow = {
      id,
      telegramId: user.id,
      name: displayName(user),
      username: user.username ?? null,
      avatarUrl: user.photo_url ?? null,
      isBanned: false,
      isAdmin: admin,
    };
    const state = createInitialState({
      id: String(id),
      name: row.name,
      avatarUrl: row.avatarUrl,
    });
    this.players.set(id, { row, state });
    this.byTelegram.set(user.id, id);
    return row;
  }

  async getPlayerById(playerId: number): Promise<PlayerRow | null> {
    return this.players.get(playerId)?.row ?? null;
  }

  async findPlayerByTelegramId(telegramId: number): Promise<PlayerRow | null> {
    const playerId = this.byTelegram.get(telegramId);
    if (playerId === undefined) return null;
    return this.players.get(playerId)?.row ?? null;
  }

  async loadState(playerId: number): Promise<GameState> {
    const entry = this.players.get(playerId);
    if (!entry) throw new Error(`Игрок ${playerId} не найден`);
    return structuredClone(entry.state);
  }

  async mutate<T>(playerId: number, work: Mutation<T>): Promise<MutationOutcome<T>> {
    const entry = this.players.get(playerId);
    if (!entry) throw new Error(`Игрок ${playerId} не найден`);

    const outcome = work(entry.state);
    // Движок возвращает то же состояние по ссылке, когда операция не выполнена.
    if (outcome.state !== entry.state) {
      for (const number of outcome.state.numbers) {
        this.releases.add(number.releaseId);
      }
      entry.state = outcome.state;
    }
    return outcome;
  }

  async releaseExists(releaseId: string): Promise<boolean> {
    return this.releases.has(releaseId);
  }

  async recordAudit(actorId: number | null, action: string, payload: unknown): Promise<void> {
    this.audit.unshift({
      id: this.nextAuditId,
      actorId,
      action,
      payload,
      createdAt: new Date().toISOString(),
    });
    this.nextAuditId += 1;
    if (this.audit.length > 500) this.audit.length = 500;
  }

  async findNumberOwner(
    candidates: string[],
  ): Promise<{ playerName: string; display: string } | null> {
    // Проверяем все написания сразу: игрок вставляет номер с кодом страны,
    // а в коллекции он лежит без него.
    const wanted = new Set(candidates);
    for (const entry of this.players.values()) {
      const found = entry.state.numbers.find((number) => wanted.has(number.digits));
      if (found) {
        return { playerName: entry.row.name, display: found.display };
      }
    }
    return null;
  }

  async promoUses(code: string): Promise<number> {
    return this.promoUses_.get(code) ?? 0;
  }

  async addPromoUse(code: string): Promise<void> {
    this.promoUses_.set(code, (this.promoUses_.get(code) ?? 0) + 1);
  }

  async promoList(): Promise<PromoCode[]> {
    return [...this.promos_.values()];
  }

  async createPromo(promo: PromoCode): Promise<void> {
    this.promos_.set(normalizePromo(promo.code), { ...promo, code: normalizePromo(promo.code), custom: true });
  }

  async deletePromo(code: string): Promise<boolean> {
    return this.promos_.delete(normalizePromo(code));
  }

  async stats(): Promise<GameStats> {
    const byRarity: Record<string, number> = {};
    let numbers = 0;
    let releases = 0;
    let priceSum = 0;
    let portfolioValue = 0;

    for (const entry of this.players.values()) {
      for (const number of entry.state.numbers) {
        numbers += 1;
        priceSum += number.finalPrice;
        portfolioValue += number.finalPrice;
        byRarity[number.rarity] = (byRarity[number.rarity] ?? 0) + 1;
      }
      releases += entry.state.processedReleaseIds.length;
    }

    return {
      players: this.players.size,
      numbers,
      releases,
      byRarity,
      averagePrice: numbers > 0 ? Math.round(priceSum / numbers) : 0,
      portfolioValue,
      recentAudit: this.audit.slice(0, 50),
    };
  }

  async getConfigOverrides(): Promise<Record<string, unknown>> {
    return { ...this.overrides };
  }

  async setConfigOverride(key: string, value: unknown, actorId: number): Promise<void> {
    this.overrides[key] = value;
    await this.recordAudit(actorId, 'config.set', { key, value });
  }

  async clearConfigOverride(key: string, actorId: number): Promise<void> {
    delete this.overrides[key];
    await this.recordAudit(actorId, 'config.clear', { key });
  }
}

function displayName(user: TelegramUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return user.username ?? `Игрок ${user.id}`;
}
