// language: JavaScript, file: bot/scripts/build.mjs
// Сборка бота одним файлом.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export const buildOptions = {
  entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/bot.mjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  logLevel: 'warning',
};

await build(buildOptions);
