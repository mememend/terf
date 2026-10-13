// language: TypeScript, file: backend/src/middleware/auth.ts
// Проверка подписи Telegram на каждом запросе. Права администратора берутся
// только из ADMIN_TELEGRAM_IDS после проверки подписи — клиент их не передаёт.

import type { NextFunction, Request, Response } from 'express';
import type { Env } from '../env.ts';
import type { Repository } from '../repository/types.ts';
import { devUser, verifyInitData, type TelegramUser } from '../telegram-auth.ts';

export const INIT_DATA_HEADER = 'x-telegram-init-data';
export const DEV_USER_HEADER = 'x-dev-user';

export function createAuthMiddleware(repo: Repository, env: Env) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const initData = req.header(INIT_DATA_HEADER) ?? '';
      let user: TelegramUser | null = null;

      if (initData) {
        const result = verifyInitData(initData, env.botToken);
        if (!result.ok) {
          // Наружу — обобщённый ответ, причина уходит в журнал.
          console.warn(`[auth] подпись отклонена: ${result.reason}`);
          res.status(401).json({ error: 'invalid_init_data' });
          return;
        }
        user = result.user;
      } else if (env.allowDevAuth) {
        user = devUser(req.header(DEV_USER_HEADER));
      }

      if (!user) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const isAdmin = env.adminTelegramIds.includes(user.id);
      const player = await repo.getOrCreatePlayer(user, isAdmin);
      if (player.isBanned) {
        res.status(403).json({ error: 'banned' });
        return;
      }

      req.player = player;
      req.telegramUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Пропускает только администратора. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.player?.isAdmin) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

/** Игрок обязателен — подстраховка на случай неверного порядка middleware. */
export function requirePlayer(req: Request, res: Response, next: NextFunction): void {
  if (!req.player) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
