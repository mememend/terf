// language: TypeScript, file: backend/src/middleware/rate-limit.ts
// Простое ограничение частоты по игроку: корзина токенов.
// Защищает от флуда выпусками, который иначе выжирал бы очередь транзакций.

import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function createRateLimiter(options: { capacity: number; refillPerMinute: number }) {
  const buckets = new Map<number, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.player?.id;
    if (key === undefined) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: options.capacity, updatedAt: now };
    const elapsedMinutes = (now - bucket.updatedAt) / 60_000;
    bucket.tokens = Math.min(
      options.capacity,
      bucket.tokens + elapsedMinutes * options.refillPerMinute,
    );
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      res.status(429).json({ error: 'rate_limited', retryAfterSeconds: 1 });
      return;
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}
