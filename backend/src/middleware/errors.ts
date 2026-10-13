// language: TypeScript, file: backend/src/middleware/errors.ts
// Обработка ошибок: наружу — короткий код, в журнал — подробность.

import type { NextFunction, Request, Response } from 'express';
import type { Repository } from '../repository/types.ts';

/** Обёртка для асинхронных обработчиков: Express 4 не ловит отклонённые промисы сам. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

export function createErrorHandler(repo: Repository) {
  return (error: Error, req: Request, res: Response, _next: NextFunction): void => {
    console.error(`[error] ${req.method} ${req.path}:`, error.message);

    // Ошибки пишем в журнал, чтобы админ-панель их показывала.
    void repo
      .recordAudit(req.player?.id ?? null, 'error', {
        path: req.path,
        method: req.method,
        message: error.message,
      })
      .catch(() => undefined);

    if (res.headersSent) return;
    res.status(500).json({ error: 'internal_error' });
  };
}

/** Единый формат ответа об ошибке клиента. */
export function badRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}
