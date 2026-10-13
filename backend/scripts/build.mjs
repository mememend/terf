// language: JavaScript, file: backend/scripts/build.mjs
// Сборка сервера одним файлом. Игровое ядро @ciferki/shared вшивается в бандл,
// зависимости из node_modules остаются внешними.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export const buildOptions = {
  entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/server.mjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  // Схема подключается как текст и вшивается в бандл: файловых зависимостей нет.
  loader: { '.sql': 'text' },
  logLevel: 'info',
};

await build(buildOptions);
