// language: JavaScript, file: backend/scripts/pgtest.mjs
// Проверка серверной части против НАСТОЯЩЕГО PostgreSQL.
//
// Поднимается PGlite — PostgreSQL, собранный в WebAssembly, — и его сокет-сервер,
// который говорит по проволочному протоколу. Дальше backend подключается к нему
// обычным драйвером pg, как к боевой базе. Значит проверяются настоящие SQL,
// настоящие транзакции и настоящая блокировка строки, а не заглушка.
//
// Две фазы:
//   1. полный набор проверок API против базы;
//   2. перезапуск приложения при живой базе — прогресс обязан сохраниться.

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const serverOut = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));
const smokeOut = fileURLToPath(new URL('../dist/smoke.mjs', import.meta.url));

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Останавливает потомка и ЖДЁТ его exit: иначе libuv роняет процесс на Windows. */
function stopChild(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
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
    child.once('exit', finish);
    child.kill();
    const hard = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 1500);
    const giveUp = setTimeout(finish, 4000);
  });
}

async function waitForHealth(port, timeoutMs = 25_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return await response.json();
    } catch {
      // Сервер ещё поднимается.
    }
    await sleep(250);
  }
  return null;
}

function startApp(port, databaseUrl) {
  const child = spawn(process.execPath, ['--enable-source-maps', serverOut], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      ALLOW_DEV_AUTH: '1',
      BOT_TOKEN: 'smoke-test-token',
      ADMIN_TELEGRAM_IDS: '777001',
      BOT_INTERNAL_SECRET: 'smoke-internal-secret',
      DATABASE_URL: databaseUrl,
    },
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[pg-server] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[pg-server] ${chunk}`));
  return child;
}

async function runChecks(port) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--enable-source-maps', smokeOut], {
      stdio: 'inherit',
      env: {
        ...process.env,
        SMOKE_PORT: String(port),
        SMOKE_EXTERNAL: '1',
        SMOKE_EXPECT_DRIVER: 'postgres',
      },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  console.log('Поднимаю PostgreSQL (PGlite) и сокет-сервер');
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');

  const db = new PGlite();
  await db.waitReady;
  const version = await db.query('select version()');
  console.log(`[pg] ${version.rows[0].version.split(',')[0]}`);

  const pgPort = await freePort();
  const socketServer = new PGLiteSocketServer({
    db,
    port: pgPort,
    host: '127.0.0.1',
    maxConnections: 10,
  });
  await socketServer.start();
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/postgres`;
  console.log(`[pg] слушает ${databaseUrl}`);

  await build({
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    outfile: serverOut,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: true,
    packages: 'external',
    loader: { '.sql': 'text' },
    logLevel: 'warning',
  });
  await build({
    entryPoints: [fileURLToPath(new URL('../src/smoke.ts', import.meta.url))],
    outfile: smokeOut,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: true,
    packages: 'external',
    loader: { '.sql': 'text' },
    logLevel: 'warning',
  });

  const appPort = await freePort();
  console.log(`\nФаза 1. Полный набор проверок против PostgreSQL (порт ${appPort})`);
  let app = startApp(appPort, databaseUrl);
  const health = await waitForHealth(appPort);
  if (!health) {
    console.error('Сервер не поднялся на PostgreSQL — проверка невозможна');
    await stopChild(app);
    await socketServer.stop();
    await db.close();
    process.exit(1);
  }

  // Схема должна быть создана самим сервером при старте.
  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  const names = tables.rows.map((row) => row.table_name);
  console.log(`[pg] таблиц создано: ${names.length} — ${names.join(', ')}`);

  const firstCode = await runChecks(appPort);

  console.log('\nФаза 2. Перезапуск приложения при живой базе');
  const before = await fetch(`http://127.0.0.1:${appPort}/api/state`, {
    headers: { 'X-Dev-User': '555001' },
  }).then((response) => response.json());

  await stopChild(app);
  app = startApp(appPort, databaseUrl);
  const restarted = await waitForHealth(appPort);

  let persistenceOk = false;
  if (restarted) {
    const after = await fetch(`http://127.0.0.1:${appPort}/api/state`, {
      headers: { 'X-Dev-User': '555001' },
    }).then((response) => response.json());

    const sameNumbers = before.state.numbers.length === after.state.numbers.length;
    const sameBalance = before.state.player.balance === after.state.player.balance;
    const sameIds =
      before.state.numbers.map((n) => n.id).join(',') ===
      after.state.numbers.map((n) => n.id).join(',');

    console.log(`  ${sameNumbers ? 'ok  ' : 'FAIL'} коллекция пережила перезапуск — ${before.state.numbers.length} → ${after.state.numbers.length}`);
    console.log(`  ${sameBalance ? 'ok  ' : 'FAIL'} баланс сохранился — ${before.state.player.balance} → ${after.state.player.balance}`);
    console.log(`  ${sameIds ? 'ok  ' : 'FAIL'} состав коллекции совпадает по id`);
    console.log(`  ok   история операций: ${after.state.ledger.length} записей`);

    const rows = await db.query('SELECT count(*)::int AS numbers FROM numbers');
    const releases = await db.query('SELECT count(*)::int AS releases FROM releases');
    console.log(`  ok   в таблице numbers строк: ${rows.rows[0].numbers}`);
    console.log(`  ok   в таблице releases строк: ${releases.rows[0].releases}`);

    persistenceOk = sameNumbers && sameBalance && sameIds;
  } else {
    console.log('  FAIL сервер не поднялся после перезапуска');
  }

  await stopChild(app);
  await socketServer.stop();
  await db.close();

  const ok = firstCode === 0 && persistenceOk;
  console.log(ok ? '\nПРОВЕРКА НА POSTGRESQL ПРОЙДЕНА' : '\nПРОВЕРКА НА POSTGRESQL ПРОВАЛЕНА');
  process.exitCode = ok ? 0 : 1;
}

main().catch(async (error) => {
  console.error('[pgtest] сбой:', error);
  process.exitCode = 1;
});
