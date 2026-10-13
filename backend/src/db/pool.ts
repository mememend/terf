// language: TypeScript, file: backend/src/db/pool.ts
// Пул соединений PostgreSQL. Создаётся один раз на процесс.

import pg from 'pg';
import schemaSql from './schema.sql';

const { Pool } = pg;

export type DbPool = pg.Pool;

let pool: DbPool | null = null;

export function getPool(connectionString: string): DbPool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      // Деньги и очки храним целыми: BIGINT приходит строкой, поэтому приводим сами.
      application_name: 'ciferki-backend',
    });
    pool.on('error', (error) => {
      console.error('[db] ошибка простаивающего соединения:', error.message);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const active = pool;
  pool = null;
  await active.end();
}

/**
 * Применяет схему. Все операторы идемпотентны (IF NOT EXISTS), поэтому вызов
 * безопасен при каждом старте. SQL вшит в бандл — файловых зависимостей нет.
 */
export async function applySchema(db: DbPool): Promise<void> {
  await db.query(schemaSql);
}

/** Проверка соединения на старте: лучше упасть сразу, чем на первом запросе. */
export async function pingDatabase(db: DbPool): Promise<void> {
  await db.query('SELECT 1');
}
