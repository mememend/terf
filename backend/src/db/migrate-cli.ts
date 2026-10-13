// language: TypeScript, file: backend/src/db/migrate-cli.ts
// Применение схемы к базе. Отдельная точка входа, чтобы миграцию можно было
// запустить без поднятия сервера.

import { loadEnv } from '../env.ts';
import { applySchema, closePool, getPool } from './pool.ts';

const env = loadEnv();
if (!env.databaseUrl) {
  console.error('DATABASE_URL не задан — миграции нечего применять');
  process.exit(1);
}

const pool = getPool(env.databaseUrl);
try {
  await applySchema(pool);
  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log('[migrate] схема применена. Таблицы:');
  for (const row of tables.rows) console.log(`  · ${row.table_name}`);
} finally {
  await closePool();
}
