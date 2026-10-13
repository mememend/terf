// language: JavaScript, file: backend/scripts/smoke.mjs
// Сквозная проверка API.
//
// Два режима:
//   SMOKE_EXTERNAL не задан — собирает сервер, поднимает его на свободном порту
//     с хранилищем в памяти и прогоняет проверки;
//   SMOKE_EXTERNAL=1 — проверки идут против уже поднятого сервера (SMOKE_PORT).
//     Так проверку можно навести на настоящую базу.

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const serverOut = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));
const smokeOut = fileURLToPath(new URL('../dist/smoke.mjs', import.meta.url));

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  loader: { '.sql': 'text' },
  logLevel: 'warning',
};

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

await build({
  ...common,
  entryPoints: [fileURLToPath(new URL('../src/smoke.ts', import.meta.url))],
  outfile: smokeOut,
});

const external = process.env.SMOKE_EXTERNAL === '1';

if (external) {
  // Сервер уже поднят вызывающей стороной — только прогоняем проверки.
  const smoke = spawn(process.execPath, ['--enable-source-maps', smokeOut], {
    stdio: 'inherit',
    env: { ...process.env, SMOKE_PORT: process.env.SMOKE_PORT ?? '8099' },
  });
  smoke.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} else {
  await build({
    ...common,
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    outfile: serverOut,
  });

  const PORT = Number(process.env.SMOKE_PORT ?? (await freePort()));
  const databaseUrl = process.env.SMOKE_DATABASE_URL ?? '';

  // Проверочный сервер работает без настоящего токена бота.
  const server = spawn(process.execPath, ['--enable-source-maps', serverOut], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      ALLOW_DEV_AUTH: '1',
      BOT_TOKEN: 'smoke-test-token',
      ADMIN_TELEGRAM_IDS: '777001',
      BOT_INTERNAL_SECRET: 'smoke-internal-secret',
      DATABASE_URL: databaseUrl,
    },
  });

  server.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

  let stopping = false;
  server.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[smoke] сервер завершился нештатно: код=${code} сигнал=${signal}`);
  });

  const smoke = spawn(process.execPath, ['--enable-source-maps', smokeOut], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SMOKE_PORT: String(PORT),
      BOT_INTERNAL_SECRET: 'smoke-internal-secret',
      SMOKE_EXPECT_DRIVER: databaseUrl ? 'postgres' : 'memory',
    },
  });

  /**
   * Остановка проверочного сервера.
   *
   * Возвращает промис, который разрешается ТОЛЬКО после события exit дочернего
   * процесса: если вызвать process.exit(), пока libuv ещё закрывает хендл
   * потомка, на Windows срабатывает ассерт
   * «!(handle->flags & UV_HANDLE_CLOSING), src\win\async.c».
   */
  const stopServer = () => {
    stopping = true;
    return new Promise((resolve) => {
      if (server.exitCode !== null || server.signalCode !== null) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(hard);
        clearTimeout(giveUp);
        resolve();
      };
      server.once('exit', finish);
      server.kill();
      const hard = setTimeout(() => {
        if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
      }, 1500);
      const giveUp = setTimeout(finish, 4000);
    });
  };

  process.on('SIGINT', () => {
    void stopServer().then(() => {
      process.exitCode = 130;
    });
  });

  smoke.on('exit', (code) => {
    void stopServer().then(() => {
      process.exitCode = code ?? 1;
    });
  });

  process.on('uncaughtException', (error) => {
    console.error('[smoke] необработанное исключение:', error);
    void stopServer().then(() => {
      process.exitCode = 1;
    });
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[smoke] необработанный отказ:', reason);
    void stopServer().then(() => {
      process.exitCode = 1;
    });
  });
}
