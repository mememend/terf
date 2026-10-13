// language: JavaScript, file: bot/scripts/selftest.mjs
// Сборка бота и проверки. Бандл бота передаётся в проверку через BOT_BUNDLE,
// чтобы она подняла настоящий процесс и прогнала живой длинный опрос.

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  logLevel: 'warning',
};

const botBundle = fileURLToPath(new URL('../dist/bot.mjs', import.meta.url));
const selftestBundle = fileURLToPath(new URL('../dist/selftest.mjs', import.meta.url));

await build({
  ...common,
  entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  outfile: botBundle,
});

await build({
  ...common,
  entryPoints: [fileURLToPath(new URL('../src/selftest.ts', import.meta.url))],
  outfile: selftestBundle,
});

const result = spawnSync(process.execPath, ['--enable-source-maps', selftestBundle], {
  stdio: 'inherit',
  env: { ...process.env, BOT_BUNDLE: botBundle },
});
process.exit(result.status ?? 1);
