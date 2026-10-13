// language: TypeScript, file: bot/src/index.ts
// Точка входа бота: длинный опрос обновлений.
//
// Смещение update_id держим в памяти и продвигаем только после успешной
// обработки. Пауза растёт при сбоях сети и при 409 Conflict (второй экземпляр
// бота с тем же токеном), чтобы не забивать Telegram запросами.

import { TelegramApi, TelegramApiError } from './api.ts';
import { loadBotEnv } from './env.ts';
import { handleUpdate, type BotContext, type ProfileSummary } from './handlers.ts';
import { configureBot } from './setup.ts';

const MAX_BACKOFF_MS = 60_000;

/** Профиль игрока из игрового API. Работает только когда заданы адрес и секрет. */
async function fetchProfile(
  backendUrl: string,
  secret: string,
  telegramId: number,
): Promise<ProfileSummary | null> {
  const response = await fetch(`${backendUrl}/internal/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': secret },
    body: JSON.stringify({ telegramId }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { profile?: ProfileSummary };
  return payload.profile ?? null;
}

async function main(): Promise<void> {
  const env = loadBotEnv();
  const api = new TelegramApi(env.botToken, env.apiBase);

  const setup = await configureBot(api, env);
  console.log(`[bot] настройка: команды ${setup.commands}, кнопка меню ${setup.menuButton}`);
  for (const warning of setup.warnings) console.warn(`[bot] ${warning}`);

  const ctx: BotContext = {
    api,
    env,
    log: (message) => console.log(`[bot] ${message}`),
    ...(env.backendUrl && env.backendSecret
      ? {
          profile: (telegramId: number) =>
            fetchProfile(env.backendUrl!, env.backendSecret!, telegramId),
        }
      : {}),
  };

  if (!env.backendUrl || !env.backendSecret) {
    console.warn('[bot] BACKEND_URL или BOT_INTERNAL_SECRET не заданы — /profile покажет подсказку');
  }

  let offset = 0;
  let backoff = 1_000;
  let running = true;

  const stop = (signal: string): void => {
    console.log(`[bot] получен ${signal}, останавливаемся`);
    running = false;
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  console.log(`[bot] опрос запущен, игра: ${env.webappUrl}`);

  while (running) {
    try {
      const updates = await api.getUpdates(offset, env.pollTimeoutSeconds);
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        try {
          await handleUpdate(ctx, update);
        } catch (error) {
          // Одно сломанное обновление не должно ронять цикл: смещение уже сдвинуто.
          console.error(`[bot] обновление ${update.update_id} не обработано:`, error);
        }
      }
      backoff = 1_000;
    } catch (error) {
      if (!running) break;
      const wait = retryDelay(error, backoff);
      console.error(`[bot] опрос не удался, пауза ${wait} мс:`, describe(error));
      await sleep(wait);
      backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
    }
  }

  console.log('[bot] остановлен');
}

function retryDelay(error: unknown, backoff: number): number {
  if (error instanceof TelegramApiError) {
    if (error.retryAfterSeconds !== null) return error.retryAfterSeconds * 1_000;
    // 409 означает, что с этим токеном уже работает другой экземпляр.
    if (error.errorCode === 409) return Math.min(MAX_BACKOFF_MS, backoff + 5_000);
  }
  return backoff;
}

function describe(error: unknown): string {
  if (error instanceof TelegramApiError) return `${error.errorCode} ${error.description}`;
  return error instanceof Error ? error.message : String(error);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

main().catch((error: unknown) => {
  console.error('[bot] не удалось запуститься:', error);
  process.exit(1);
});
