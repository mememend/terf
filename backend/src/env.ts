// language: TypeScript, file: backend/src/env.ts
// Чтение и проверка переменных окружения. Сервер падает на старте, если
// в продакшене не задано что-то критичное — лучше упасть сразу, чем тихо работать неверно.

export interface Env {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  /** Строка подключения к PostgreSQL. Пусто — используется хранилище в памяти. */
  databaseUrl: string | null;
  botToken: string;
  webappUrl: string;
  corsOrigins: string[];
  adminTelegramIds: number[];
  /**
   * Общий секрет для вызовов от бота. Пусто — внутренние маршруты не поднимаются.
   */
  botInternalSecret: string | null;
  /** Сколько выпусков в минуту разрешено одному игроку. */
  releaseRateLimit: number;
  /**
   * Разрешить вход без подписи Telegram по заголовку X-Dev-User.
   * Только для локальной проверки; в продакшене запрещено жёстко.
   */
  allowDevAuth: boolean;
}

function readInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = (source.NODE_ENV ?? 'development') as Env['nodeEnv'];
  const botToken = source.BOT_TOKEN ?? '';
  const allowDevAuth = source.ALLOW_DEV_AUTH === '1' && nodeEnv !== 'production';

  const problems: string[] = [];
  if (nodeEnv === 'production' && !botToken) {
    problems.push('BOT_TOKEN обязателен в продакшене: без него нельзя проверить подпись Telegram');
  }
  if (nodeEnv === 'production' && !source.DATABASE_URL) {
    problems.push('DATABASE_URL обязателен в продакшене: хранилище в памяти теряет прогресс');
  }
  if (problems.length > 0) {
    throw new Error(`Некорректная конфигурация:\n- ${problems.join('\n- ')}`);
  }

  return {
    nodeEnv,
    port: readInt(source.PORT, 8080),
    databaseUrl: source.DATABASE_URL ?? null,
    botToken,
    webappUrl: source.WEBAPP_URL ?? 'http://127.0.0.1:5173',
    corsOrigins: readList(source.CORS_ORIGINS),
    adminTelegramIds: readList(source.ADMIN_TELEGRAM_IDS).map(Number).filter(Number.isFinite),
    botInternalSecret: source.BOT_INTERNAL_SECRET ?? null,
    releaseRateLimit: readInt(source.RELEASE_RATE_LIMIT, 60),
    allowDevAuth,
  };
}
