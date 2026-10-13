// language: TypeScript, file: backend/src/types.d.ts
// Расширение типа запроса Express: после проверки подписи в req лежит игрок,
// определённый сервером, а не присланный клиентом.

import type { PlayerRow } from './repository/types.ts';
import type { TelegramUser } from './telegram-auth.ts';

declare global {
  namespace Express {
    interface Request {
      /** Игрок из базы, найденный по проверенной подписи Telegram. */
      player?: PlayerRow;
      /** Данные из проверенной подписи. */
      telegramUser?: TelegramUser;
    }
  }
}

export {};
