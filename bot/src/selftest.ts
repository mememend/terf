// language: TypeScript, file: bot/src/selftest.ts
// Проверка бота без настоящего Telegram: локальный эмулятор Bot API.
// Гоняем по нему настоящий клиент, поэтому проверяется и разбор обновлений,
// и формирование запросов, и сборка клавиатур.

import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { TelegramApi } from './api.ts';
import type { TelegramUpdate } from './api.ts';
import { loadBotEnv, type BotEnv } from './env.ts';
import { handleUpdate, parseCommand } from './handlers.ts';
import { configureBot } from './setup.ts';
import { TEXTS } from './texts.ts';

interface RecordedCall {
  method: string;
  payload: Record<string, any>;
}

const calls: RecordedCall[] = [];
let inbox: TelegramUpdate[] = [];

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures += 1;
}

function lastCall(method: string): RecordedCall | undefined {
  return [...calls].reverse().find((call) => call.method === method);
}

/** Неразрывные пробелы из Intl приводим к обычным — иначе сравнение врёт. */
function normalizeSpaces(value: string): string {
  return value.replace(/[\u00A0\u202F\u2009]/g, ' ');
}

function respond(res: import('node:http').ServerResponse, result: unknown): void {
  if (res.writableEnded) return;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, result }));
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await sleep(100);
  }
  return predicate();
}

function startFakeApi(): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = url.pathname.split('/').pop() ?? '';
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let payload: Record<string, any> = {};
      try {
        payload = body ? (JSON.parse(body) as Record<string, any>) : {};
      } catch {
        payload = {};
      }
      calls.push({ method, payload });

      let result: unknown = true;
      if (method === 'getMe') {
        result = {
          id: 1,
          is_bot: true,
          first_name: 'Циферки',
          username: 'ciferki_bot',
        };
      } else if (method === 'getUpdates') {
        const offset = Number(payload.offset ?? 0);
        result = inbox.filter((update) => update.update_id >= offset);
        inbox = [];
        // Эмулятор уважает длинный опрос, но не дольше секунды: иначе проверка
        // процесса бота зависла бы на реальном таймауте Telegram.
        const wait = Math.min(Number(payload.timeout ?? 0), 1) * 1000;
        if (wait > 0) {
          setTimeout(() => respond(res, result), wait);
          return;
        }
      } else if (method === 'sendMessage') {
        result = {
          message_id: calls.length,
          chat: { id: payload.chat_id, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: payload.text,
        };
      }

      respond(res, result);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

function messageUpdate(id: number, text: string): TelegramUpdate {
  return {
    update_id: id,
    message: {
      message_id: id,
      from: { id: 4242, is_bot: false, first_name: 'Диджей', username: 'dj' },
      chat: { id: 4242, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

async function main(): Promise<void> {
  console.log('\nРазбор команд');
  check('обычная команда', parseCommand('/start')?.command === 'start');
  check('команда с параметром', parseCommand('/start ref_42')?.payload === 'ref_42');
  check('команда с адресацией бота', parseCommand('/help@ciferki_bot')?.command === 'help');
  check('регистр не важен', parseCommand('/START')?.command === 'start');
  check('обычный текст не команда', parseCommand('привет') === null);
  check('пустой текст не команда', parseCommand(undefined) === null);

  const { server, port } = await startFakeApi();
  process.env.BOT_TOKEN = 'test-token';
  const env: BotEnv = {
    ...loadBotEnv({
      BOT_TOKEN: 'test-token',
      WEBAPP_URL: 'https://ciferki.example/app',
      WEBAPP_TITLE: 'Циферки',
      BOT_USERNAME: 'ciferki_bot',
    }),
    apiBase: `http://127.0.0.1:${port}`,
  };

  const api = new TelegramApi(env.botToken, env.apiBase);

  console.log('\nНастройка бота');
  const setup = await configureBot(api, env);
  check('getMe вызван', Boolean(lastCall('getMe')));
  check('команды установлены', setup.commands === true);
  check('кнопка меню установлена', setup.menuButton === true);
  const menuCall = lastCall('setChatMenuButton');
  check('меню открывает Mini App', menuCall?.payload.menu_button?.type === 'web_app');
  check(
    'адрес в кнопке меню верный',
    menuCall?.payload.menu_button?.web_app?.url === 'https://ciferki.example/app',
    String(menuCall?.payload.menu_button?.web_app?.url),
  );
  check('имя бота подхвачено из getMe', setup.username === 'ciferki_bot');

  console.log('\nДлинный опрос');
  inbox = [messageUpdate(100, '/start')];
  const first = await api.getUpdates(0, 0);
  check('обновление получено', first.length === 1, String(first.length));
  inbox = [];
  const afterOffset = await api.getUpdates(first[0].update_id + 1, 0);
  check('смещение продвинуто, повтор не приходит', afterOffset.length === 0, String(afterOffset.length));

  console.log('\nОбработка команд');
  const ctx = { api, env, log: () => undefined };

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(200, '/start'));
  const startCall = lastCall('sendMessage');
  const startKeyboard = startCall?.payload.inline_keyboard;
  check('/start отвечает сообщением', Boolean(startCall));
  check(
    '/start содержит кнопку web_app',
    Array.isArray(startKeyboard) && startKeyboard[0]?.[0]?.web_app?.url === 'https://ciferki.example/app',
  );
  check(
    'текст приветствия на месте',
    typeof startCall?.payload.text === 'string' &&
      startCall.payload.text.includes('Циферки'),
  );
  check(
    'в клавиатуре есть быстрые разделы',
    Array.isArray(startKeyboard) && startKeyboard[1]?.length === 3,
  );

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(201, '/start ref_777'));
  check(
    'реферальный запуск отличается текстом',
    String(lastCall('sendMessage')?.payload.text).includes('позвали по ссылке'),
  );

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(202, '/share'));
  const shareCall = lastCall('sendMessage');
  const shareRows = shareCall?.payload.inline_keyboard ?? [];
  const shareButton = shareRows.flat().find((button: any) => button.url?.includes('t.me/share'));
  check('кнопка «поделиться» ведёт в t.me/share', Boolean(shareButton));
  check(
    'в ссылке есть метка приглашения',
    String(shareButton?.url).includes('ref_4242'),
    String(shareButton?.url),
  );

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(203, '/profile'));
  check(
    'без источника профиля показывается подсказка',
    lastCall('sendMessage')?.payload.text === TEXTS.profileUnavailable,
  );

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(204, '/profile'));
  calls.length = 0;
  await handleUpdate(
    { ...ctx, profile: async () => ({ name: 'Диджей', level: 4, balance: 113280, numbers: 18, portfolio: 240000 }) },
    messageUpdate(205, '/profile'),
  );
  const profileText = String(lastCall('sendMessage')?.payload.text);
  check('профиль содержит уровень', profileText.includes('Уровень: 4'), profileText.slice(0, 40));
  // Intl для русского языка ставит неразрывный пробел между разрядами —
  // это правильно для отображения, поэтому в проверке его нормализуем.
  check(
    'профиль содержит баланс',
    normalizeSpaces(profileText).includes('113 280'),
    normalizeSpaces(profileText).split('\n')[2] ?? '',
  );

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(206, '/чепуха'));
  check('неизвестная команда отвечает подсказкой', lastCall('sendMessage')?.payload.text === TEXTS.unknown);

  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(207, 'просто текст'));
  check('обычный текст получает ту же подсказку', lastCall('sendMessage')?.payload.text === TEXTS.unknown);

  calls.length = 0;
  await handleUpdate(ctx, {
    update_id: 300,
    callback_query: {
      id: 'cb-1',
      from: { id: 4242, is_bot: false, first_name: 'Диджей' },
      data: 'chances',
      message: {
        message_id: 10,
        chat: { id: 4242, type: 'private' },
        date: Math.floor(Date.now() / 1000),
      },
    },
  });
  check('нажатие кнопки подтверждено', Boolean(lastCall('answerCallbackQuery')));
  check('кнопка «шансы» присылает таблицу', lastCall('sendMessage')?.payload.text === TEXTS.chances);

  calls.length = 0;
  await handleUpdate(ctx, {
    update_id: 301,
    callback_query: {
      id: 'cb-2',
      from: { id: 4242, is_bot: false, first_name: 'Диджей' },
      data: 'неизвестная',
      message: {
        message_id: 11,
        chat: { id: 4242, type: 'private' },
        date: Math.floor(Date.now() / 1000),
      },
    },
  });
  check('устаревшая кнопка обрабатывается', lastCall('sendMessage')?.payload.text === TEXTS.stale);

  console.log('\nОшибка Bot API');
  const badApi = new TelegramApi(env.botToken, `http://127.0.0.1:${port}`);
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 7 } }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
  let caught: unknown = null;
  try {
    await badApi.getMe();
  } catch (error) {
    caught = error;
  }
  globalThis.fetch = original;
  check('ошибка Bot API разобрана', caught instanceof Error);
  check(
    'задержка повтора прочитана',
    (caught as { retryAfterSeconds?: number } | null)?.retryAfterSeconds === 7,
    String((caught as { retryAfterSeconds?: number } | null)?.retryAfterSeconds),
  );

  console.log('\nЗапуск процесса бота');
  const bundle = process.env.BOT_BUNDLE;
  if (!bundle) {
    console.log('  --   пропущено: BOT_BUNDLE не задан');
    server.close();
    console.log(failures === 0 ? '\nПРОВЕРКА БОТА ПРОЙДЕНА' : `\nПРОВАЛОВ: ${failures}`);
    process.exit(failures === 0 ? 0 : 1);
  }

  const before = calls.length;
  const bot = spawn(process.execPath, ['--enable-source-maps', bundle], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      BOT_TOKEN: 'test-token',
      BOT_API_BASE: `http://127.0.0.1:${port}`,
      WEBAPP_URL: 'https://ciferki.example/app',
      BOT_USERNAME: 'ciferki_bot',
      POLL_TIMEOUT: '1',
    },
  });

  let botLog = '';
  bot.stdout.on('data', (chunk) => {
    botLog += chunk;
  });
  bot.stderr.on('data', (chunk) => {
    botLog += chunk;
  });

  const sinceBoot = () => calls.slice(before);
  const polling = await waitFor(
    () => sinceBoot().some((call) => call.method === 'getUpdates'),
    10_000,
  );
  check('процесс бота поднялся и опрашивает Telegram', polling, botLog.slice(0, 200));
  const bootMethods = sinceBoot().map((call) => call.method);
  check('при старте установлены команды', bootMethods.includes('setMyCommands'), bootMethods.join(', '));
  check('при старте выставлена кнопка меню', bootMethods.includes('setChatMenuButton'));

  inbox = [messageUpdate(900, '/start')];
  const answered = await waitFor(
    () =>
      sinceBoot().some(
        (call) =>
          call.method === 'sendMessage' && String(call.payload.text ?? '').includes('Циферки'),
      ),
    10_000,
  );
  check('живой опрос доносит /start до ответа', answered);
  const liveAnswer = [...sinceBoot()]
    .reverse()
    .find(
      (call) =>
        call.method === 'sendMessage' && String(call.payload.text ?? '').includes('Циферки'),
    );
  check(
    'в живом ответе есть кнопка Mini App',
    liveAnswer?.payload.inline_keyboard?.[0]?.[0]?.web_app?.url === 'https://ciferki.example/app',
    String(liveAnswer?.payload.inline_keyboard?.[0]?.[0]?.web_app?.url),
  );
  if (!answered) console.log(botLog.slice(-1500));

  bot.kill();
  await sleep(400);

  server.close();
  console.log(failures === 0 ? '\nПРОВЕРКА БОТА ПРОЙДЕНА' : `\nПРОВАЛОВ: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
