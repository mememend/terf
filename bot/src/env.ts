// language: TypeScript, file: bot/src/env.ts
// Конфигурация бота. Токен обязателен: без него бот не может даже представиться.

export interface BotEnv {
  botToken: string;
  /** Публичный HTTPS-адрес Mini App. */
  webappUrl: string;
  /** Заголовок кнопки запуска. */
  webappTitle: string;
  /** Базовый адрес Bot API. Переопределяется в проверках на локальный сервер. */
  apiBase: string;
  /** Адрес игрового API: нужен для команд вида /profile. */
  backendUrl: string | null;
  /** Общий секрет для вызовов игрового API. Без него /profile недоступен. */
  backendSecret: string | null;
  /** Имя бота без @ — для ссылок вида t.me/<имя>. */
  botUsername: string | null;
  /** Нагрузка на сервер при сбое сети: базовая пауза опроса, мс. */
  pollTimeoutSeconds: number;
}

export function loadBotEnv(source: NodeJS.ProcessEnv = process.env): BotEnv {
  const botToken = source.BOT_TOKEN ?? '';
  if (!botToken) {
    throw new Error('BOT_TOKEN не задан — боту нечем авторизоваться в Telegram');
  }
  const webappUrl = source.WEBAPP_URL ?? 'http://127.0.0.1:5173';
  if (source.NODE_ENV === 'production' && !webappUrl.startsWith('https://')) {
    throw new Error('WEBAPP_URL должен быть HTTPS: Telegram не откроет Mini App по http');
  }

  return {
    botToken,
    webappUrl,
    webappTitle: source.WEBAPP_TITLE ?? 'Циферки',
    apiBase: source.BOT_API_BASE ?? 'https://api.telegram.org',
    backendUrl: source.BACKEND_URL ?? null,
    backendSecret: source.BOT_INTERNAL_SECRET ?? null,
    botUsername: source.BOT_USERNAME ?? null,
    pollTimeoutSeconds: Number(source.POLL_TIMEOUT ?? 25),
  };
}

/** Ссылка на Mini App с параметром запуска. */
export function webappLink(env: BotEnv, startParam?: string): string {
  if (!startParam) return env.webappUrl;
  const separator = env.webappUrl.includes('?') ? '&' : '?';
  return `${env.webappUrl}${separator}startapp=${encodeURIComponent(startParam)}`;
}

/** Прямая ссылка на Mini App через имя бота — для кнопок «Поделиться». */
export function miniAppDirectLink(env: BotEnv, startParam?: string): string | null {
  if (!env.botUsername) return null;
  const base = `https://t.me/${env.botUsername}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}
