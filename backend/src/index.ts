// language: TypeScript, file: backend/src/index.ts
// Запуск сервера. Проверяет соединение с базой до открытия порта,
// чтобы не принимать запросы в нерабочем состоянии.

import { createApp } from './app.ts';
import { closePool } from './db/pool.ts';
import { loadEnv } from './env.ts';
import { createRepository } from './repository/index.ts';
import { reloadConfig } from './services/config-service.ts';

async function main(): Promise<void> {
  const env = loadEnv();
  const repo = await createRepository(env);
  // Переопределения из админ-панели применяем ДО первого запроса: иначе первые
  // выпуски посчитались бы по базовым ценам.
  await reloadConfig(repo);
  const app = createApp(repo, env);

  const server = app.listen(env.port, () => {
    console.log(`[server] Циферки API слушает порт ${env.port}`);
    console.log(`[server] окружение: ${env.nodeEnv}, хранилище: ${repo.driver}`);
    if (env.allowDevAuth) {
      console.warn('[server] ВНИМАНИЕ: ALLOW_DEV_AUTH=1 — вход без подписи Telegram разрешён');
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] получен ${signal}, останавливаемся`);
    server.close();
    await repo.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('[server] не удалось запуститься:', error);
  process.exit(1);
});
