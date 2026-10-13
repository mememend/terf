// language: TypeScript, file: bot/src/keyboards.ts
// Клавиатуры. Главная кнопка — web_app: она открывает Mini App внутри Telegram,
// без перехода в браузер.

import type { BotEnv } from './env.ts';
import { miniAppDirectLink, webappLink } from './env.ts';
import type { InlineKeyboardButton, InlineKeyboardMarkup } from './api.ts';

/** Основная клавиатура под сообщением: игра и быстрые справки. */
export function mainKeyboard(env: BotEnv, startParam?: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: `🎰 Открыть ${env.webappTitle}`, web_app: { url: webappLink(env, startParam) } }],
      [
        { text: 'Шансы', callback_data: 'chances' },
        { text: 'Правила', callback_data: 'rules' },
        { text: 'Профиль', callback_data: 'profile' },
      ],
    ],
  };
}

/** Клавиатура под ответом /share. */
export function shareKeyboard(env: BotEnv, startParam: string): InlineKeyboardMarkup {
  const link = miniAppDirectLink(env, startParam);
  const rows: InlineKeyboardButton[][] = [
    [{ text: `🎰 Открыть ${env.webappTitle}`, web_app: { url: webappLink(env, startParam) } }],
  ];
  if (link) {
    rows.push([
      {
        text: 'Поделиться с друзьями',
        url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Собираю красивые номера в Циферках')}`,
      },
    ]);
  }
  return { inline_keyboard: rows };
}
