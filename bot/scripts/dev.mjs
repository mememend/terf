// language: JavaScript, file: bot/scripts/dev.mjs
// Разработка бота: пересборка при изменении и перезапуск процесса.

import { context } from 'esbuild';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildOptions } from './build.mjs';

const entry = fileURLToPath(new URL('../dist/bot.mjs', import.meta.url));
let child = null;

function restart() {
  if (child) {
    child.removeAllListeners('exit');
    child.kill();
    child = null;
  }
  child = spawn(process.execPath, ['--enable-source-maps', entry], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (!signal && code !== 0) console.error(`[dev] бот завершился с кодом ${code}`);
  });
}

const ctx = await context({
  ...buildOptions,
  logLevel: 'warning',
  plugins: [
    {
      name: 'restart-on-rebuild',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            console.error('[dev] сборка не удалась, бот не перезапускаем');
            return;
          }
          restart();
        });
      },
    },
  ],
});

await ctx.watch();
console.log('[dev] следим за bot/src');

const stop = async () => {
  if (child) child.kill();
  await ctx.dispose();
  process.exit(0);
};

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
