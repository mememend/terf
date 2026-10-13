// language: TypeScript, file: backend/src/routes/internal.ts
// Внутренний маршрут для бота: сервер-сервер, отдельная схема аутентификации.
//
// Это НЕ игровой API: здесь нет подписи Telegram, потому что вызывающая сторона —
// не игрок, а бот. Доступ закрыт общим секретом BOT_INTERNAL_SECRET и сравнением
// постоянного времени. Если секрет не задан, маршрут не поднимается вовсе.

import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.ts';
import type { Repository } from '../repository/types.ts';
import type { GameService } from '../services/game-service.ts';

export const BOT_SECRET_HEADER = 'x-bot-secret';

/** Сравнение постоянного времени: длина и содержимое не утекают по таймингу. */
function secretMatches(expected: string, provided: string | undefined): boolean {
  if (!provided) return false;
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(provided, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createInternalRouter(
  repo: Repository,
  service: GameService,
  secret: string,
): Router {
  const router = Router();

  router.use((req, res, next) => {
    if (!secretMatches(secret, req.header(BOT_SECRET_HEADER))) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  });

  /**
   * Сводка профиля для команды /profile.
   * Игрока не создаём: написать боту в чат — ещё не значит начать играть.
   */
  router.post(
    '/profile',
    asyncHandler(async (req, res) => {
      const raw = (req.body as Record<string, unknown>).telegramId;
      const telegramId = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(telegramId)) {
        res.status(400).json({ error: 'telegram_id_required' });
        return;
      }

      const player = await repo.findPlayerByTelegramId(telegramId);
      if (!player) {
        res.json({ profile: null, reason: 'not_playing_yet' });
        return;
      }

      const state = await service.getState(player.id);
      const summary = service.describe(state);
      res.json({
        profile: {
          name: state.player.name,
          level: state.player.level,
          balance: state.player.balance,
          numbers: summary.count,
          portfolio: summary.portfolioValue,
        },
      });
    }),
  );

  return router;
}
