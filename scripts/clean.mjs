// language: JavaScript, file: frontend/scripts/clean.mjs
// Удаляет каталог сборки перед новой сборкой.
//
// Нужен потому, что опция Vite emptyOutDir на практике не убирает посторонние
// файлы из dist: старые бандлы копятся и уезжают в деплой мёртвым грузом
// (в этом проекте так накопилось пять сборок подряд).
//
// На обычной машине достаточно rmSync. В среде разработки, где каталог отдаётся
// через промежуточный файловый слой, возможен устаревший листинг: rmSync
// отчитывается об успехе, а readdir ещё какое-то время показывает удалённые
// записи (rmdir по ним возвращает ENOENT). На корректность сборки это не влияет —
// index.html всегда ссылается только на свежий бандл, — поэтому отдельной
// борьбы здесь нет, но знать об этом стоит, чтобы не искать несуществующий баг.

import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../dist', import.meta.url));

try {
  rmSync(outDir, { recursive: true, force: true });
} catch (error) {
  // Каталог мог быть занят другим процессом — сборка всё равно продолжится,
  // Vite перезапишет index.html и создаст бандлы заново.
  console.warn(`[build] не удалось полностью очистить dist: ${error.code ?? error.message}`);
}

if (existsSync(outDir)) {
  console.log('[build] каталог dist очищен');
} else {
  console.log('[build] каталог dist удалён');
}
