// language: TypeScript, file: bot/src/handlers.ts
// Маршрутизация обновлений. Функция чистая в том смысле, что не знает,
// откуда взялся api: в проверках подставляется клиент, смотрящий на эмулятор.

import type { TelegramApi, TelegramUpdate } from './api.ts';
import type { BotEnv } from './env.ts';
import { mainKeyboard, shareKeyboard } from './keyboards.ts';
import { profileText, TEXTS } from './texts.ts';

export interface ProfileSummary {
  name: string;
  level: number;
  balance: number;
  numbers: number;
  portfolio: number;
}

export interface BotContext {
  api: TelegramApi;
  env: BotEnv;
  /** Необязательный источник профиля: появляется, когда задан BACKEND_URL. */
  profile?: (telegramId: number) => Promise<ProfileSummary | null>;
  /** Журнал: в проверках подменяется, чтобы видеть происходящее. */
  log?: (message: string) => void;
}

export interface ParsedCommand {
  command: string;
  payload: string;
}

/** Разбор «/start ref_12» в команду и параметр. Возвращает null для обычного текста. */
export function parseCommand(text: string | undefined): ParsedCommand | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  // Отсекаем адресацию вида /start@ciferki_bot.
  const command = head.slice(1).split('@')[0].toLowerCase();
  return { command, payload: rest.join(' ') };
}

function displayName(update: TelegramUpdate): string {
  const user = update.message?.from ?? update.callback_query?.from;
  if (!user) return 'игрок';
  return user.first_name || user.username || 'игрок';
}

export async function handleUpdate(ctx: BotContext, update: TelegramUpdate): Promise<void> {
  const log = ctx.log ?? (() => undefined);

  if (update.callback_query) {
    const chatId = update.callback_query.message?.chat.id;
    const data = update.callback_query.data ?? '';
    await ctx.api.answerCallbackQuery(update.callback_query.id);
    if (chatId === undefined) return;

    switch (data) {
      case 'chances':
        await ctx.api.sendMessage(chatId, TEXTS.chances, { keyboard: mainKeyboard(ctx.env) });
        return;
      case 'rules':
        await ctx.api.sendMessage(chatId, TEXTS.rules, { keyboard: mainKeyboard(ctx.env) });
        return;
      case 'profile':
        await sendProfile(ctx, chatId, update.callback_query.from.id);
        return;
      default:
        await ctx.api.sendMessage(chatId, TEXTS.stale);
        return;
    }
  }

  const message = update.message;
  if (!message?.text) return;
  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;
  const parsed = parseCommand(message.text);

  if (!parsed) {
    // Обычный текст: коротко объясняем, что делать.
    await ctx.api.sendMessage(chatId, TEXTS.unknown, { keyboard: mainKeyboard(ctx.env) });
    return;
  }

  log(`команда /${parsed.command} от ${userId}`);

  switch (parsed.command) {
    case 'start': {
      const isReferral = parsed.payload.startsWith('ref_');
      const text = isReferral
        ? `${TEXTS.referral(displayName(update))}\n\n${TEXTS.greeting(displayName(update))}`
        : TEXTS.greeting(displayName(update));
      // Одно сообщение с кнопкой игры. Постоянный вход обеспечивает
      // кнопка меню, выставленная в setup.ts.
      await ctx.api.sendMessage(chatId, text, { keyboard: mainKeyboard(ctx.env) });
      return;
    }

    case 'play':
      await ctx.api.sendMessage(chatId, 'Открываю игру:', { keyboard: mainKeyboard(ctx.env) });
      return;

    case 'help':
      await ctx.api.sendMessage(chatId, TEXTS.help, { keyboard: mainKeyboard(ctx.env) });
      return;

    case 'chances':
      await ctx.api.sendMessage(chatId, TEXTS.chances, { keyboard: mainKeyboard(ctx.env) });
      return;

    case 'rules':
      await ctx.api.sendMessage(chatId, TEXTS.rules, { keyboard: mainKeyboard(ctx.env) });
      return;

    case 'profile':
      await sendProfile(ctx, chatId, userId);
      return;

    case 'share': {
      const link = shareKeyboard(ctx.env, `ref_${userId}`);
      await ctx.api.sendMessage(
        chatId,
        'Позови друзей — по ссылке они попадут в игру с пометкой приглашения.',
        { keyboard: link },
      );
      return;
    }

    default:
      await ctx.api.sendMessage(chatId, TEXTS.unknown, { keyboard: mainKeyboard(ctx.env) });
  }
}

async function sendProfile(ctx: BotContext, chatId: number, telegramId: number): Promise<void> {
  if (!ctx.profile) {
    await ctx.api.sendMessage(chatId, TEXTS.profileUnavailable, {
      keyboard: mainKeyboard(ctx.env),
    });
    return;
  }
  try {
    const profile = await ctx.profile(telegramId);
    if (!profile) {
      await ctx.api.sendMessage(chatId, TEXTS.profileUnavailable, {
        keyboard: mainKeyboard(ctx.env),
      });
      return;
    }
    await ctx.api.sendMessage(chatId, profileText(profile), { keyboard: mainKeyboard(ctx.env) });
  } catch {
    await ctx.api.sendMessage(chatId, TEXTS.error, { keyboard: mainKeyboard(ctx.env) });
  }
}
