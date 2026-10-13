// language: TypeScript, file: backend/src/app.ts
// Сборка Express-приложения. Вынесено отдельно от запуска, чтобы приложение
// можно было поднять в проверочном сценарии на произвольном порту.

import cors from 'cors';
import express, { type Express } from 'express';
import type { Env } from './env.ts';
import { createAuthMiddleware } from './middleware/auth.ts';
import { createErrorHandler } from './middleware/errors.ts';
import type { Repository } from './repository/types.ts';
import { createAdminRouter } from './routes/admin.ts';
import { createApiRouter } from './routes/api.ts';
import { createInternalRouter } from './routes/internal.ts';
import { GameService } from './services/game-service.ts';

export function createApp(repo: Repository, env: Env): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use(
    cors({
      // Пустой список означает разработку: пускаем всё, но без передачи cookie.
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'X-Dev-User'],
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      credentials: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, driver: repo.driver, env: env.nodeEnv });
  });

  const service = new GameService(repo);
  const auth = createAuthMiddleware(repo, env);

  // Внутренние вызовы бота: своя аутентификация, отдельно от игровой подписи.
  if (env.botInternalSecret) {
    app.use('/internal', createInternalRouter(repo, service, env.botInternalSecret));
  }

  // Подпись проверяется один раз на все /api, дальше работают только маршруты.
  app.use('/api', auth);
  app.use('/api', createApiRouter(service, repo, env));
  app.use('/api/admin', createAdminRouter(repo, service));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use(createErrorHandler(repo));
  return app;
}
