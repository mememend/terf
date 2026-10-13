// language: TypeScript, file: frontend/vite.config.ts
// base './' — собранный бандл работает с любого подпути на HTTPS-хостинге.
// Игровое ядро подключается из общего пакета @ciferki/shared, а не копией.

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sharedEntry = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@ciferki/shared': sharedEntry,
    },
  },
  server: {
    port: 5173,
    // Telegram открывает Mini App через HTTPS-туннель — разрешаем любой хост в разработке.
    host: true,
    allowedHosts: true,
    // Общий пакет лежит выше корня фронтенда, поэтому расширяем область доступа.
    fs: {
      allow: ['..'],
    },
    proxy: {
      // Обращения к API уходят на сервер, чтобы не настраивать CORS в разработке.
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Явно чистим каталог: иначе старые бандлы копятся и уезжают в деплой
    // мёртвым грузом. index.html всегда ссылается только на свежий.
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
  },
});
