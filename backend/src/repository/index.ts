// language: TypeScript, file: backend/src/repository/index.ts
// Выбор хранилища по конфигурации. Игровая логика работает с интерфейсом,
// поэтому подмена драйвера ничего не меняет в правилах.

import { getPool } from '../db/pool.ts';
import type { Env } from '../env.ts';
import { MemoryRepository } from './memory.ts';
import { PostgresRepository } from './postgres.ts';
import type { Repository } from './types.ts';

export async function createRepository(env: Env): Promise<Repository> {
  if (!env.databaseUrl) {
    const repository = new MemoryRepository();
    await repository.init();
    return repository;
  }
  const repository = new PostgresRepository(getPool(env.databaseUrl));
  await repository.init();
  return repository;
}

export type { Repository } from './types.ts';
