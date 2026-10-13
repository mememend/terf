// language: JavaScript, file: backend/scripts/dev.mjs
// Режим разработки: esbuild пересобирает бандл при изменении файлов,
// дочерний процесс сервера перезапускается после каждой успешной сборки.

import { context } from 'esbuild';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildOptions } from './build.mjs';

const serverEntry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));

let child = null;

function restartServer() {
  if (child) {
    child.removeAllListeners('exit');
    child.kill();
    child = null;
  }
  child = spawn(process.execPath, ['--enable-source-maps', serverEntry], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code !== 0) console.error(`[dev] сервер завершился с кодом ${code}`);
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
            console.error('[dev] сборка не удалась, сервер не перезапускаем');
            return;
          }
          console.log('[dev] сборка готова, перезапуск сервера');
          restartServer();
        });
      },
    },
  ],
});

await ctx.watch();
console.log('[dev] следим за изменениями в backend/src и shared/src');

const stop = async () => {
  if (child) child.kill();
  await ctx.dispose();
  process.exit(0);
};

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
