// language: JavaScript, file: backend/scripts/migrate.mjs
// Сборка и запуск миграции одной командой.

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const outfile = fileURLToPath(new URL('../dist/migrate.mjs', import.meta.url));

await build({
  entryPoints: [fileURLToPath(new URL('../src/db/migrate-cli.ts', import.meta.url))],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  loader: { '.sql': 'text' },
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--enable-source-maps', outfile], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
