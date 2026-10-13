// language: TypeScript, file: backend/src/repository/postgres.ts
// Хранилище на PostgreSQL.
//
// Почему блокировка строки, а не отдельный счётчик: все операции игрока проходят
// через mutate(), который берёт строку игрока под SELECT ... FOR UPDATE. Два
// одновременных выпуска встают в очередь, поэтому баланс нельзя увести в минус
// двойным списанием. Дополнительно release_id — первичный ключ таблицы releases:
// повторный запрос с тем же идентификатором отсекается на уровне схемы.

import { TARIFFS, createInitialState, normalizePromo } from '@ciferki/shared';
import type {
  GameState,
  LedgerEntry,
  PatternHit,
  PhoneNumber,
  Player,
  PromoCode,
} from '@ciferki/shared';
import type { PoolClient } from 'pg';
import { applySchema, pingDatabase, type DbPool } from '../db/pool.ts';
import type { TelegramUser } from '../telegram-auth.ts';
import type {
  GameStats,
  Mutation,
  MutationOutcome,
  PlayerRow,
  Repository,
} from './types.ts';

interface PlayerDbRow {
  id: string;
  telegram_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  balance: string;
  tickets: number;
  level: number;
  xp: number;
  primary_number_id: string | null;
  free_primary_swaps: number;
  daily_streak: number;
  luck_multiplier: string;
  luck_expires_at: Date | null;
  selected_tariff: string;
  selected_country: string | null;
  selected_operator: string | null;
  selected_code: string | null;
  luck_spins: number;
  free_releases: number;
  used_promo_codes: string[] | null;
  claimed_achievements: string[] | null;
  is_banned: boolean;
}

interface NumberDbRow {
  id: string;
  release_id: string;
  display: string;
  digits: string;
  country_id: string;
  region_code: string;
  operator_id: string;
  tariff_id: string;
  rarity: string;
  base_price: string;
  pattern_multiplier: string;
  demand_multiplier: string;
  final_price: string;
  score: number;
  patterns: PatternHit[];
  limited_edition: number | null;
  issued_at: Date;
}

interface LedgerDbRow {
  id: string;
  kind: string;
  amount: string;
  label: string;
  number_id: string | null;
  created_at: Date;
}

export class PostgresRepository implements Repository {
  readonly driver = 'postgres' as const;

  constructor(private readonly pool: DbPool) {}

  async init(): Promise<void> {
    await pingDatabase(this.pool);
    await applySchema(this.pool);
  }

  async close(): Promise<void> {
    // Пул закрывает процесс целиком, здесь ничего не делаем.
  }

  async getOrCreatePlayer(user: TelegramUser, admin: boolean): Promise<PlayerRow> {
    const name = displayName(user);
    const inserted = await this.pool.query<PlayerDbRow>(
      `INSERT INTO players (telegram_id, name, username, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id) DO UPDATE
         SET name = EXCLUDED.name,
             username = EXCLUDED.username,
             avatar_url = EXCLUDED.avatar_url,
             updated_at = now()
       RETURNING *`,
      [user.id, name, user.username ?? null, user.photo_url ?? null],
    );
    return mapPlayerRow(inserted.rows[0], admin);
  }

  async getPlayerById(playerId: number): Promise<PlayerRow | null> {
    const result = await this.pool.query<PlayerDbRow>('SELECT * FROM players WHERE id = $1', [
      playerId,
    ]);
    return result.rowCount === 0 ? null : mapPlayerRow(result.rows[0], false);
  }

  async findPlayerByTelegramId(telegramId: number): Promise<PlayerRow | null> {
    const result = await this.pool.query<PlayerDbRow>(
      'SELECT * FROM players WHERE telegram_id = $1',
      [telegramId],
    );
    return result.rowCount === 0 ? null : mapPlayerRow(result.rows[0], false);
  }

  async loadState(playerId: number): Promise<GameState> {
    const client = await this.pool.connect();
    try {
      const player = await client.query<PlayerDbRow>('SELECT * FROM players WHERE id = $1', [
        playerId,
      ]);
      if (player.rowCount === 0) throw new Error(`Игрок ${playerId} не найден`);
      return await this.readState(client, player.rows[0]);
    } finally {
      client.release();
    }
  }

  async mutate<T>(playerId: number, work: Mutation<T>): Promise<MutationOutcome<T>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Блокируем строку игрока: параллельные операции встают в очередь.
      const player = await client.query<PlayerDbRow>(
        'SELECT * FROM players WHERE id = $1 FOR UPDATE',
        [playerId],
      );
      if (player.rowCount === 0) throw new Error(`Игрок ${playerId} не найден`);

      const state = await this.readState(client, player.rows[0]);
      const loadedNumbers = new Map(state.numbers.map((number) => [number.id, number]));
      const loadedLedger = new Set(state.ledger.map((entry) => entry.id));

      const outcome = work(state);
      // Движок возвращает то же состояние по ссылке, когда операция не выполнена.
      if (outcome.state !== state) {
        await this.writeState(client, playerId, outcome.state, loadedNumbers, loadedLedger);
      }

      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async releaseExists(releaseId: string): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 FROM releases WHERE release_id = $1', [
      releaseId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async recordAudit(actorId: number | null, action: string, payload: unknown): Promise<void> {
    await this.pool.query(
      'INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)',
      [actorId, action, JSON.stringify(payload ?? {})],
    );
  }

  async findNumberOwner(
    candidates: string[],
  ): Promise<{ playerName: string; display: string } | null> {
    const result = await this.pool.query<{ name: string; display: string }>(
      `SELECT p.name, n.display
         FROM numbers n
         JOIN players p ON p.id = n.player_id
        WHERE n.digits = ANY($1)
        LIMIT 1`,
      [candidates],
    );
    const row = result.rows[0];
    return row ? { playerName: row.name, display: row.display } : null;
  }

  async promoList(): Promise<PromoCode[]> {
    const result = await this.pool.query<{
      code: string;
      title: string;
      note: string;
      kind: string;
      amount: number;
      max_uses: number | null;
      until: Date | null;
    }>('SELECT * FROM custom_promos ORDER BY created_at DESC');

    return result.rows.map((row) => ({
      code: row.code,
      title: row.title,
      note: row.note,
      // Вид награды собираем обратно в тот же вид, что и у зашитых кодов.
      reward:
        row.kind === 'money'
          ? { kind: 'money', amount: row.amount }
          : row.kind === 'tickets'
            ? { kind: 'tickets', count: row.amount }
            : row.kind === 'releases'
              ? { kind: 'releases', count: row.amount }
              : { kind: 'luck', multiplier: row.amount, spins: 3 },
      limit: row.max_uses,
      until: row.until ? new Date(row.until).toISOString().slice(0, 10) : null,
      custom: true,
    }));
  }

  async createPromo(promo: PromoCode): Promise<void> {
    const reward = promo.reward;
    const amount =
      reward.kind === 'money'
        ? reward.amount
        : reward.kind === 'tickets'
          ? reward.count
          : reward.kind === 'releases'
            ? reward.count
            : reward.multiplier;

    await this.pool.query(
      `INSERT INTO custom_promos (code, title, note, kind, amount, max_uses, until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE
         SET title = $2, note = $3, kind = $4, amount = $5, max_uses = $6, until = $7`,
      [normalizePromo(promo.code), promo.title, promo.note, reward.kind, amount, promo.limit, promo.until],
    );
  }

  async deletePromo(code: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM custom_promos WHERE code = $1', [
      normalizePromo(code),
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async promoUses(code: string): Promise<number> {
    const result = await this.pool.query<{ uses: number }>(
      'SELECT uses FROM promo_uses WHERE code = $1',
      [code],
    );
    return result.rows[0]?.uses ?? 0;
  }

  async addPromoUse(code: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO promo_uses (code, uses) VALUES ($1, 1)
       ON CONFLICT (code) DO UPDATE SET uses = promo_uses.uses + 1`,
      [code],
    );
  }

  async stats(): Promise<GameStats> {
    const [players, numbers, releases, rarity, audit] = await Promise.all([
      this.pool.query<{ count: string }>('SELECT count(*)::text AS count FROM players'),
      this.pool.query<{ count: string; avg: string | null; total: string | null }>(
        'SELECT count(*)::text AS count, avg(final_price)::text AS avg, sum(final_price)::text AS total FROM numbers',
      ),
      this.pool.query<{ count: string }>('SELECT count(*)::text AS count FROM releases'),
      this.pool.query<{ rarity: string; count: string }>(
        'SELECT rarity, count(*)::text AS count FROM numbers GROUP BY rarity',
      ),
      this.pool.query<{ id: string; actor_id: string | null; action: string; payload: unknown; created_at: Date }>(
        'SELECT id, actor_id, action, payload, created_at FROM audit_log ORDER BY id DESC LIMIT 50',
      ),
    ]);

    const byRarity: Record<string, number> = {};
    for (const row of rarity.rows) byRarity[row.rarity] = Number(row.count);

    return {
      players: Number(players.rows[0]?.count ?? 0),
      numbers: Number(numbers.rows[0]?.count ?? 0),
      releases: Number(releases.rows[0]?.count ?? 0),
      byRarity,
      averagePrice: Math.round(Number(numbers.rows[0]?.avg ?? 0)),
      portfolioValue: Number(numbers.rows[0]?.total ?? 0),
      recentAudit: audit.rows.map((row) => ({
        id: Number(row.id),
        actorId: row.actor_id === null ? null : Number(row.actor_id),
        action: row.action,
        payload: row.payload,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  }

  async getConfigOverrides(): Promise<Record<string, unknown>> {
    const result = await this.pool.query<{ key: string; value: unknown }>(
      'SELECT key, value FROM game_config',
    );
    const overrides: Record<string, unknown> = {};
    for (const row of result.rows) overrides[row.key] = row.value;
    return overrides;
  }

  async setConfigOverride(key: string, value: unknown, actorId: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO game_config (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, JSON.stringify(value), actorId],
      );
      await client.query(
        'INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)',
        [actorId, 'config.set', JSON.stringify({ key, value })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async clearConfigOverride(key: string, actorId: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM game_config WHERE key = $1', [key]);
      await client.query(
        'INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)',
        [actorId, 'config.clear', JSON.stringify({ key })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /* ─────────────────────────── ЧТЕНИЕ СОСТОЯНИЯ ─────────────────────────── */

  private async readState(client: PoolClient, row: PlayerDbRow): Promise<GameState> {
    const playerId = Number(row.id);
    const [numbers, ledger, releases] = await Promise.all([
      client.query<NumberDbRow>(
        'SELECT * FROM numbers WHERE player_id = $1 ORDER BY issued_at DESC',
        [playerId],
      ),
      client.query<LedgerDbRow>(
        'SELECT * FROM ledger WHERE player_id = $1 ORDER BY created_at DESC LIMIT 500',
        [playerId],
      ),
      client.query<{ release_id: string }>(
        'SELECT release_id FROM releases WHERE player_id = $1 ORDER BY created_at DESC LIMIT 500',
        [playerId],
      ),
    ]);

    const player: Player = {
      id: String(playerId),
      name: row.name,
      avatarUrl: row.avatar_url,
      balance: Number(row.balance),
      tickets: row.tickets,
      // Бесплатные выпуски из рулетки живут на игроке, как и билеты.
      freeReleases: row.free_releases ?? 0,
      level: row.level,
      xp: row.xp,
      primaryNumberId: row.primary_number_id,
      freePrimarySwaps: row.free_primary_swaps,
      dailyStreak: row.daily_streak,
      luck: {
        multiplier: Number(row.luck_multiplier),
        expiresAt: row.luck_expires_at ? new Date(row.luck_expires_at).toISOString() : null,
        spinsLeft: row.luck_spins ?? 0,
        title: 'Ивент · Удача ×2',
        subtitle: 'Удача ×2 на все крутки — до 00:00 МСК',
      },
    };

    return {
      schema: createInitialState().schema,
      player,
      numbers: numbers.rows.map(mapNumberRow),
      ledger: ledger.rows.map(mapLedgerRow),
      selectedTariff: row.selected_tariff as GameState['selectedTariff'],
      selectedCountry: row.selected_country,
      selectedOperator: row.selected_operator ?? null,
      selectedCode: row.selected_code ?? null,
      processedReleaseIds: releases.rows.map((item) => item.release_id),
      claimedAchievements: row.claimed_achievements ?? [],
      usedPromoCodes: row.used_promo_codes ?? [],
      slots: 100,
    };
  }

  /* ─────────────────────────── ЗАПИСЬ СОСТОЯНИЯ ─────────────────────────── */

  private async writeState(
    client: PoolClient,
    playerId: number,
    state: GameState,
    loadedNumbers: Map<string, PhoneNumber>,
    loadedLedger: Set<string>,
  ): Promise<void> {
    await client.query(
      `UPDATE players SET
         balance = $2, tickets = $3, level = $4, xp = $5,
         primary_number_id = $6, free_primary_swaps = $7, daily_streak = $8,
         luck_multiplier = $9, luck_expires_at = $10,
         selected_tariff = $11, selected_country = $12,
         selected_operator = $13, selected_code = $14,
         luck_spins = $15, free_releases = $16,
         claimed_achievements = $17, used_promo_codes = $18, updated_at = now()
       WHERE id = $1`,
      [
        playerId,
        state.player.balance,
        state.player.tickets,
        state.player.level,
        state.player.xp,
        state.player.primaryNumberId,
        state.player.freePrimarySwaps,
        state.player.dailyStreak,
        state.player.luck.multiplier,
        state.player.luck.expiresAt,
        state.selectedTariff,
        state.selectedCountry,
        state.selectedOperator,
        state.selectedCode,
        state.player.luck.spinsLeft,
        state.player.freeReleases,
        state.claimedAchievements,
        state.usedPromoCodes,
      ],
    );

    const nextIds = new Set(state.numbers.map((number) => number.id));

    // Удалённые номера: проданные или переданные.
    for (const id of loadedNumbers.keys()) {
      if (!nextIds.has(id)) {
        await client.query('DELETE FROM numbers WHERE id = $1 AND player_id = $2', [id, playerId]);
      }
    }

    for (const number of state.numbers) {
      const previous = loadedNumbers.get(number.id);
      if (!previous) {
        // Сначала журнал выпуска: на него ссылается номер по внешнему ключу.
        const tariff = TARIFFS[number.tariffId];
        await client.query(
          `INSERT INTO releases (release_id, player_id, number_id, tariff_id, country_id, cost, tickets, rarity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (release_id) DO NOTHING`,
          [
            number.releaseId,
            playerId,
            number.id,
            number.tariffId,
            number.countryId,
            tariff?.price ?? 0,
            tariff?.ticketCost ?? 0,
            number.rarity,
          ],
        );
        await client.query(
          `INSERT INTO numbers (
             id, player_id, release_id, display, digits, country_id, region_code, operator_id,
             tariff_id, rarity, base_price, pattern_multiplier, demand_multiplier, final_price,
             score, patterns, limited_edition, issued_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (id) DO NOTHING`,
          [
            number.id, playerId, number.releaseId, number.display, number.digits,
            number.countryId, number.regionCode, number.operatorId, number.tariffId,
            number.rarity, number.basePrice, number.patternMultiplier, number.demandMultiplier,
            number.finalPrice, number.score, JSON.stringify(number.patterns),
            number.limitedEdition, number.issuedAt,
          ],
        );
      } else if (numberFieldsChanged(previous, number)) {
        // Улучшение меняет категорию, очки, оценку и — при смене оператора —
        // ещё и оператора с отображением. Все эти поля обязаны попасть в UPDATE,
        // иначе правка потеряется: в памяти она бы осталась, а в базе нет.
        await client.query(
          `UPDATE numbers SET
             display = $2, digits = $3, operator_id = $4, rarity = $5, base_price = $6,
             pattern_multiplier = $7, demand_multiplier = $8, final_price = $9,
             score = $10, patterns = $11
           WHERE id = $1 AND player_id = $12`,
          [
            number.id, number.display, number.digits, number.operatorId, number.rarity,
            number.basePrice, number.patternMultiplier, number.demandMultiplier,
            number.finalPrice, number.score, JSON.stringify(number.patterns), playerId,
          ],
        );
      }
    }

    for (const entry of state.ledger.slice(0, 500)) {
      if (loadedLedger.has(entry.id)) continue;
      await client.query(
        `INSERT INTO ledger (id, player_id, kind, amount, label, number_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [entry.id, playerId, entry.kind, entry.amount, entry.label, entry.numberId ?? null, entry.at],
      );
    }
  }
}

/* ─────────────────────────── ПРЕОБРАЗОВАНИЕ СТРОК ─────────────────────────── */

function mapPlayerRow(row: PlayerDbRow, admin: boolean): PlayerRow {
  return {
    id: Number(row.id),
    telegramId: Number(row.telegram_id),
    name: row.name,
    username: row.username,
    avatarUrl: row.avatar_url,
    isBanned: row.is_banned,
    isAdmin: admin,
  };
}

function mapNumberRow(row: NumberDbRow): PhoneNumber {
  return {
    id: row.id,
    display: row.display,
    digits: row.digits,
    countryId: row.country_id,
    regionCode: row.region_code,
    operatorId: row.operator_id,
    tariffId: row.tariff_id as PhoneNumber['tariffId'],
    rarity: row.rarity as PhoneNumber['rarity'],
    basePrice: Number(row.base_price),
    patternMultiplier: Number(row.pattern_multiplier),
    demandMultiplier: Number(row.demand_multiplier),
    finalPrice: Number(row.final_price),
    score: row.score,
    patterns: row.patterns ?? [],
    issuedAt: new Date(row.issued_at).toISOString(),
    releaseId: row.release_id,
    limitedEdition: row.limited_edition,
  };
}

function mapLedgerRow(row: LedgerDbRow): LedgerEntry {
  return {
    id: row.id,
    kind: row.kind as LedgerEntry['kind'],
    amount: Number(row.amount),
    label: row.label,
    at: new Date(row.created_at).toISOString(),
    numberId: row.number_id ?? undefined,
  };
}

/**
 * Сравниваем все поля, которые может изменить улучшение.
 * Оператор включён намеренно: смена оператора не трогает очки и цену,
 * и без этой проверки правка не попала бы в базу.
 */
function numberFieldsChanged(a: PhoneNumber, b: PhoneNumber): boolean {
  return (
    a.digits !== b.digits ||
    a.display !== b.display ||
    a.operatorId !== b.operatorId ||
    a.rarity !== b.rarity ||
    a.score !== b.score ||
    a.finalPrice !== b.finalPrice ||
    a.patternMultiplier !== b.patternMultiplier ||
    a.demandMultiplier !== b.demandMultiplier
  );
}

function displayName(user: TelegramUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return user.username ?? `Игрок ${user.id}`;
}
